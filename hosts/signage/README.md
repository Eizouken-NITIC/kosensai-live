# hosts/signage — サイネージ端末（Raspberry Pi + Chromium Kiosk）

サイネージページを全画面で表示し続ける端末。ページは `https://<domain>/signage/` で、
ソースは `app/src/routes/signage/+page.svelte` にある。映すチャンネルの既定は
`config.json` の `signage.defaultChannel`。

> private → private のアクセスなので Chrome の LNA（Local Network Access）の
> 対象外。Chromium 側のポリシー配布など特殊設定は不要。

## 0. まとめてセットアップする

端末上でリポジトリを clone し、次を実行すれば §1〜§2 は自動で入る。

```bash
./hosts/signage/setup.sh                  # config.json の signage.defaultChannel
SIGNAGE_CH=ch1 ./hosts/signage/setup.sh   # 別の Ch を映す端末
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

起動フラグと URL は [signage.service](signage.service) にある。URL は
`@@SIGNAGE_URL@@` のままで、`setup.sh` がリポジトリ直下の `config.json` の `domain`
と `SIGNAGE_CH` から組み立てて埋める。

フラグのうち 2 つは、外すと動かなくなる。

- `--autoplay-policy=no-user-gesture-required` … **必須。** サイネージページの
  `<video>` は音声を出すため `muted` を付けていない。ブラウザは音声のある自動再生を
  ユーザー操作なしでは許可しないため、この指定が無いと再生が始まらない。
- `--check-for-update-interval` … 運転中に更新ダイアログが出るのを防ぐ。

### 自動起動（systemd user service）

`setup.sh` が `~/.config/systemd/user/signage.service` を生成して有効化する。
手作業で行う場合は次を実行する。

```bash
sed "s|@@SIGNAGE_URL@@|https://<domain>/signage/|" signage.service \
  > ~/.config/systemd/user/signage.service
systemctl --user daemon-reload
systemctl --user enable --now signage
sudo loginctl enable-linger "$USER"   # 未ログインでも起動させる
```

## 3. ページ側の挙動

`app/src/routes/signage/+page.svelte` に実装済み。

| 挙動 | 内容 |
| --- | --- |
| その Ch が配信されていない | 「このチャンネルは配信されていません」を表示し、5 秒ごとに自動リトライする |
| 配信サーバーへ届かない | 「接続できません」を表示する。復帰したら自動で再生を再開する |
| 音声 | 常に音声ありで再生する。端末側で音量を調整する（§4） |
| 埋め込み枠 | 5 分ごとに iframe を再読み込みし、更新を拾う |
| 長時間運転 | 6 時間ごとに、再生していなければページをリロードする。配信中はリロードしない |
| 時計 | 右上に端末の時刻を表示する |

## 4. 調整ポイント

- 別の Ch を映したい端末には `?ch=ch1` を付ける（`/signage/?ch=ch1`）。
  `setup.sh` は `SIGNAGE_CH` で指定できる。
- 文字と余白の大きさは `app/src/styles/signage.css` の `.signage { font-size }` の 1 行が
  決める。パネルの幅に対する比で書いてあるので、この値だけを変えれば全体が拡縮する。
- 音量は端末側で調整する（`alsamixer` など）。ページ側に音量の設定は無く、常に音声
  ありで再生する。

設置前のチェック項目は Notion「本番前チェックリスト §H」にある。
