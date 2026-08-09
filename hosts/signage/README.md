# hosts/signage — 校内サイネージ端末（Raspberry Pi + Chromium Kiosk）

**設置場所:** 校内各所
**担当:** 映像研
**役割:** Ch4（本部 OBS が合成したサイネージ専用映像）を全画面表示し、
右カラムに公式サイトを `<iframe>` で常時表示する

ページ: `https://live.kosensai.ichinoseki.ac.jp/signage/`
（ソースは `app/src/routes/signage/+page.svelte`。ビルド成果物を配信サーバーが配信する）

> private → private のアクセスなので Chrome の LNA（Local Network Access）の
> 対象外。Chromium 側のポリシー配布など特殊設定は不要。

## 0. まとめてセットアップする

端末上でリポジトリを clone し、次を実行すれば §1〜§2 は自動で入る。

```bash
./hosts/signage/setup.sh                  # 既定 (Ch4)
SIGNAGE_CH=ch1 ./hosts/signage/setup.sh   # 別 Ch を映す端末
```

以下は手作業でやる場合の内訳。

## 1. Raspberry Pi 側の設定

`/boot/config.txt`（Bookworm 以降は `/boot/firmware/config.txt`）:

```
gpu_mem=256
hdmi_force_hotplug=1
disable_overscan=1
```

スクリーンセーバー・ブランキングを止める:

```bash
sudo apt install -y unclutter x11-xserver-utils
xset s off
xset -dpms
xset s noblank
```

## 2. Chromium の起動

```bash
chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-features=Translate \
  --check-for-update-interval=31536000 \
  --autoplay-policy=no-user-gesture-required \
  "https://live.kosensai.ichinoseki.ac.jp/signage/"
```

- `--autoplay-policy=no-user-gesture-required` … **必須。** サイネージページの
  `<video>` は音声を出すため `muted` を付けていない。ブラウザは音声のある自動再生を
  ユーザー操作なしでは許可しないため、この指定が無いと再生が始まらない。
- `--check-for-update-interval` … 会期中に更新ダイアログが出るのを防ぐ。

### 自動起動（systemd user service）

`~/.config/systemd/user/signage.service`:

```ini
[Unit]
Description=Kosensai signage kiosk
After=graphical-session.target

[Service]
Environment=DISPLAY=:0
ExecStart=/usr/bin/chromium-browser --kiosk --noerrdialogs --disable-infobars \
  --disable-session-crashed-bubble --check-for-update-interval=31536000 \
  --autoplay-policy=no-user-gesture-required \
  https://live.kosensai.ichinoseki.ac.jp/signage/
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
```

```bash
systemctl --user daemon-reload
systemctl --user enable --now signage
sudo loginctl enable-linger "$USER"   # 未ログインでも起動させる
```

## 3. ページ側の挙動

`app/src/routes/signage/+page.svelte` に実装済み。

| 挙動 | 内容 |
| --- | --- |
| 配信開始前 | 「現在配信していません」を表示し、5 秒ごとに自動リトライする。開場前に端末だけ先に起動しておける |
| 切断時 | 同上。復帰したら自動で再生を再開する |
| 公式サイト枠 | 5 分ごとに iframe を再読み込みし、お知らせの更新を拾う |
| 長時間運転 | 6 時間ごとに、再生していなければページをリロードする。配信中はリロードしない |
| 時計 | 右上に時刻を表示する。端末の NTP が合っていることを確認しておくこと |

## 4. 調整ポイント

- 別 Ch を映したい端末には `?ch=ch1` を付ける（`/signage/?ch=ch1`）。
  `setup.sh` は `SIGNAGE_CH` で指定できる。
- 右カラムの幅と文字サイズは `app/src/routes/signage/+page.svelte` の `<style>` にある。
  縦長ディスプレイや小さいパネルで見づらい場合はここを変更してビルドし直す。
- 音量は端末側で調整する（`alsamixer` など）。設置場所によって音を出したくない
  場合は端末を消音する。ページ側は常に音声ありで再生する。

設置前のチェック項目は Notion の「本番前チェックリスト §H」にある。
