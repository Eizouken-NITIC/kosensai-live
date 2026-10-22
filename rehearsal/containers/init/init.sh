#!/usr/bin/env bash
# リハーサル環境の前準備。compose が MediaMTX と 2 つの Caddy より先に一度だけ実行する。

set -euo pipefail

# rehearsal.env を本番と同じ規則で検証し、Caddy 用の SITE_DOMAIN を書き出す。
python3 /repo/tools/kosensai_live/config.py --env /repo/rehearsal/rehearsal.env check --write-site-env /caddy/site.env

DOMAIN="$(python3 /repo/tools/kosensai_live/config.py get site.domain)"
CERT=/certs/fullchain.pem
KEY=/certs/privkey.pem

# 本番の Caddyfile が証明書のパスを直接指定しているため、リハーサルでも実体が必要になる。
# ブラウザが一度受け入れた証明書の例外を無効にしないため、期限内かつホスト名が一致して
# いる場合は再生成しない。
if openssl x509 -in "${CERT}" -noout -checkend 0 2>/dev/null &&
  openssl x509 -in "${CERT}" -noout -ext subjectAltName 2>/dev/null | grep -q "DNS:${DOMAIN}"; then
  echo "証明書を再利用する（${DOMAIN}）"
else
  echo "自己署名証明書を生成する（${DOMAIN}・30日有効）"
  openssl req -x509 -newkey rsa:2048 -nodes \
    -keyout "${KEY}" -out "${CERT}" \
    -days 30 -subj "/CN=${DOMAIN}" \
    -addext "subjectAltName=DNS:${DOMAIN}"
  chmod 644 "${CERT}"
  chmod 640 "${KEY}"
fi
