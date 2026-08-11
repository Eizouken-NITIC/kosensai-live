#!/usr/bin/env bash
# リハーサル環境を立ち上げる。
#
#   ./scripts/up.sh          # サーバ + テストパターン4本
#   ./scripts/up.sh --idle   # サーバのみ（配信前の「待機中」表示を確認したいとき）

set -euo pipefail

REH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REH_DIR}"

DOMAIN="${DOMAIN:-$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["site"]["domain"])' ../config.json)}"
PORT=8443
PREVIEW_PORT=8080
PREVIEW_TLS_PORT=8444
WITH_PUBLISHERS=1
[[ "${1:-}" == "--idle" ]] && WITH_PUBLISHERS=0

command -v docker >/dev/null || { echo "docker が必要です" >&2; exit 1; }

# compose.yml と preview.Caddyfile が参照する環境変数を書き出す
echo "DOMAIN=${DOMAIN}" > .env

# --- 実機から開くための宛先 -------------------------------------------------
# LAN の実機（スマホ等）で確かめるには TLS で開くほかにない。MediaMTX が張る
# HLS のセッション Cookie に Secure が付いており、ブラウザは安全なコンテキスト
# でしか保存しないため、平文の http では localhost 以外で再生が始まらない。
# そこで、この PC の LAN アドレスと mDNS 名を証明書の SAN へ入れる。
lan_addrs() {
  {
    if command -v ifconfig >/dev/null 2>&1; then
      ifconfig 2>/dev/null | awk '/inet /{print $2}'
    else
      ip -4 -o addr show 2>/dev/null | awk '{print $4}' | cut -d/ -f1
    fi
  } | grep -v '^127\.' | sort -u
}

MDNS="$(hostname -s 2>/dev/null || true).local"
ADDRS="$(lan_addrs)"

SAN="DNS:${DOMAIN}"
[[ "${MDNS}" != ".local" ]] && SAN="${SAN},DNS:${MDNS}"
for ip in ${ADDRS}; do
  SAN="${SAN},IP:${ip}"
done

# --- 自己署名証明書（本番は certbot の DNS-01。ここでは検証用） -------------
# 接続するネットワークが変わると LAN アドレスも変わるため、前回の SAN と
# 違えば作り直す。openssl の出力は表記が揺れるので、使った値を控えて比べる。
CERT_STALE=0
if [[ ! -f certs/fullchain.pem || "$(cat certs/.san 2>/dev/null || true)" != "${SAN}" ]]; then
  echo "== 自己署名証明書を生成 =="
  mkdir -p certs
  openssl req -x509 -newkey rsa:2048 -nodes \
    -keyout certs/privkey.pem -out certs/fullchain.pem \
    -days 30 -subj "/CN=${DOMAIN}" \
    -addext "subjectAltName=${SAN}" 2>/dev/null
  chmod 644 certs/fullchain.pem; chmod 640 certs/privkey.pem
  printf '%s' "${SAN}" > certs/.san
  CERT_STALE=1
  echo "  ${SAN}"
  echo "  （30日有効・自己署名のためブラウザは警告を出します）"
fi

# --- 起動 ------------------------------------------------------------------
echo "== 起動 =="
if (( WITH_PUBLISHERS )); then
  docker compose --profile publish up -d
else
  docker compose up -d
fi

# Caddy は起動時に証明書を読むため、作り直した場合は入れ替える
if (( CERT_STALE )); then
  docker compose up -d --force-recreate caddy preview >/dev/null
fi

echo
echo "== 状態 =="
docker compose --profile publish ps --format '  {{.Name}}\t{{.State}}'

if (( WITH_PUBLISHERS )); then
  echo
  echo "  セグメント生成を待機中…"
  sleep 12
fi

cat <<EOS

============================================================
 この PC のブラウザで開く（証明書の警告なし）

   視聴ページ   http://localhost:${PREVIEW_PORT}/
   サイネージ   http://localhost:${PREVIEW_PORT}/signage/
   Ch 直接開き  http://localhost:${PREVIEW_PORT}/?ch=ch3
============================================================
EOS

if [[ -n "${ADDRS}" || "${MDNS}" != ".local" ]]; then
  cat <<EOS

============================================================
 LAN の実機（スマホ等）から開く

   自己署名証明書のため警告が出ます。「詳細設定」から進んでください。
   平文の http では再生が始まりません（HLS の Cookie に Secure が付くため）。
EOS
  [[ "${MDNS}" != ".local" ]] && echo "   https://${MDNS}:${PREVIEW_TLS_PORT}/"
  for ip in ${ADDRS}; do
    echo "   https://${ip}:${PREVIEW_TLS_PORT}/"
  done
  echo "============================================================"
fi

cat <<EOS

 負荷テスト   ./scripts/load-test.sh 20 ch1 30
 ログ         docker compose logs -f mediamtx
 停止         ./scripts/down.sh

 本番と同じホスト名・TLS で開きたい場合は、/etc/hosts に
 「127.0.0.1 ${DOMAIN}」を追記して https://${DOMAIN}:${PORT}/ を開いてください。
EOS
