#!/usr/bin/env bash
# Let's Encrypt の証明書を DNS-01 チャレンジ（手動）で取得し、certs/ へ配置する。

set -euo pipefail

HOST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "${HOST_DIR}/../.." && pwd)"
DEST="${HOST_DIR}/certs"

# shellcheck source=../../../tools/config.sh
. "${REPO_DIR}/tools/config.sh"

DOMAIN="${DOMAIN:-$(config_domain)}"

if [[ $EUID -ne 0 ]]; then
  echo "root 権限が必要です。sudo で実行してください。" >&2
  exit 1
fi

command -v certbot >/dev/null || { echo "certbot が見つかりません（apt install certbot を実行してください）" >&2; exit 1; }

cat <<EOS

 ${DOMAIN} の証明書を DNS-01 チャレンジで取得します。

 このあと certbot が _acme-challenge.${DOMAIN} に登録すべき TXT レコード値を表示します。
 その値を DNS 管理者へ登録依頼し、

     dig TXT _acme-challenge.${DOMAIN} +short

 で値が返ることを確認してから Enter を押してください。
 伝播前に Enter を押した場合は最初からやり直しになります。

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
