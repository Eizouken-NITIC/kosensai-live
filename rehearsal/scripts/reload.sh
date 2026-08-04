#!/usr/bin/env bash
# app/ をビルドして、リハーサル環境に反映する。
#
#   ./scripts/reload.sh
#
# ビルドのたびに web/ が作り直される（adapter-static が出力先を消して作る）ため、
# bind mount が古いディレクトリを掴んだままになり 404 になる。
# caddy を再起動してマウントを張り直す必要がある。

set -euo pipefail

REH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REH_DIR}/../app"

echo "== ビルド =="
pnpm run build 2>&1 | tail -3

cd "${REH_DIR}"
echo
echo "== マウントを張り直す =="
docker compose up -d --force-recreate caddy preview >/dev/null 2>&1
sleep 2

code=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/)
if [[ "${code}" == "200" ]]; then
  echo "  OK  http://localhost:8080/"
else
  echo "  NG  http://localhost:8080/ が http ${code}" >&2
  exit 1
fi
