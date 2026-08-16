#!/usr/bin/env bash
# app/ をビルドし、リハーサル環境へ反映する。

set -euo pipefail

REH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REH_DIR}/../app"

echo "== ビルド =="
pnpm run build 2>&1 | tail -3

cd "${REH_DIR}"
echo
echo "== マウントを再設定 =="
# adapter-static はビルドのたびに web/ を削除して再作成するため、bind mount が削除済みの
# ディレクトリを参照したままとなり 404 を返す。Caddy を再作成して再マウントする。
#
# --no-deps を指定しない場合は mediamtx まで再作成され、ネットワーク名前空間を相乗りして
# いる publisher が名前空間を失って停止する。
docker compose up -d --force-recreate --no-deps caddy-origin caddy-preview
sleep 2

# 自己署名の internal CA が発行するため -k を指定する。
code=$(curl -sk -o /dev/null -w '%{http_code}' https://localhost:8444/)
if [[ "${code}" == "200" ]]; then
  echo "  OK  https://localhost:8444/"
else
  echo "  NG  https://localhost:8444/ が http ${code}" >&2
  exit 1
fi
