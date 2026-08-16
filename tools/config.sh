#!/usr/bin/env bash
# config.json の値をシェルから読む。各ホストのスクリプトが source して使う。
#
#   . "${REPO_DIR}/tools/config.sh"
#   DOMAIN="${DOMAIN:-$(config_domain)}"

CONFIG_JSON="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/config.json"

command -v python3 >/dev/null \
  || { echo "python3 が必要です（config.json の読み出しに使います）" >&2; exit 1; }

# site.domain
config_domain() {
  python3 -c 'import json,sys;print(json.load(open(sys.argv[1],encoding="utf-8"))["site"]["domain"])' \
    "${CONFIG_JSON}"
}

# channels[].id を 1 行 1 件で
config_channel_ids() {
  python3 -c 'import json,sys;print("\n".join(c["id"] for c in json.load(open(sys.argv[1],encoding="utf-8"))["channels"]))' \
    "${CONFIG_JSON}"
}
