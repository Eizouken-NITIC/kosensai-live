#!/usr/bin/env bash
# リハーサル環境を立ち上げる。
#
#   ./scripts/up.sh          # サーバ + テストパターン4本
#   ./scripts/up.sh --idle   # サーバのみ（配信前の「待機中」表示を確認したいとき）

set -euo pipefail

REH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REH_DIR}"

DOMAIN="live.kosensai.ichinoseki.ac.jp"
PORT=8443
WITH_PUBLISHERS=1
[[ "${1:-}" == "--idle" ]] && WITH_PUBLISHERS=0

command -v docker >/dev/null || { echo "docker が必要" >&2; exit 1; }

# --- 自己署名証明書（本番は certbot の DNS-01。ここでは検証用） -------------
if [[ ! -f certs/fullchain.pem ]]; then
  echo "== 自己署名証明書を生成 =="
  mkdir -p certs
  openssl req -x509 -newkey rsa:2048 -nodes \
    -keyout certs/privkey.pem -out certs/fullchain.pem \
    -days 30 -subj "/CN=${DOMAIN}" \
    -addext "subjectAltName=DNS:${DOMAIN}" 2>/dev/null
  chmod 644 certs/fullchain.pem; chmod 640 certs/privkey.pem
  echo "  certs/ に生成した（30日有効・ブラウザは警告を出す）"
fi

# --- /etc/hosts の確認 -----------------------------------------------------
# 本番の Caddyfile はホスト名で site をマッチするので、名前が引けないと 404 になる。
if ! grep -qE "^[^#]*\b${DOMAIN}\b" /etc/hosts 2>/dev/null; then
  echo
  echo "⚠️  /etc/hosts に ${DOMAIN} が無い。ブラウザで開くには次の1行が要る:"
  echo
  echo "    127.0.0.1 ${DOMAIN}"
  echo
  echo "  追加するなら:  echo '127.0.0.1 ${DOMAIN}' | sudo tee -a /etc/hosts"
  echo "  （curl だけで確認するなら scripts/check.sh は --resolve を使うので不要）"
  echo
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
 視聴ページ   https://${DOMAIN}:${PORT}/
 サイネージ   https://${DOMAIN}:${PORT}/signage/
 Ch 直接開き  https://${DOMAIN}:${PORT}/?ch=ch3

 ※ 自己署名なのでブラウザは証明書警告を出す。詳細→続行 で開く。
 ※ /etc/hosts に 127.0.0.1 ${DOMAIN} が要る。

 疎通確認     ./scripts/check.sh
 負荷テスト   ./scripts/load-test.sh 20 ch1 30
 ログ         docker compose logs -f mediamtx
 停止         ./scripts/down.sh
============================================================
EOS
