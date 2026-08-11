#!/bin/sh
# 視聴クライアントを模擬する。
# hls.js と同じ手順（マスタープレイリスト → variant → セグメント順次取得）を
# curl で再現し、N 本並列で回して合計スループットとエラー数を算出する。
#
# 環境変数:
#   CLIENTS  同時視聴者数（既定 10）
#   CH       対象チャンネル（既定 ch1）
#   DURATION 実行秒数（既定 30）
#   DOMAIN   必須（load-test.sh が config.json から渡す）
#
# 結果は /out/c<i> に "バイト数 セグメント数 エラー数" 形式で書く。

set -u

CLIENTS="${CLIENTS:-10}"
CH="${CH:-ch1}"
DURATION="${DURATION:-30}"
DOMAIN="${DOMAIN:?DOMAIN is required}"
BASE="https://${DOMAIN}"

# 自己署名なので -k。cookieCheck の 302 を追うため -L と Cookie jar。
# Caddy は同じネットワーク名前空間の 127.0.0.1:443。
CURL="curl -sk -L --resolve ${DOMAIN}:443:127.0.0.1 --max-time 15"

mkdir -p /out
rm -f /out/c* 2>/dev/null

client() {
  i="$1"
  jar="/tmp/jar.$i"
  bytes=0; segs=0; errs=0

  master=$($CURL -c "$jar" -b "$jar" "${BASE}/hls/${CH}/index.m3u8" 2>/dev/null)
  var=$(printf '%s\n' "$master" | grep -v '^#' | grep -m1 '\.m3u8')
  if [ -z "$var" ]; then
    echo "0 0 1" > "/out/c$i"
    return
  fi

  seen=""
  end=$(( $(date +%s) + DURATION ))
  while [ "$(date +%s)" -lt "$end" ]; do
    pl=$($CURL -c "$jar" -b "$jar" "${BASE}/hls/${CH}/${var}" 2>/dev/null)
    if [ -z "$pl" ]; then
      errs=$((errs + 1)); sleep 2; continue
    fi
    for s in $(printf '%s\n' "$pl" | grep -v '^#' | grep '\.'); do
      case " $seen " in *" $s "*) continue ;; esac
      seen="$seen $s"
      n=$($CURL -c "$jar" -b "$jar" -o /dev/null -w '%{size_download}' \
          "${BASE}/hls/${CH}/${s}" 2>/dev/null)
      case "$n" in
        ''|*[!0-9]*) errs=$((errs + 1)) ;;
        0)           errs=$((errs + 1)) ;;
        *)           bytes=$((bytes + n)); segs=$((segs + 1)) ;;
      esac
    done
    # 見たセグメント名の記憶は直近だけで足りる（プレイリストは3本しか持たない）
    seen=$(printf '%s' "$seen" | tr ' ' '\n' | tail -20 | tr '\n' ' ')
    sleep 3
  done

  echo "$bytes $segs $errs" > "/out/c$i"
}

echo "clients=${CLIENTS} ch=${CH} duration=${DURATION}s"
i=1
while [ "$i" -le "$CLIENTS" ]; do
  client "$i" &
  i=$((i + 1))
done
wait
echo "done"
