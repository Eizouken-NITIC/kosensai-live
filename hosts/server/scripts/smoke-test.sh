#!/usr/bin/env bash
# 起動後の疎通確認。ffmpeg でテストパターンを SRT 送信し、Caddy 経由で HLS のプレイリストと
# セグメントを取得できるかを確認する。
#
#   ./scripts/smoke-test.sh [チャンネル] [秒数]

# 確認を最後まで実行するため -e は指定しない。異常は FAIL に集約して終了コードへ反映する。
set -uo pipefail

CH="${1:-ch1}"
SECS="${2:-30}"
HOST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "${HOST_DIR}/../.." && pwd)"
cd "${HOST_DIR}"

SRT_HOST="${SRT_HOST:-127.0.0.1}"
SRT_PORT="${SRT_PORT:-8890}"
DOMAIN="${DOMAIN:-$(python3 "${REPO_DIR}/tools/kosensai_live/config.py" get site.domain)}" || exit 1
JAR="$(mktemp)"

# MediaMTX は最初のプレイリスト要求へ、セッション Cookie を付与するための 302 を返す。
# 追跡には -L と Cookie jar が必要になる。
fetch() { curl -sS -L -c "${JAR}" -b "${JAR}" --max-time 10 "$@"; }

FFPID=""
cleanup() { [[ -n "${FFPID}" ]] && kill "${FFPID}" 2>/dev/null; rm -f "${JAR}"; }
trap cleanup EXIT

FAIL=0
ok() { printf '  \033[32mOK\033[0m   %s\n' "$1"; }
ng() { printf '  \033[31mNG\033[0m   %s\n' "$1"; FAIL=1; }

check() { # check <説明> <URL>
  local code
  code=$(fetch -o /dev/null -w '%{http_code}' "$2")
  [[ "${code}" == "200" ]] && ok "$1" || ng "$1 (http ${code})"
}

PASS="$(python3 "${REPO_DIR}/tools/kosensai_live/config.py" env "MTX_PATHS_$(printf '%s' "${CH}" | tr '[:lower:]' '[:upper:]')_SRTPUBLISHPASSPHRASE")" || exit 1

command -v ffmpeg >/dev/null || { echo "ffmpeg がありません" >&2; exit 1; }
ffmpeg -hide_banner -protocols 2>/dev/null | grep -qw srt \
  || { echo "この ffmpeg は SRT 非対応ビルドです" >&2; exit 1; }

echo "== ${CH} に ${SECS} 秒テストパターンを送出 =="
ffmpeg -hide_banner -loglevel warning \
  -re -f lavfi -i "testsrc2=size=1280x720:rate=30" \
  -f lavfi -i "sine=frequency=440:sample_rate=48000" \
  -t "${SECS}" \
  -c:v libx264 -preset veryfast -tune zerolatency -b:v 2500k -g 60 -pix_fmt yuv420p \
  -c:a aac -b:a 128k -ar 48000 \
  -f mpegts \
  "srt://${SRT_HOST}:${SRT_PORT}?streamid=publish:${CH}&passphrase=${PASS}&latency=120000" &
FFPID=$!

echo "  publish 開始とセグメント生成を待機しています…"
sleep 12

echo
echo "== MediaMTX 直（127.0.0.1:8888） =="
MASTER="$(fetch "http://127.0.0.1:8888/${CH}/index.m3u8")"
if grep -q '#EXT-X-STREAM-INF' <<<"${MASTER}"; then
  ok "マスタープレイリストを取得しました"
  grep -E 'RESOLUTION|CODECS' <<<"${MASTER}" | sed 's/^/       /'
else
  ng "MediaMTX が HLS を出力していません"
  echo "       docker compose logs mediamtx で確認してください（passphrase 不一致が最有力です）"
fi

VARIANT="$(grep -v '^#' <<<"${MASTER}" | grep -m1 '\.m3u8')"
if [[ -n "${VARIANT}" ]]; then
  SEG="$(fetch "http://127.0.0.1:8888/${CH}/${VARIANT}" | grep -v '^#' | grep -m1 '\.')"
  [[ -n "${SEG}" ]] && check "セグメント取得 (${SEG})" "http://127.0.0.1:8888/${CH}/${SEG}"
fi

echo
echo "== Caddy 経由（https://${DOMAIN}） =="
check "/healthz"              "https://${DOMAIN}/healthz"
check "/hls/${CH}/index.m3u8" "https://${DOMAIN}/hls/${CH}/index.m3u8"
check "/ (視聴ページ)"         "https://${DOMAIN}/"
check "/signage/ (サイネージ)" "https://${DOMAIN}/signage/"

if (( FAIL )); then
  echo
  echo "  名前解決が未設定の場合は、次のコマンドでローカルのみを確認できます"
  echo "    curl -k --resolve ${DOMAIN}:443:127.0.0.1 https://${DOMAIN}/hls/${CH}/index.m3u8"
fi

wait "${FFPID}" 2>/dev/null
FFPID=""

echo
if (( FAIL == 0 )); then
  echo "==> 全て OK です。ブラウザでも確認してください: https://${DOMAIN}/?ch=${CH}"
else
  echo "==> NG があります。"; exit 1
fi
