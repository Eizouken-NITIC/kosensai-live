#!/usr/bin/env bash
# 配信サーバーの起動前チェック。docker compose up -d の前に流す。
#
#   ./scripts/preflight.sh

set -uo pipefail

HOST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "${HOST_DIR}/../.." && pwd)"
cd "${HOST_DIR}"

FAIL=0
ok()   { printf '  \033[32mOK\033[0m   %s\n' "$1"; }
warn() { printf '  \033[33mWARN\033[0m %s\n' "$1"; }
ng()   { printf '  \033[31mNG\033[0m   %s\n' "$1"; FAIL=1; }

echo "== 配信サーバー設定 (hosts/server/) =="
for f in mediamtx.yml Caddyfile compose.yml; do
  [[ -f "$f" ]] && ok "$f" || ng "$f が無い"
done

echo
echo "== 配信サイト (web/) =="
# web/ は app/ のビルド成果物である。ここに無い場合は cd app && pnpm build を実行する。
for f in index.html signage/index.html; do
  [[ -f "${REPO_DIR}/web/${f}" ]] && ok "web/${f}" || ng "web/${f} が無い（cd app && pnpm build）"
done
[[ -d "${REPO_DIR}/web/_app/immutable" ]] && ok "web/_app/immutable/" \
  || ng "web/_app/immutable/ が無い（cd app && pnpm build）"
# OFL-1.1 は配布物にライセンス本文を伴うことを求めるため、欠けたまま配信しない。
for f in hls.js-Apache-2.0.txt media-chrome-MIT.txt noto-sans-jp-OFL-1.1.txt; do
  [[ -f "${REPO_DIR}/web/licenses/${f}" ]] && ok "web/licenses/${f}" || ng "web/licenses/${f} が無い"
done

echo
echo "== .env / パスフレーズ =="
if [[ ! -f .env ]]; then
  ng ".env が無い（cp .env.example .env して実値を入れる）"
else
  # shellcheck disable=SC1091
  set -a; source .env; set +a
  for ch in CH1 CH2 CH3 CH4; do
    var="MTX_PATHS_${ch}_SRTPUBLISHPASSPHRASE"
    val="${!var:-}"
    if   [[ -z "$val" ]];                    then ng "${var} が未設定"
    elif [[ "$val" == CHANGEME* ]];          then ng "${var} がサンプル値のまま"
    elif (( ${#val} < 10 || ${#val} > 79 )); then ng "${var} は 10〜79 文字にする（現在 ${#val}）"
    else ok "${var} (${#val} 文字)"
    fi
  done
  dup=$(printf '%s\n' "${MTX_PATHS_CH1_SRTPUBLISHPASSPHRASE:-}" "${MTX_PATHS_CH2_SRTPUBLISHPASSPHRASE:-}" \
        "${MTX_PATHS_CH3_SRTPUBLISHPASSPHRASE:-}" "${MTX_PATHS_CH4_SRTPUBLISHPASSPHRASE:-}" \
        | sort | uniq -d | grep -c . || true)
  (( dup == 0 )) && ok "Ch ごとに別のパスフレーズ" || warn "同じパスフレーズを複数 Ch で使っている"
fi

echo
echo "== config.json と他の設定が一致しているか =="
if command -v python3 >/dev/null; then
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

# Caddyfile は JSON を読めないためホスト名を直接書いている。ずれると証明書と
# site が一致せず、ページが出ない。
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
else
  warn "python3 が無いため config.json の突き合わせをスキップ"
fi

echo
echo "== 証明書 =="
if [[ -f certs/fullchain.pem && -f certs/privkey.pem ]]; then
  if end=$(openssl x509 -in certs/fullchain.pem -noout -enddate 2>/dev/null | cut -d= -f2); then
    ok "certs/ 配置済み（有効期限: ${end}）"
    openssl x509 -in certs/fullchain.pem -checkend 259200 >/dev/null 2>&1 \
      || warn "3日以内に失効する。scripts/get-cert.sh で取り直すこと"
  else
    ng "certs/fullchain.pem が読めない"
  fi
else
  ng "certs/ に証明書が無い（sudo ./scripts/get-cert.sh）"
fi

echo
echo "== ホスト設定 =="
if [[ "$(uname -s)" == "Linux" ]]; then
  rmem=$(sysctl -n net.core.rmem_max 2>/dev/null || echo 0)
  (( rmem >= 26214400 )) && ok "net.core.rmem_max=${rmem}" \
    || warn "net.core.rmem_max=${rmem}（SRT 再送バッファ不足の恐れ。sysctl -w net.core.rmem_max=26214400）"
else
  warn "Linux 以外のため sysctl チェックをスキップ（$(uname -s)）"
fi

if command -v docker >/dev/null; then
  ok "docker $(docker --version | awk '{print $3}' | tr -d ,)"
  if [[ -f .env ]]; then
    docker compose config -q 2>/dev/null && ok "docker compose の構文 OK" || ng "docker compose config が通らない"
  else
    warn ".env が無いため docker compose config をスキップ"
  fi
else
  ng "docker が無い"
fi

echo
(( FAIL == 0 )) && echo "==> 起動可能: docker compose up -d" \
                || { echo "==> NG があります。解消してから起動してください。"; exit 1; }
