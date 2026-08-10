#!/usr/bin/env bash
# 本部 OBS に入力する SRT URL 一覧を生成する。
#
# チャンネル定義（リポジトリ直下の config.json）とパスフレーズ
# （hosts/server/.env）から組み立てるので、手打ちミスが起きない。
#
#   ./srt-urls.sh                       # MediaMTX と OBS が同一ホスト
#   MTX_HOST=10.1.2.3 ./srt-urls.sh     # 別ホストの場合

set -euo pipefail

HOST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${HOST_DIR}/../.." && pwd)"

ENV_FILE="${ENV_FILE:-${REPO_DIR}/hosts/server/.env}"
CHANNELS="${REPO_DIR}/config.json"
MTX_HOST="${MTX_HOST:-127.0.0.1}"
MTX_PORT="${MTX_PORT:-8890}"
OBS_HOST="${OBS_HOST:-<OBSマシンのIP>}"
OUT_LATENCY="${OUT_LATENCY:-120000}"

[[ -f "${ENV_FILE}"  ]] || { echo "パスフレーズが読めない: ${ENV_FILE}" >&2; exit 1; }
[[ -f "${CHANNELS}"  ]] || { echo "チャンネル定義が無い: ${CHANNELS}" >&2; exit 1; }
command -v python3 >/dev/null || { echo "python3 が必要" >&2; exit 1; }

# shellcheck disable=SC1090
set -a; source "${ENV_FILE}"; set +a

python3 - "${CHANNELS}" "${MTX_HOST}" "${MTX_PORT}" "${OBS_HOST}" "${OUT_LATENCY}" <<'PY'
import json, os, sys

path, mtx_host, mtx_port, obs_host, out_latency = sys.argv[1:6]
conf = json.load(open(path, encoding="utf-8"))
chans = conf["channels"]
domain = conf["domain"]

def passphrase(cid):
    return os.environ.get(f"MTX_PATHS_{cid.upper()}_SRTPUBLISHPASSPHRASE", "<未設定>")

print("=" * 72)
print(" 1. OBS メディアソース（SRT Listener）… 現場からの受け口")
print("=" * 72)
for c in chans:
    if not c.get("obsListenPort"):
        print(f"\n[{c['label']}] {c['source']} … OBS 内で合成するため入力なし")
        continue
    print(f"\n[{c['label']}] {c['source']}")
    print(f"  srt://0.0.0.0:{c['obsListenPort']}?mode=listener"
          f"&passphrase={passphrase(c['id'])}&latency={c['srtLatencyUs']}")
    print(f"  → 現場側(Caller)には次を渡す:")
    print(f"    srt://{obs_host}:{c['obsListenPort']}"
          f"?passphrase={passphrase(c['id'])}&latency={c['srtLatencyUs']}")

print()
print("=" * 72)
print(" 2. obs-multi-rtmp の送出先（MediaMTX へ）")
print("=" * 72)
for c in chans:
    print(f"\n[{c['label']}] CBR {c['bitrateKbps']} kbps")
    print(f"  srt://{mtx_host}:{mtx_port}?streamid=publish:{c['id']}"
          f"&passphrase={passphrase(c['id'])}&latency={out_latency}")

print()
print("=" * 72)
print(" 3. 視聴 URL")
print("=" * 72)
for c in chans:
    print(f"  {c['label']:<18} https://{domain}/?ch={c['id']}")
print(f"  {'サイネージ':<16} https://{domain}/signage/")
PY
