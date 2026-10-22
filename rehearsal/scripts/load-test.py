"""視聴クライアントを N 本起動して負荷をかける。

    uv run rehearsal/scripts/load-test.py [同時視聴者数] [チャンネル|all] [秒数]

クライアントは containers/client/pull.sh を Ch ごとに 1 つのコンテナで実行する。
"""

import argparse
import os
import pathlib
import shutil
import subprocess
import sys

REH_DIR = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REH_DIR.parent / "tools"))
import config  # noqa: E402

OUT = REH_DIR / "generated/load-test"

ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument("clients", nargs="?", type=int, default=10, help="Ch あたりの同時視聴者数")
ap.add_argument("ch", nargs="?", default="ch1", help="Ch の id、または all")
ap.add_argument("duration", nargs="?", type=int, default=30, help="実行秒数")
args = ap.parse_args()

conf = config.load_config()
domain = os.environ.get("DOMAIN") or conf["site"]["domain"]
channels = config.channel_ids(conf) if args.ch == "all" else [args.ch]
docker = shutil.which("docker") or sys.exit("docker が見つかりません")

if subprocess.run([docker, "inspect", "rehearsal-mediamtx"], capture_output=True).returncode != 0:
    sys.exit("リハーサル環境が起動していません。先に docker compose up -d を実行してください")

print("== 負荷テスト ==")
print(f"  対象 Ch    : {' '.join(channels)}")
print(f"  同時視聴者 : {args.clients} 人 × {len(channels)} Ch = {args.clients * len(channels)} セッション")
print(f"  実行時間   : {args.duration} 秒")
print()

shutil.rmtree(OUT, ignore_errors=True)
for ch in channels:
    (OUT / ch).mkdir(parents=True)

for ch in channels:
    name = f"rehearsal-client-{ch}"
    subprocess.run([docker, "rm", "-f", name], capture_output=True)
    subprocess.run([
        docker, "run", "--rm", "-d",
        "--name", name,
        "--network", "container:rehearsal-mediamtx",
        "-e", f"CLIENTS={args.clients}", "-e", f"CH={ch}", "-e", f"DURATION={args.duration}", "-e", f"DOMAIN={domain}",
        "-v", f"{REH_DIR / 'containers/client/pull.sh'}:/pull.sh:ro",
        "-v", f"{OUT / ch}:/out",
        "--entrypoint", "/bin/sh",
        "curlimages/curl:latest", "/pull.sh",
    ], check=True, stdout=subprocess.DEVNULL)

print(f"  実行中… ({args.duration}秒 + 集計)")
for ch in channels:
    subprocess.run([docker, "wait", f"rehearsal-client-{ch}"], capture_output=True)

print()
print("== 結果 ==")
print(f"  {'Ch':<6} {'視聴者':>6} {'受信':>10} {'合計':>11} {'1人あたり':>12} {'セグ':>6} {'エラー':>6}")
print("  " + "-" * 66)
tot_bytes = tot_segs = tot_errs = 0
for ch in channels:
    b = s = e = n = 0
    for f in sorted((OUT / ch).glob("c*")):
        bb, ss, ee = f.read_text().split()
        b += int(bb); s += int(ss); e += int(ee); n += 1
    mbps = b * 8 / args.duration / 1e6
    per = mbps / n if n else 0
    print(f"  {ch:<6} {n:>6} {b/1e6:>9.1f}MB {mbps:>9.1f}Mbps {per:>10.2f}Mbps {s:>6} {e:>6}")
    tot_bytes += b; tot_segs += s; tot_errs += e
print("  " + "-" * 66)
tm = tot_bytes * 8 / args.duration / 1e6
print(f"  {'合計':<6} {'':>6} {tot_bytes/1e6:>9.1f}MB {tm:>9.1f}Mbps {'':>12} {tot_segs:>6} {tot_errs:>6}")
print()
if tot_errs:
    print(f"  エラーが {tot_errs} 件あります。docker compose logs mediamtx で確認してください")
if tot_segs == 0:
    print("  セグメントを 1 つも取得できていません。publisher が動作しているか確認してください")
    print("     docker compose ps")

print()
print("  無線区間の律速は Wi-Fi の AP エアタイムであり、同一ホスト内のループバックでは再現できません。")
