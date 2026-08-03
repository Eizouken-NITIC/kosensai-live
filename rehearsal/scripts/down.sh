#!/usr/bin/env bash
# リハーサル環境を落とす。
#
#   ./scripts/down.sh          # コンテナを停止・削除
#   ./scripts/down.sh --clean  # 証明書と負荷テストの結果も消す

set -euo pipefail

REH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REH_DIR}"

echo "== 停止 =="
docker compose --profile publish down -v --remove-orphans

# 負荷テストのクライアントは compose 管理外なので個別に掃除する
leftovers=$(docker ps -aq --filter "name=rehearsal-client-" 2>/dev/null || true)
if [[ -n "${leftovers}" ]]; then
  echo "== 負荷テストのクライアントを掃除 =="
  # shellcheck disable=SC2086
  docker rm -f ${leftovers} >/dev/null
fi

if [[ "${1:-}" == "--clean" ]]; then
  echo "== 生成物を削除 =="
  rm -rf certs out
fi

echo "完了"
