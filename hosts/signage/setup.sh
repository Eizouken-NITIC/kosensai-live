#!/usr/bin/env bash
# サイネージ端末（Raspberry Pi + Chromium Kiosk）のセットアップ。
# 端末上で実行する。
#
#   ./setup.sh                 # config.json の signage.defaultChannel
#   SIGNAGE_CH=ch1 ./setup.sh  # 別 Ch を映す端末

set -euo pipefail

HOST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${HOST_DIR}/../.." && pwd)"
DOMAIN="${DOMAIN:-$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["domain"])' "${REPO_DIR}/config.json")}"
SIGNAGE_CH="${SIGNAGE_CH:-}"

URL="https://${DOMAIN}/signage/"
[[ -n "${SIGNAGE_CH}" ]] && URL="${URL}?ch=${SIGNAGE_CH}"

echo "== 依存パッケージ =="
sudo apt-get update -qq
sudo apt-get install -y chromium-browser unclutter x11-xserver-utils

echo
echo "== スクリーンブランキングの無効化 =="
mkdir -p "${HOME}/.config/autostart"
cat > "${HOME}/.config/autostart/disable-blanking.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Name=Disable screen blanking
Exec=sh -c "xset s off; xset -dpms; xset s noblank"
X-GNOME-Autostart-enabled=true
EOF

echo
echo "== systemd user service =="
mkdir -p "${HOME}/.config/systemd/user"
sed "s|@@SIGNAGE_URL@@|${URL}|" \
  "${HOST_DIR}/signage.service" > "${HOME}/.config/systemd/user/signage.service"

systemctl --user daemon-reload
systemctl --user enable --now signage.service
sudo loginctl enable-linger "${USER}"   # 未ログインでも起動させる

echo
echo "== GPU メモリの確認 =="
CONFIG=/boot/firmware/config.txt
[[ -f "${CONFIG}" ]] || CONFIG=/boot/config.txt
if grep -q '^gpu_mem=256' "${CONFIG}" 2>/dev/null; then
  echo "  gpu_mem=256 設定済み"
else
  echo "  ⚠️ ${CONFIG} に gpu_mem=256 を追記して再起動すること"
  echo "     echo 'gpu_mem=256' | sudo tee -a ${CONFIG}"
fi

echo
echo "完了。表示 URL: ${URL}"
echo "  状態: systemctl --user status signage"
echo "  再起動: systemctl --user restart signage"
