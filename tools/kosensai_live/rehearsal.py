"""ローカル検証環境(rehearsal/)の操作。

    uv run kosensai-live rehearsal reload                       app/ をビルドしてリハーサル環境へ反映する
    uv run kosensai-live rehearsal load-test [人数] [Ch|all] [秒数]  視聴クライアントを起動して負荷をかける
"""

import os
import shutil
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.request

from . import config

REH_DIR = config.REPO / "rehearsal"
APP_DIR = config.REPO / "app"
LOAD_TEST_OUT = REH_DIR / "generated/load-test"
PREVIEW_URL = "https://localhost:8444/"
# Caddy の再作成後に応答が返るまで待つ秒数
WAIT_SEC = 10


def exe(name):
    # Windows の pnpm は pnpm.cmd であり、shell を介さずに起動するにはフルパスが必要である。
    return shutil.which(name) or sys.exit(f"{name} が見つかりません")


def run(cmd, cwd):
    subprocess.run([exe(cmd[0]), *cmd[1:]], cwd=cwd, check=True)


def status(url):
    # 自己署名の internal CA が発行するため、証明書を検証しない。
    ctx = ssl._create_unverified_context()
    try:
        return urllib.request.urlopen(url, context=ctx, timeout=3).status
    except urllib.error.HTTPError as e:
        return e.code
    except OSError:
        return None


def reload():
    print("== ビルド ==")
    run(["pnpm", "run", "build"], APP_DIR)

    print()
    print("== マウントを再設定 ==")
    # adapter-static はビルドのたびに web/ を削除して再作成するため、bind mount が削除済みの
    # ディレクトリを参照したままとなり 404 を返す。Caddy を再作成して再マウントする。
    #
    # --no-deps を指定しない場合は mediamtx まで再作成され、ネットワーク名前空間を相乗りして
    # いる publisher が名前空間を失って停止する。
    run(["docker", "compose", "up", "-d", "--force-recreate", "--no-deps", "caddy-origin", "caddy-preview"], REH_DIR)

    for _ in range(WAIT_SEC):
        code = status(PREVIEW_URL)
        if code == 200:
            break
        time.sleep(1)
    if code != 200:
        sys.exit(f"  NG  {PREVIEW_URL} が {code or '応答なし'}")
    print(f"  OK  {PREVIEW_URL}")


def load_test(clients, ch, duration):
    conf = config.load_config()
    domain = os.environ.get("DOMAIN") or conf["site"]["domain"]
    channels = config.channel_ids(conf) if ch == "all" else [ch]

    if subprocess.run([exe("docker"), "inspect", "rehearsal-mediamtx"], capture_output=True).returncode != 0:
        sys.exit("リハーサル環境が起動していません。先に docker compose up -d を実行してください")

    print("== 負荷テスト ==")
    print(f"  対象 Ch    : {' '.join(channels)}")
    print(f"  同時視聴者 : {clients} 人 × {len(channels)} Ch = {clients * len(channels)} セッション")
    print(f"  実行時間   : {duration} 秒")
    print()

    shutil.rmtree(LOAD_TEST_OUT, ignore_errors=True)
    for ch in channels:
        (LOAD_TEST_OUT / ch).mkdir(parents=True)

    docker = exe("docker")
    for ch in channels:
        name = f"rehearsal-client-{ch}"
        subprocess.run([docker, "rm", "-f", name], capture_output=True)
        subprocess.run([
            docker, "run", "--rm", "-d",
            "--name", name,
            "--network", "container:rehearsal-mediamtx",
            "-e", f"CLIENTS={clients}", "-e", f"CH={ch}", "-e", f"DURATION={duration}", "-e", f"DOMAIN={domain}",
            "-v", f"{REH_DIR / 'containers/client/pull.sh'}:/pull.sh:ro",
            "-v", f"{LOAD_TEST_OUT / ch}:/out",
            "--entrypoint", "/bin/sh",
            "curlimages/curl:latest", "/pull.sh",
        ], check=True, stdout=subprocess.DEVNULL)

    print(f"  実行中… ({duration}秒 + 集計)")
    for ch in channels:
        subprocess.run([docker, "wait", f"rehearsal-client-{ch}"], capture_output=True)

    print()
    print("== 結果 ==")
    print(f"  {'Ch':<6} {'視聴者':>6} {'受信':>10} {'合計':>11} {'1人あたり':>12} {'セグ':>6} {'エラー':>6}")
    print("  " + "-" * 66)
    tot_bytes = tot_segs = tot_errs = 0
    for ch in channels:
        b = s = e = n = 0
        for f in sorted((LOAD_TEST_OUT / ch).glob("c*")):
            bb, ss, ee = f.read_text().split()
            b += int(bb); s += int(ss); e += int(ee); n += 1
        mbps = b * 8 / duration / 1e6
        per = mbps / n if n else 0
        print(f"  {ch:<6} {n:>6} {b/1e6:>9.1f}MB {mbps:>9.1f}Mbps {per:>10.2f}Mbps {s:>6} {e:>6}")
        tot_bytes += b; tot_segs += s; tot_errs += e
    print("  " + "-" * 66)
    tm = tot_bytes * 8 / duration / 1e6
    print(f"  {'合計':<6} {'':>6} {tot_bytes/1e6:>9.1f}MB {tm:>9.1f}Mbps {'':>12} {tot_segs:>6} {tot_errs:>6}")
    print()
    if tot_errs:
        print(f"  エラーが {tot_errs} 件あります。docker compose logs mediamtx で確認してください")
    if tot_segs == 0:
        print("  セグメントを 1 つも取得できていません。publisher が動作しているか確認してください")
        print("     docker compose ps")

    print()
    print("  無線区間の律速は Wi-Fi の AP エアタイムであり、同一ホスト内のループバックでは再現できません。")
