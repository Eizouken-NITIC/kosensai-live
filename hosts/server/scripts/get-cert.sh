#!/usr/bin/env bash
# Let's Encrypt証明書をDNS-01チャレンジ（手動）で取得し、certs/に配置するスクリプト
# ※学内プライベートIPのためHTTP-01は使用不可
#
#   sudo ./scripts/get-cert.sh

set -euo pipefail

HOST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "${HOST_DIR}/../.." && pwd)"
DEST="${HOST_DIR}/certs"
DOMAIN="${DOMAIN:-$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["site"]["domain"])' "${REPO_DIR}/config.json")}"

if [[ $EUID -ne 0 ]]; then
  echo "root権限が必要です。sudoで実行してください。" >&2
  exit 1
fi

command -v certbot >/dev/null || { echo "certbotが見つかりません（apt install certbotを実行してください）" >&2; exit 1; }

cat <<EOS

============================================================
 ${DOMAIN} の証明書を DNS-01 チャレンジで取得します。

 このあと certbot が
     _acme-challenge.${DOMAIN}
 に登録すべき TXT レコード値を表示します。

 その値を DNS 管理者へ登録依頼し、

     dig TXT _acme-challenge.${DOMAIN} +short

 で値が返ることを確認してから Enter を押してください。
 （伝播前に Enter を押すと最初からやり直しになります）
============================================================

EOS

certbot certonly \
  --manual \
  --preferred-challenges dns \
  --agree-tos \
  --no-eff-email \
  -d "${DOMAIN}"

SRC="/etc/letsencrypt/live/${DOMAIN}"
[[ -f "${SRC}/fullchain.pem" ]] || { echo "証明書が見つかりません: ${SRC}" >&2; exit 1; }

mkdir -p "${DEST}"
cp -L "${SRC}/fullchain.pem" "${SRC}/privkey.pem" "${DEST}/"
chmod 644 "${DEST}/fullchain.pem"
chmod 640 "${DEST}/privkey.pem"

echo
echo "配置しました: ${DEST}"
openssl x509 -in "${DEST}/fullchain.pem" -noout -subject -dates

echo
echo "Caddy を再起動して反映します: docker compose restart caddy"
