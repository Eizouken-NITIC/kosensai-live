# hosts/signage — 校内サイネージ端末（Raspberry Pi + Chromium Kiosk）

**設置場所:** 校内各所
**担当:** 映像研
**役割:** Ch4（本部 OBS が合成したサイネージ専用映像）を全画面表示し、
右カラムに公式サイトを `<iframe>` で常時表示する

ページ: `https://live.kosensai.ichinoseki.ac.jp/signage/`
（ページ本体は `web/signage/index.html`。配信サーバーから配信される）

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

- `--autoplay-policy=no-user-gesture-required` … 無人での自動再生に必須。
  これがないと `muted` 属性頼みになり、音声を出したい場合に破綻する。
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

`web/signage/index.html` に実装済み。

| 挙動 | 内容 |
| --- | --- |
| 配信開始前 | 「まもなく放送を開始します」を表示し、**10 秒ごとに自動リトライ**。開場前に端末だけ先に起動しておける |
| 切断時 | 同上。復帰したら自動で再生を再開する |
| 公式サイト枠 | 5 分ごとに iframe を再読み込みし、お知らせの更新を拾う |
| 長時間運転 | 6 時間ごとに「再生していなければ」ページをリロード（メモリリーク対策の保険。配信中はリロードしない） |
| 時計 | 右上に時刻を表示。端末の NTP が合っていることを確認しておくこと |

## 4. 調整ポイント

- 右カラムの幅は `web/assets/signage.css` の CSS 変数 `--side`（既定 `26vw`）。
  縦長ディスプレイや小さいパネルで見づらければここを変える。
- 色・フォントは `web/assets/theme.css`。**暫定値**なので HP 部門との
  すり合わせ後に差し替える（サイネージだけ別配色にはしないこと）。
- 別 Ch を映したい端末には `?ch=ch1` を付ける（`/signage/?ch=ch1`）。
- 音声を出さない設置場所では、Chromium 起動オプションから
  `--autoplay-policy` を外し `muted` のままにしておけばよい。

## 5. 設置前チェック

- [ ] 有線 LAN 接続（Wi-Fi は避ける）
- [ ] `https://live.kosensai.ichinoseki.ac.jp/signage/` が証明書エラーなく開く
- [ ] Ch4 が再生される（本部で Ch4 を送出してもらって確認）
- [ ] 公式サイトの iframe が表示される（`X-Frame-Options` の確認は Notion の本番前チェックリスト）
- [ ] 電源断 → 再投入で自動的にページまで復帰する
- [ ] マウスカーソルが消えている / スクリーンセーバーが働かない
