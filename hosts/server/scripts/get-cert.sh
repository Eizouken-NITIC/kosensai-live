#!/usr/bin/env bash
# Let's Encrypt 証明書を DNS-01（手動）で取得し、certs/ に配置する。
#
# 学内プライベート IP のため HTTP-01 は使えない。
# certbot が出す TXT レコード値を総合情報センターに登録依頼する運用のため、
# 途中で必ず「待ち」が入る。本番前日に余裕を持って実行すること。
#
# 実運用が3日のため自動更新は不要（LE 証明書は 90 日有効）。
#
#   sudo ./scripts/get-cert.sh

set -euo pipefail

HOST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "${HOST_DIR}/../.." && pwd)"
DEST="${HOST_DIR}/certs"
DOMAIN="${DOMAIN:-$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["site"]["domain"])' "${REPO_DIR}/config.json")}"

if [[ $EUID -ne 0 ]]; then
  echo "certbot と /etc/letsencrypt へのアクセスに root 権限が必要です。sudo で実行してください。" >&2
  exit 1
fi

command -v certbot >/dev/null || { echo "certbot が見つかりません: apt install certbot" >&2; exit 1; }

cat <<EOS

============================================================
 ${DOMAIN} の証明書を DNS-01 チャレンジで取得します。

 このあと certbot が
     _acme-challenge.${DOMAIN}
 に登録すべき TXT レコード値を表示します。

 その値を総合情報センターへ登録依頼し、

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
