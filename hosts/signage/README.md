# hosts/signage — サイネージ端末（Raspberry Pi + Chromium Kiosk）

サイネージ端末は会場のディスプレイにライブ配信を全画面で表示し続けます。

| パス | 内容 |
| --- | --- |
| `setup.sh` | 依存パッケージ、画面のブランキングの無効化、Chromium の自動起動を設定するスクリプト（[1.](#1-自動一括セットアップ)） |
| `signage.service` | Chromium をキオスクモードで起動する systemd のユーザーサービスのテンプレート（[3.](#3-chromium-ブラウザの起動設定)） |

表示するページは `https://<domain>/signage/`（`app/src/routes/signage/+page.svelte`）です。`<domain>` は `config.json` の `site.domain`、既定のチャンネルは `config.json` の `signage.defaultChannel` です。

---

## 1. 自動一括セットアップ

Raspberry Pi でリポジトリを clone し、次を実行します。`setup.sh` は `python3` で `config.json` の `site.domain` を読み込みます。

```bash
# 既定のチャンネルを表示する
./hosts/signage/setup.sh

# チャンネルを指定する（例: ch1）
SIGNAGE_CH=ch1 ./hosts/signage/setup.sh

# ホスト名を指定する
DOMAIN=<ホスト名> ./hosts/signage/setup.sh
```

| `setup.sh` が行うこと | 内容 |
| --- | --- |
| 依存パッケージ | `chromium-browser`・`unclutter`・`x11-xserver-utils` を `apt-get` でインストールする |
| 画面のブランキングの無効化 | `~/.config/autostart/disable-blanking.desktop` を作成し、ログイン時に `xset s off; xset -dpms; xset s noblank` を実行する |
| 自動起動 | `signage.service` の `@@SIGNAGE_URL@@` を表示する URL に置換して `~/.config/systemd/user/signage.service` に書き出し、有効にして起動する。`loginctl enable-linger` を設定する |
| GPU メモリの確認 | `config.txt` に `gpu_mem=256` があるかを確認する。無ければ追記のコマンドを表示する |

`gpu_mem=256` と HDMI の設定は `setup.sh` ではなく手で設定し（[2.](#2-raspberry-pi-端末本体の手動設定)）、再起動します。

```bash
systemctl --user status signage    # 状態を確認する
systemctl --user restart signage   # 再起動する
```

---

## 2. Raspberry Pi 端末本体の手動設定

`/boot/firmware/config.txt`（Bookworm より前は `/boot/config.txt`）に次を設定し、再起動します。

```ini
gpu_mem=256
hdmi_force_hotplug=1
disable_overscan=1
```

`setup.sh` を使用せずに画面のブランキングを無効にする場合は、次を実行します。

```bash
sudo apt install -y unclutter x11-xserver-utils
xset s off
xset -dpms
xset s noblank
```

---

## 3. Chromium ブラウザの起動設定

Chromium の起動のフラグと表示する URL は [signage.service](signage.service) にあります。

| フラグ | 内容 |
| --- | --- |
| `--kiosk` | キオスクモードで起動する |
| `--autoplay-policy=no-user-gesture-required` | 音声付きの自動再生を許可する |
| `--check-for-update-interval=31536000` | 更新の通知を表示しない |
| `--noerrdialogs`・`--disable-infobars`・`--disable-session-crashed-bubble`・`--disable-features=Translate` | エラー・情報バー・復元・翻訳のダイアログを表示しない |

サービスは `Restart=always`（5 秒後）で、Chromium が終了すると起動し直します。

`setup.sh` を使用せずに設定する場合は、次を実行します。

```bash
mkdir -p ~/.config/systemd/user
sed "s|@@SIGNAGE_URL@@|https://<domain>/signage/|" signage.service \
  > ~/.config/systemd/user/signage.service

systemctl --user daemon-reload
systemctl --user enable --now signage

# ログインしていない状態でもサービスを起動する
sudo loginctl enable-linger "$USER"
```

---

## 4. サイネージ用 Web ページ側の制御機能

| 状態 | ページの動作 |
| --- | --- |
| チャンネルが配信されていない | 「このチャンネルは配信されていません」を表示し、5 秒ごとに再試行する |
| 配信サーバーに接続できない | 「接続中です」を表示し、5 秒ごとに再試行する。接続できると再生を再開する |
| 再生位置がライブの先端から遅れた | 先端へ追従する。遅れが小さい間は再生速度を 5% 上げて詰め、20 秒以上遅れた場合は先端へシークする |
| 自動再生がブロックされた | 自動で再生を再開する |
| 音声 | 常に音声を有効にして再生する |
| 埋め込みの iframe | 5 分ごとにリロードする |
| ページ | 再生していない場合に限り 6 時間ごとにリロードする |
| 時計 | 画面の上の帯に端末の時刻の時計を表示する |

---

## 5. カスタマイズ・調整項目

| 項目 | 方法 |
| --- | --- |
| 表示するチャンネル | URL に `?ch=ch1` などを付ける（例: `/signage/?ch=ch1`）。`setup.sh` では `SIGNAGE_CH` で指定する |
| 文字と余白の大きさ | `app/src/styles/signage.css` の `.signage { font-size: ... }` の 1 行。この値に比例して全体が拡大・縮小する |
| 音量 | 端末（Raspberry Pi）で調整する（`alsamixer` 等） |
