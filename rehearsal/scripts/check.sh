#!/usr/bin/env bash
# リハーサル環境の疎通をひととおり確認する。
# /etc/hosts をいじらなくても動くよう curl の --resolve を使う。
#
#   ./scripts/check.sh

set -uo pipefail

REH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REH_DIR}"

DOMAIN="live.kosensai.ichinoseki.ac.jp"
PORT=8443
BASE="https://${DOMAIN}:${PORT}"
JAR="$(mktemp)"
trap 'rm -f "${JAR}"' EXIT

# 自己署名なので -k。MediaMTX の cookieCheck 302 を追うため -L と Cookie jar。
C() { curl -sk -L -c "${JAR}" -b "${JAR}" --resolve "${DOMAIN}:${PORT}:127.0.0.1" --max-time 10 "$@"; }

FAIL=0
ok() { printf '  \033[32mOK\033[0m   %s\n' "$1"; }
ng() { printf '  \033[31mNG\033[0m   %s\n' "$1"; FAIL=1; }

code() { # code <path>
  C -o /dev/null -w '%{http_code}' "${BASE}$1"
}

echo "== 静的配信 =="
for p in / /signage/ /config.json /assets/theme.css /assets/viewer.css \
         /assets/signage.css /assets/player.js /vendor/hls.min.js /healthz; do
  c=$(code "$p")
  [[ "$c" == "200" ]] && ok "$p" || ng "$p (http $c)"
done

echo
echo "== HLS（Ch ごと） =="
for ch in $(python3 -c "
import json;print(' '.join(c['id'] for c in json.load(open('../web/config.json'))['channels']))" 2>/dev/null || echo "ch1 ch2 ch3 ch4"); do
  master="$(C "${BASE}/hls/${ch}/index.m3u8")"
  if grep -q '#EXT-X-STREAM-INF' <<<"${master}"; then
    res=$(grep -oE 'RESOLUTION=[0-9x]+' <<<"${master}" | head -1)
    var="$(grep -v '^#' <<<"${master}" | grep -m1 '\.m3u8')"
    seg="$(C "${BASE}/hls/${ch}/${var}" | grep -v '^#' | grep -m1 '\.')"
    if [[ -n "${seg}" ]]; then
      sz=$(C -o /dev/null -w '%{size_download}' "${BASE}/hls/${ch}/${seg}")
      ok "${ch}  ${res}  セグメント ${sz} バイト"
    else
      ng "${ch}  プレイリストは取れるがセグメントが無い"
    fi
  else
    ng "${ch}  配信されていない（publisher 停止中なら正常）"
  fi
done

echo
echo "== 本番設定をそのまま使えているか =="
# Caddyfile の Location 書き戻しが効いているか（これが無いと映像が始まらない）
loc=$(curl -sk -o /dev/null -w '%{redirect_url}' --resolve "${DOMAIN}:${PORT}:127.0.0.1" \
      "${BASE}/hls/ch1/index.m3u8")
case "${loc}" in
  *"/hls/ch1/index.m3u8?cookieCheck=1") ok "302 Location に /hls が付いている" ;;
  "")                                   ok "302 なし（セッション確立済み）" ;;
  *)                                    ng "302 Location が想定外: ${loc}" ;;
esac
# MediaMTX のキャッシュヘッダが Caddy に潰されていないか
cc=$(curl -sk -D- -o /dev/null -L -c "${JAR}" -b "${JAR}" --resolve "${DOMAIN}:${PORT}:127.0.0.1" \
     "${BASE}/hls/ch1/index.m3u8" | grep -i '^cache-control' | tail -1 | tr -d '\r')
[[ "${cc}" == *"private, no-cache"* ]] && ok "MediaMTX の ${cc#*: } が素通しになっている" \
                                       || ng "cache-control が想定外: ${cc:-なし}"

echo
(( FAIL == 0 )) && echo "==> 全て OK" || { echo "==> NG あり"; exit 1; }
