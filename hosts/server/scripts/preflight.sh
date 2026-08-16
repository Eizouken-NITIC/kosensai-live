#!/usr/bin/env bash
# 配信サーバーの起動前に、設定・証明書・ホストの整合性を確認する。

# 確認を最後まで実行するため -e は指定しない。異常は FAIL に集約して終了コードへ反映する。
set -uo pipefail

HOST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "${HOST_DIR}/../.." && pwd)"
cd "${HOST_DIR}"

# shellcheck source=../../../tools/config.sh
. "${REPO_DIR}/tools/config.sh"

CHANNELS="$(config_channel_ids)"

FAIL=0
ok()   { printf '  \033[32mOK\033[0m   %s\n' "$1"; }
warn() { printf '  \033[33mWARN\033[0m %s\n' "$1"; }
ng()   { printf '  \033[31mNG\033[0m   %s\n' "$1"; FAIL=1; }

passphrase_var() { printf 'MTX_PATHS_%s_SRTPUBLISHPASSPHRASE' "$(printf '%s' "$1" | tr '[:lower:]' '[:upper:]')"; }

echo "== 配信サーバー設定 (hosts/server/) =="
for f in mediamtx.yml Caddyfile compose.yml; do
  [[ -f "$f" ]] && ok "$f" || ng "$f がありません"
done

echo
echo "== 配信サイト (web/) =="
for f in index.html signage/index.html; do
  [[ -f "${REPO_DIR}/web/${f}" ]] && ok "web/${f}" || ng "web/${f} がありません（cd app && pnpm build を実行してください）"
done
[[ -d "${REPO_DIR}/web/_app/immutable" ]] && ok "web/_app/immutable/" \
  || ng "web/_app/immutable/ がありません（cd app && pnpm build を実行してください）"
# 配布物にはライセンス本文の同梱が必要である。
for f in hls.js-Apache-2.0.txt media-chrome-MIT.txt noto-sans-jp-OFL-1.1.txt; do
  [[ -f "${REPO_DIR}/web/licenses/${f}" ]] && ok "web/licenses/${f}" || ng "web/licenses/${f} がありません"
done

echo
echo "== .env / パスフレーズ =="
if [[ ! -f .env ]]; then
  ng ".env がありません（cp .env.example .env を実行し、実値を入れてください）"
else
  # shellcheck disable=SC1091
  set -a; source .env; set +a
  for ch in ${CHANNELS}; do
    var="$(passphrase_var "${ch}")"
    val="${!var:-}"
    # SRT のパスフレーズは 10〜79 文字である。
    if   [[ -z "$val" ]];                    then ng "${var} が設定されていません"
    elif [[ "$val" == CHANGEME* ]];          then ng "${var} がサンプル値のままです"
    elif (( ${#val} < 10 || ${#val} > 79 )); then ng "${var} は 10〜79 文字にしてください（現在 ${#val} 文字）"
    else ok "${var} (${#val} 文字)"
    fi
  done
  dup=$(for ch in ${CHANNELS}; do var="$(passphrase_var "${ch}")"; printf '%s\n' "${!var:-}"; done \
        | sort | uniq -d | grep -c . || true)
  (( dup == 0 )) && ok "Ch ごとに別のパスフレーズを使用しています" || warn "同じパスフレーズを複数 Ch で使っています"
fi

echo
echo "== config.json と他の設定が一致しているか =="
if python3 - "${REPO_DIR}" <<'PY'
import json, re, sys, pathlib
repo = pathlib.Path(sys.argv[1])
conf = json.loads((repo / "config.json").read_text(encoding="utf-8"))
ok = True

def line(status, color, text):
    print("  \033[%sm%s\033[0m   %s" % (color, status, text))

yml  = (repo / "hosts/server/mediamtx.yml").read_text(encoding="utf-8")
body = yml.split("\npaths:", 1)[1] if "\npaths:" in yml else ""
mtx  = set(re.findall(r"^  ([A-Za-z0-9_-]+):\s*$", body, re.M))
web  = {c["id"] for c in conf["channels"]}
if mtx == web:
    line("OK", "32", "チャンネル定義 %s" % sorted(mtx))
else:
    line("NG", "31", "mediamtx.yml=%s / config.json=%s" % (sorted(mtx), sorted(web)))
    ok = False

caddy = (repo / "hosts/server/Caddyfile").read_text(encoding="utf-8")
hosts = set(re.findall(r"^([A-Za-z0-9.-]+\.[A-Za-z]{2,})\s*\{", caddy, re.M))
if hosts == {conf["site"]["domain"]}:
    line("OK", "32", "ホスト名 %s" % conf["site"]["domain"])
else:
    line("NG", "31", "Caddyfile=%s / config.json=%s" % (sorted(hosts), conf["site"]["domain"]))
    ok = False

sys.exit(0 if ok else 1)
PY
then :; else FAIL=1; fi

echo
echo "== 証明書 =="
if [[ -f certs/fullchain.pem && -f certs/privkey.pem ]]; then
  if end=$(openssl x509 -in certs/fullchain.pem -noout -enddate 2>/dev/null | cut -d= -f2); then
    ok "certs/ を配置済みです（有効期限: ${end}）"
    openssl x509 -in certs/fullchain.pem -checkend 259200 >/dev/null 2>&1 \
      || warn "3日以内に失効します。scripts/get-cert.sh で取り直してください"
  else
    ng "certs/fullchain.pem が読み込めません"
  fi
else
  ng "certs/ に証明書がありません（sudo ./scripts/get-cert.sh を実行してください）"
fi

echo
echo "== ホスト設定 =="
if [[ "$(uname -s)" == "Linux" ]]; then
  rmem=$(sysctl -n net.core.rmem_max 2>/dev/null || echo 0)
  (( rmem >= 26214400 )) && ok "net.core.rmem_max=${rmem}" \
    || warn "net.core.rmem_max=${rmem}（SRT 再送バッファを確保するため、sysctl -w net.core.rmem_max=26214400 の実行を推奨します）"
else
  warn "Linux 以外のため、この確認をスキップします（$(uname -s)）"
fi

if command -v docker >/dev/null; then
  ok "docker $(docker --version | awk '{print $3}' | tr -d ,)"
  if [[ -f .env ]]; then
    docker compose config -q 2>/dev/null && ok "docker compose の構文 OK" || ng "docker compose config が通りません"
  else
    warn ".env が無いため、docker compose config の確認をスキップします"
  fi
else
  ng "docker がありません"
fi

echo
(( FAIL == 0 )) && echo "==> 起動可能です: docker compose up -d" \
                || { echo "==> NG があります。解消してから起動してください。"; exit 1; }
