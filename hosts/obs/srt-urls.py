"""本部 OBS の SRT の URL 一覧を生成する。

Ch の定義は config.json から、パスフレーズと IP は .env（既定: hosts/server/.env）から読み込む。

  uv run hosts/obs/srt-urls.py
  uv run hosts/obs/srt-urls.py --env path/to/.env
"""

import argparse
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "tools"))
import config  # noqa: E402

# 配信サーバーの SRT の待受ポート（hosts/server/mediamtx.yml の srtAddress）
MTX_PORT = 8890
# 本部 OBS → 配信サーバーの SRT の latency（マイクロ秒）
OUT_LATENCY_US = 120000

ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument("--env", default=config.ENV_FILE, help=".env のパス")
args = ap.parse_args()

conf = config.load_config()
env = config.load_env(args.env)
hq_ip = config.require_ipv4(env, "HQ_IP")
server_ip = config.require_ipv4(env, "SERVER_IP")
domain = conf["site"]["domain"]

print("=" * 72)
print(" 1. OBS メディアソース（SRT Listener）… ATEM・スマートフォンからの受け口")
print("=" * 72)
for c in conf["channels"]:
    if not c.get("obsListenPort"):
        print(f"\n[{c['label']}] OBS 内で合成するため入力はありません")
        continue
    port, latency_us = c["obsListenPort"], c["srtLatencyUs"]
    passphrase = config.require(env, config.listen_var(c["id"]))
    print(f"\n[{c['label']}]")
    # OBS のメディアソース（FFmpeg の SRT）の latency はマイクロ秒
    print(f"  srt://0.0.0.0:{port}?mode=listener&passphrase={passphrase}&latency={latency_us}")
    print("  → 送信側(Caller)に設定する値:")
    print(f"    URL          srt://{hq_ip}:{port}")
    print(f"    パスフレーズ {passphrase}")
    # ATEM は URL のクエリを無視するため、パスフレーズは専用の欄に入れる。
    # Moblin（libsrt の URL）の latency はミリ秒
    print(f"    URL 1 本で指定する端末（Moblin）: srt://{hq_ip}:{port}"
          f"?passphrase={passphrase}&latency={latency_us // 1000}")

print()
print("=" * 72)
print(" 2. obs-multi-rtmp の送出先（配信サーバーへ）")
print("=" * 72)
for c in conf["channels"]:
    passphrase = config.require(env, config.publish_var(c["id"]))
    print(f"\n[{c['label']}] CBR {c['bitrateKbps']} kbps")
    print(f"  srt://{server_ip}:{MTX_PORT}?streamid=publish:{c['id']}"
          f"&passphrase={passphrase}&latency={OUT_LATENCY_US}")

print()
print("=" * 72)
print(" 3. 視聴 URL")
print("=" * 72)
for c in conf["channels"]:
    print(f"  {c['label']:<18} https://{domain}/?ch={c['id']}")
print(f"  {'サイネージ':<16} https://{domain}/signage/")
