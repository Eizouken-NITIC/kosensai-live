#!/usr/bin/env python3
"""config.json と .env を読み込み、検証する。

app 以外で config.json と .env を読むコードは、このモジュールに集約する。
Python のスクリプトは import し、シェルスクリプトは CLI で値を取得する。

  python3 tools/config.py get site.domain          # config.json の値
  python3 tools/config.py channels [--listen]      # Ch の id を 1 行 1 件で
  python3 tools/config.py env HQ_IP                # .env の値
  python3 tools/config.py check [--server]         # .env と config.json の整合性を検証する

.env は既定で hosts/server/.env を読む。--env で別のファイルを指定できる。
配信サーバーの compose の init サービスは `check --server --write-site-env` を実行する。
"""

import argparse
import ipaddress
import json
import pathlib
import re
import ssl
import sys
import time

REPO = pathlib.Path(__file__).resolve().parent.parent
CONFIG_JSON = REPO / "config.json"
ENV_FILE = REPO / "hosts/server/.env"
SERVER_DIR = REPO / "hosts/server"

# SRT のパスフレーズの長さの制約
PASSPHRASE_MIN, PASSPHRASE_MAX = 10, 79
# 証明書の期限がこの日数を切ったら WARN にする
CERT_WARN_DAYS = 3
# SRT の再送バッファに必要な net.core.rmem_max
RMEM_MIN = 26214400


def load_config(path=CONFIG_JSON):
    return json.loads(pathlib.Path(path).read_text(encoding="utf-8"))


def channel_ids(conf, listen=False):
    """Ch の id。listen=True のときは本部 OBS が SRT Listener で受ける Ch（obsListenPort を持つ Ch）だけ。"""
    return [c["id"] for c in conf["channels"] if not listen or c.get("obsListenPort")]


def channel(conf, cid):
    for c in conf["channels"]:
        if c["id"] == cid:
            return c
    raise KeyError(f"config.json に Ch {cid} がありません")


def load_env(path=ENV_FILE):
    """docker compose の .env と同じ KEY=VALUE 形式を読む。"""
    path = pathlib.Path(path)
    if not path.is_file():
        raise SystemExit(f"{path} がありません（.env.example をコピーして実値を入れてください）")
    env = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        key, sep, value = line.removeprefix("export ").partition("=")
        if not sep:
            raise SystemExit(f"{path}: KEY=VALUE の形式ではない行があります: {line}")
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "'\"":
            value = value[1:-1]
        env[key.strip()] = value
    return env


def require(env, key):
    if not env.get(key):
        raise SystemExit(f"{key} が .env に設定されていません")
    return env[key]


def publish_var(cid):
    """本部 OBS → 配信サーバーのパスフレーズ。MediaMTX はこの変数からパスを作成する。"""
    return f"MTX_PATHS_{cid.upper()}_SRTPUBLISHPASSPHRASE"


def listen_var(cid):
    """ATEM・スマートフォン → 本部 OBS のパスフレーズ。"""
    return f"OBS_{cid.upper()}_LISTEN_PASSPHRASE"


# --- 検証 ------------------------------------------------------------------
# 各関数は (結果, 説明) を返す。結果は "OK" / "WARN" / "NG"。


def check_passphrase(env, key):
    val = env.get(key, "")
    if not val:
        return "NG", f"{key} が設定されていません"
    if val.startswith("CHANGEME"):
        return "NG", f"{key} がサンプル値のままです"
    if not PASSPHRASE_MIN <= len(val) <= PASSPHRASE_MAX:
        return "NG", f"{key} は {PASSPHRASE_MIN}〜{PASSPHRASE_MAX} 文字にしてください（現在 {len(val)} 文字）"
    return "OK", f"{key} ({len(val)} 文字)"


def check_channels_env(conf, env):
    ids = channel_ids(conf)
    listen_ids = channel_ids(conf, listen=True)
    results = [check_passphrase(env, publish_var(c)) for c in ids]
    results += [check_passphrase(env, listen_var(c)) for c in listen_ids]

    # MediaMTX は MTX_PATHS_<名前>_* からパスを作成するため、config.json に無い Ch の変数は
    # 公開されないパスを作成してしまう。
    for key in env:
        m = re.fullmatch(r"MTX_PATHS_([A-Z0-9]+)_\w+", key)
        if m and m.group(1).lower() not in ids:
            results.append(("NG", f"{key} の Ch {m.group(1).lower()} は config.json にありません"))

    values = [env.get(publish_var(c)) for c in ids]
    if len(set(values)) == len(values):
        results.append(("OK", "Ch ごとに別のパスフレーズを使用しています"))
    else:
        results.append(("WARN", "同じパスフレーズを複数の Ch で使用しています"))

    # ATEM・スマートフォンに設定する値で配信サーバーへ送出できると、本部 OBS を通さずに
    # 公開 Ch へ映像を流せてしまう。
    for c in listen_ids:
        if env.get(listen_var(c)) and env.get(listen_var(c)) == env.get(publish_var(c)):
            results.append(("NG", f"{listen_var(c)} が {publish_var(c)} と同じ値です。受信用は別の値にしてください"))
    return results


def check_ipv4(env, key):
    try:
        ipaddress.IPv4Address(env.get(key, ""))
    except ValueError:
        return "NG", f"{key} に IPv4 アドレスを設定してください（現在: {env.get(key) or '未設定'}）"
    return "OK", f"{key}={env[key]}"


def require_ipv4(env, key):
    status, text = check_ipv4(env, key)
    if status == "NG":
        raise SystemExit(text)
    return env[key]


