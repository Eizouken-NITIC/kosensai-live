#!/usr/bin/env bash
# 起動後の疎通確認。ffmpeg でテストパターンを SRT publish し、
# Caddy 経由で HLS プレイリストとセグメントが取れるところまで確認する。
#
#   ./scripts/smoke-test.sh          # ch1 を 30 秒テスト
#   ./scripts/smoke-test.sh ch3 60   # ch3 を 60 秒テスト
#
# 前提: curl と、SRT 有効ビルドの ffmpeg。
#   ffmpeg -protocols | grep -w srt  で srt が出ること。
#   出ない場合は Docker 版で代用できる:
#     docker run --rm --network host jrottenberg/ffmpeg:7.1-ubuntu2404 ...

set -uo pipefail

CH="${1:-ch1}"
SECS="${2:-30}"
HOST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${HOST_DIR}"

SRT_HOST="${SRT_HOST:-127.0.0.1}"
SRT_PORT="${SRT_PORT:-8890}"
DOMAIN="${DOMAIN:-live.kosensai.ichinoseki.ac.jp}"
JAR="$(mktemp)"

# ⚠️ MediaMTX は最初のプレイリスト要求を ?cookieCheck=1 付き URL へ 302 し、
#    セッション Cookie を張る。-L と Cookie jar が無いと 404 に見えるので注意。
fetch() { curl -sS -L -c "${JAR}" -b "${JAR}" --max-time 10 "$@"; }

FFPID=""
cleanup() { [[ -n "${FFPID}" ]] && kill "${FFPID}" 2>/dev/null; rm -f "${JAR}"; }
trap cleanup EXIT

[[ -f .env ]] || { echo ".env が無い（cp .env.example .env）" >&2; exit 1; }
# shellcheck disable=SC1091
set -a; source .env; set +a

var="MTX_PATHS_$(printf '%s' "${CH}" | tr '[:lower:]' '[:upper:]')_SRTPUBLISHPASSPHRASE"
PASS="${!var:-}"
[[ -n "${PASS}" ]] || { echo "${var} が .env に無い" >&2; exit 1; }

command -v ffmpeg >/dev/null || { echo "ffmpeg が無い" >&2; exit 1; }
ffmpeg -hide_banner -protocols 2>/dev/null | grep -qw srt \
  || { echo "この ffmpeg は SRT 非対応ビルド" >&2; exit 1; }

FAIL=0
check() { # check <説明> <URL>
  local desc="$1" url="$2" code
  code=$(curl -sS -L -c "${JAR}" -b "${JAR}" --max-time 10 -o /dev/null -w '%{http_code}' "${url}")
  if [[ "${code}" == "200" ]]; then
    printf '  \033[32mOK\033[0m   %s\n' "${desc}"
  else
    printf '  \033[31mNG\033[0m   %s (http %s)\n' "${desc}" "${code}"; FAIL=1
  fi
}

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

echo "  publish 開始とセグメント生成を待機中…"
sleep 12

echo
echo "== MediaMTX 直（127.0.0.1:8888） =="
MASTER="$(fetch "http://127.0.0.1:8888/${CH}/index.m3u8")"
if grep -q '#EXT-X-STREAM-INF' <<<"${MASTER}"; then
  printf '  \033[32mOK\033[0m   マスタープレイリスト取得\n'
  grep -E 'RESOLUTION|CODECS' <<<"${MASTER}" | sed 's/^/       /'
else
  printf '  \033[31mNG\033[0m   MediaMTX が HLS を出していない\n'
  echo "       docker compose logs mediamtx を確認（passphrase 不一致が最有力）"
  FAIL=1
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
  echo "  ヒント: 名前解決がまだならローカルだけで確かめられる"
  echo "    curl -k --resolve ${DOMAIN}:443:127.0.0.1 https://${DOMAIN}/hls/${CH}/index.m3u8"
fi

wait "${FFPID}" 2>/dev/null
FFPID=""

echo
if (( FAIL == 0 )); then
  echo "==> 全て OK。ブラウザでも確認: https://${DOMAIN}/?ch=${CH}"
else
  echo "==> NG があります。"; exit 1
fi
