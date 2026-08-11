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
WITH_PUBLISHERS=1
[[ "${1:-}" == "--idle" ]] && WITH_PUBLISHERS=0

command -v docker >/dev/null || { echo "docker が必要です" >&2; exit 1; }

# compose.yml と preview.Caddyfile が参照する環境変数を書き出す
echo "DOMAIN=${DOMAIN}" > .env

# --- 自己署名証明書（本番は certbot の DNS-01。ここでは検証用） -------------
if [[ ! -f certs/fullchain.pem ]]; then
  echo "== 自己署名証明書を生成 =="
  mkdir -p certs
  openssl req -x509 -newkey rsa:2048 -nodes \
    -keyout certs/privkey.pem -out certs/fullchain.pem \
    -days 30 -subj "/CN=${DOMAIN}" \
    -addext "subjectAltName=DNS:${DOMAIN}" 2>/dev/null
  chmod 644 certs/fullchain.pem; chmod 640 certs/privkey.pem
  echo "  certs/ に生成しました（30日有効・ブラウザは警告を出します）"
fi

# --- 起動 ------------------------------------------------------------------
echo "== 起動 =="
if (( WITH_PUBLISHERS )); then
  docker compose --profile publish up -d
else
  docker compose up -d
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
 ブラウザで開く（/etc/hosts の変更も証明書の警告も不要）

   視聴ページ   http://localhost:${PREVIEW_PORT}/
   サイネージ   http://localhost:${PREVIEW_PORT}/signage/
   Ch 直接開き  http://localhost:${PREVIEW_PORT}/?ch=ch3

 ------------------------------------------------------------
 負荷テスト   ./scripts/load-test.sh 20 ch1 30
 ログ         docker compose logs -f mediamtx
 停止         ./scripts/down.sh
============================================================

 本番と同じホスト名・TLS で開きたい場合は、/etc/hosts に
 「127.0.0.1 ${DOMAIN}」を追記して https://${DOMAIN}:${PORT}/ を開いてください。
EOS