def check_web(repo=REPO):
    web = repo / "web"
    results = []
    for f in ["index.html", "signage/index.html", "_app/immutable"]:
        if (web / f).exists():
            results.append(("OK", f"web/{f}"))
        else:
            results.append(("NG", f"web/{f} がありません（cd app && pnpm build を実行してください）"))
    # 配布物にはライセンス本文の同梱が必要である。
    for f in ["hls.js-Apache-2.0.txt", "media-chrome-MIT.txt", "noto-sans-jp-OFL-1.1.txt"]:
        p = web / "licenses" / f
        results.append(("OK", f"web/licenses/{f}") if p.is_file() else ("NG", f"web/licenses/{f} がありません"))
    return results


def check_cert(cert_dir, domain):
    cert, key = pathlib.Path(cert_dir) / "fullchain.pem", pathlib.Path(cert_dir) / "privkey.pem"
    if not (cert.is_file() and key.is_file()):
        return [("NG", "certs/ に証明書がありません（sudo ./scripts/get-cert.sh を実行してください）")]
    try:
        # 証明書と秘密鍵の組み合わせも検証する
        ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER).load_cert_chain(cert, key)
    except (ssl.SSLError, OSError) as e:
        return [("NG", f"certs/ の証明書と秘密鍵を読み込めません: {e}")]
    # 標準ライブラリで証明書の中身を取得する手段はこの関数だけである。cryptography を使用すると
    # init のイメージに pip install が必要になる。
    info = ssl._ssl._test_decode_cert(str(cert))
    results = []
    names = [v for k, v in info.get("subjectAltName", ()) if k == "DNS"]
    if domain in names:
        results.append(("OK", f"証明書のホスト名 {domain}"))
    else:
        results.append(("NG", f"証明書のホスト名 {names} に config.json の {domain} が含まれていません"))
    left = (ssl.cert_time_to_seconds(info["notAfter"]) - time.time()) / 86400
    if left <= 0:
        results.append(("NG", f"証明書が失効しています（{info['notAfter']}）"))
    elif left <= CERT_WARN_DAYS:
        results.append(("WARN", f"証明書が {left:.1f} 日後に失効します。scripts/get-cert.sh で取り直してください"))
    else:
        results.append(("OK", f"証明書の有効期限 {info['notAfter']}"))
    return results


def check_rmem():
    p = pathlib.Path("/proc/sys/net/core/rmem_max")
    if not p.is_file():
        return "WARN", "net.core.rmem_max を読めないため、確認をスキップします"
    rmem = int(p.read_text())
    if rmem >= RMEM_MIN:
        return "OK", f"net.core.rmem_max={rmem}"
    return "WARN", (f"net.core.rmem_max={rmem}（SRT の再送バッファを確保するため、"
                    f"sysctl -w net.core.rmem_max={RMEM_MIN} の実行を推奨します）")


def print_section(title, results):
    colors = {"OK": "32", "WARN": "33", "NG": "31"}
    print(f"== {title} ==")
    for status, text in results:
        print(f"  \033[{colors[status]}m{status:<4}\033[0m {text}")
    print()
    return all(status != "NG" for status, _ in results)


def cmd_check(args):
    conf = load_config()
    env = load_env(args.env)
    ok = print_section(".env / パスフレーズ", check_channels_env(conf, env))
    if args.server:
        ok &= print_section(".env / 接続元の制限", [check_ipv4(env, "HQ_IP")])
        ok &= print_section("配信サイト (web/)", check_web())
        ok &= print_section("証明書", check_cert(args.certs, conf["site"]["domain"]))
        ok &= print_section("ホスト設定", [check_rmem()])
    if not ok:
        print("==> NG があります。解消してから起動してください。")
        sys.exit(1)
    if args.write_site_env:
        # Caddy は --envfile でこのファイルを読み、Caddyfile の {$SITE_DOMAIN} を置換する
        pathlib.Path(args.write_site_env).write_text(f"SITE_DOMAIN={conf['site']['domain']}\n", encoding="utf-8")
        print(f"{args.write_site_env} を書き出しました")
    print("==> OK")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--env", default=ENV_FILE, help=f".env のパス（既定: {ENV_FILE.relative_to(REPO)}）")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("get", help="config.json の値を表示する")
    p.add_argument("key", help=". 区切りのキー（例: site.domain）")

    p = sub.add_parser("channels", help="Ch の id を 1 行 1 件で表示する")
    p.add_argument("--listen", action="store_true", help="本部 OBS が SRT Listener で受ける Ch だけ")

    p = sub.add_parser("env", help=".env の値を表示する")
    p.add_argument("key")

    p = sub.add_parser("check", help=".env と config.json を検証する")
    p.add_argument("--server", action="store_true", help="配信サーバーの起動条件（HQ_IP・web/・証明書・sysctl）も検証する")
    p.add_argument("--certs", default=SERVER_DIR / "certs", help="証明書のディレクトリ")
    p.add_argument("--write-site-env", metavar="PATH", help="検証に通ったら Caddy 用の SITE_DOMAIN を書き出す")

    args = ap.parse_args()
    if args.cmd == "get":
        value = load_config()
        for k in args.key.split("."):
            value = value[int(k)] if isinstance(value, list) else value[k]
        print(value if isinstance(value, (str, int, float)) else json.dumps(value, ensure_ascii=False))
    elif args.cmd == "channels":
        print("\n".join(channel_ids(load_config(), listen=args.listen)))
    elif args.cmd == "env":
        print(require(load_env(args.env), args.key))
    elif args.cmd == "check":
        cmd_check(args)


if __name__ == "__main__":
    main()
