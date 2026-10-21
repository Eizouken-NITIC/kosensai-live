# hosts/obs — 本部配信 PC（OBS 設定・ユーティリティ）

本ディレクトリは、ATEM とスマートフォンから送信された SRT ストリームを受信・合成し、チャンネルごとに配信サーバー（MediaMTX）へ向けて送信する本部 PC（OBS）に関する設定とユーティリティを管理しています。本部 PC はメイン会場（第一体育館）に置き、ATEM と同じ会場のスイッチに接続します。

このディレクトリ内にあるのは、SRT の接続用 URL を一括生成する `srt-urls.sh` スクリプトのみです。配信サーバーへ直接デプロイするファイルはありません。

---

## 1. キーフレーム間隔の設定

OBS 側の**キーフレーム間隔**の設定値は、配信サーバー側の設定ファイル `hosts/server/mediamtx.yml` 内の `hlsSegmentDuration` の値（デフォルトは **2 秒**）と同一に設定してください。

---

## 2. srt-urls.sh（URL 生成スクリプト）

各種入力・出力用の URL は手動で入力せず、本スクリプトで生成した URL をコピー＆ペーストして使用してください。

### スクリプトの実行方法

```bash
# 配信サーバー側の .env が参照できるディレクトリで実行します
./hosts/obs/srt-urls.sh                    # MediaMTX が同一ホストにある場合

# 配信サーバー（MediaMTX）と OBS が異なるマシンにある場合
MTX_HOST=10.1.2.3 OBS_HOST=10.1.2.4 ./hosts/obs/srt-urls.sh
```

### 出力される URL
1. **OBS メディアソース用 URL**: OBS のメディアソース（SRT Listener）に入力する URL、および ATEM・スマートフォン（Caller）に設定する URL とパスフレーズ
2. **OBS 送出用 URL**: OBS から MediaMTX へストリームを送信する URL
3. **視聴用 URL**: 視聴テスト用の動作確認用 URL

各チャンネルの定義（待受ポート、レイテンシ、ビットレート等）および視聴 URL のホスト名は、すべてリポジトリ直下の `config.json` から自動的に読み込まれます。
SRT 接続用のパスフレーズは `hosts/server/.env` の設定を読み込みます。

- ATEM・スマートフォン → OBS（出力 1）には `OBS_<Ch>_LISTEN_PASSPHRASE` を使います。ATEM とスマートフォンに設定するのはこの値です。
- OBS → MediaMTX（出力 2）には `MTX_PATHS_<Ch>_SRTPUBLISHPASSPHRASE` を使います。この値は ATEM・スマートフォンには設定しないでください。
- 配信サーバーは、`.env` の `HQ_IP` からの送出だけを受け付けます。OBS を動かす PC の IP を `HQ_IP` に設定してください。

---

## 3. ATEM（Ch1）の設定

ATEM Mini Pro ISO（ファームウェア 10.3 で確認）は SRT の Caller として本部 PC へ送信します。ATEM Software Control の「出力」タブの「ライブ配信」で、次のように設定します。

| 項目 | 値 |
| --- | --- |
| 配信サービス | `Custom URL H.264` |
| サーバー | `srt://<本部 PC の IP>:9001`（クエリを付けません） |
| キー | 空欄 |
| パスフレーズ | `OBS_CH1_LISTEN_PASSPHRASE` の値 |
| 品質 | `HyperDeck Low`（1080p29.97 で 12Mbps。USB-C の収録にも同じ品質が適用されます） |

- ATEM は URL の `?passphrase=` を無視します。パスフレーズは専用の欄に入力してください。
- パスフレーズ欄は複数行の入力欄で、Tab キーを押すとタブ文字が値に入ります。入力後は別の欄をクリックして確定してください。
- SRT の latency は送受信の大きい方の値が使われるため、OBS 側の Listener の URL の `latency` で決まります。
- 配信中（接続中を含む）は設定を変更できません。変更する場合は配信を停止してから行います。

OBS 側は「メディアソース」を追加し、「ローカルファイル」のチェックを外して、`srt-urls.sh` の出力 1 の Listener の URL を「入力」に、`mpegts` を「入力フォーマット」に設定します。

---

## 4. Ch1 の音声

Ch1 の音声は、配信用ミキサーの USB オーディオを本部 PC に入力して使用します。ATEM のメディアソースの音声はミュートします。

USB オーディオは SRT の映像より早く届くため、USB オーディオのソースの「同期オフセット」で遅らせて映像に合わせます。オフセットの値はリハーサルで実測して設定してください。

---

## 5. テロップ（overlays/）

テロップと全画面の画面は、OBS の「ブラウザソース」で `overlays/` の HTML を「ローカルファイル」として読み込みます。サイズはすべて 1920x1080 です。

| ファイル | 内容 |
| --- | --- |
| `lower-third.html` | 現在の演目のテロップ。`?ch=ch1`（既定）は第一体育館、`?ch=ch2` は遊撃 |
| `clock.html` | 左上の時計 |
| `notice.html` | お知らせの帯。`control.html` で選んだお知らせを出す |
| `watermark.html` | 右上のロゴの透かし |
| `standby.html` | 待機画面（開始前と休憩中の残り時間、配信休止中、終了後） |
| `upnext.html` | 次の演目の全画面の告知 |
| `timetable.html` | 当日のタイムテーブル |
| `split.html` | 2 画面の背景と見出し |
| `pause.html` | 配信休止の画面(第一体育館の配信をしない時間に、映像の代わりに出す) |
| `control.html` | 操作パネル。OBS でソースを右クリックし「対話」で開いて、お知らせと遊撃の現在地を選ぶ |

- 演目・時刻・お知らせは `assets/program.json` だけに書きます（[assets/README.md](assets/README.md)）。各画面は現在時刻から表示を切り替えるため、当日の操作は不要です。
- URL に `?now=2026-10-24T13:35` を付けると、その時刻から時計を進めて表示します。ブラウザで開いて確認できます。
- 各画面の状態（お知らせ、遊撃の現在地）は、`control.html` が localStorage と BroadcastChannel で渡します。
- 色と線の規則は `overlay.css` の先頭に書いています。
- 計器の画像（`gauge/`）と待機画面の時計の画像（`clock-face/`）は、`render-gauge.py` と `render-clock.py` で Blender の Cycles で描画します（シーンと部品は `scene_parts.py` で共通）。形・材質・光源を変えた場合は、次で描き直してコミットします。

  ```bash
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P hosts/obs/render-gauge.py -- hosts/obs/overlays/gauge
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P hosts/obs/render-clock.py -- hosts/obs/overlays/clock-face
  ```


---

## 6. シーンの作成（build-scenes.py）

本部 PC で OBS を起動し、「ツール → WebSocket サーバー設定」でサーバーを有効にしてから、リポジトリを clone した場所で実行します。`assets/scenes.json` のシーンコレクションを作り、無いシーンとソースだけを追加します。SRT のパスフレーズは `hosts/server/.env` から読み込むため、リポジトリには入りません。

```bash
uv run hosts/obs/build-scenes.py
```

| シーン | 用途 |
| --- | --- |
| `[音声] 常時` | Ch1・Ch2 の音声のソースを置くシーン。映像は画面の外にあり、映りません |
| `[出力] Ch1 第一体育館` | obs-multi-rtmp の Ch1 の出力 |
| `[出力] Ch2 遊撃` | obs-multi-rtmp の Ch2 の出力 |
| `Ch3 …` | Ch3（プログラム）で切り替えるシーン。待機・第一体育館・遊撃・2 画面・UP NEXT・タイムテーブル・CM |

実行後に OBS で次を設定します。

1. 「ツール → スクリプト」で `hosts/obs/channels.lua` を追加する。「設定 → ホットキー」で「配信休止: 予定どおり / 出す / 出さない」にキーを割り当てる。
2. `Ch1 音声 (USB)` のデバイスに配信用ミキサーを選び、「オーディオの詳細プロパティ」で同期オフセットを設定する（リハーサルで実測した値）。
3. `CM` に動画ファイルを指定する。
4. obs-multi-rtmp のドックで 3 つの出力を作る。

| 出力 | プロトコル | URL | 映像のシーン | 音声のトラック |
| --- | --- | --- | --- | --- |
| Ch1 | SRT/RIST | `srt-urls.sh` の出力 2 の Ch1 | `[出力] Ch1 第一体育館` | 2 |
| Ch2 | SRT/RIST | 出力 2 の Ch2 | `[出力] Ch2 遊撃` | 3 |
| Ch3 | SRT/RIST | 出力 2 の Ch3 | OBS のシーンと同じ | 1 |

映像のエンコーダーは NVENC、CBR、キーフレーム間隔 2 秒、ビットレートは `config.json` の `bitrateKbps` です。

### 音声の仕組み

obs-multi-rtmp でプログラム以外のシーンを送出しても、そのシーンにしか無いソースの音声は OBS のミキサーに入りません。そのため、Ch1・Ch2 の音声のソースは `[音声] 常時` に置き、`channels.lua` がこのシーンを出力チャンネルにつないで、常にミキサーに入れます。

| ソース | トラック |
| --- | --- |
| `Ch1 音声 (USB)` | 2（Ch1）。Ch3 で第一体育館を映している間は 1 も |
| `Ch2 iPhone` | 3（Ch2）。Ch3 で遊撃を映している間は 1 も |
| `Ch1 ATEM` | なし（ATEM の埋め込み音声は使用しません） |
| `CM` | 1（CM のシーンを出している間だけ鳴ります） |

`channels.lua` は、プログラムのシーンに `Ch1 ATEM` が映っていれば `Ch1 音声 (USB)` を、`Ch2 iPhone` が映っていれば `Ch2 iPhone` をトラック 1 に入れます。両方が映る 2 画面では Ch1 の音声を使用します。待機画面などの全画面のシーンでは、Ch3 に会場の音声は入りません。

### 配信休止

第一体育館の配信をしない時間(`assets/program.json` の種類が `ng` の項目)は、`channels.lua` が次の 2 つを行います。

- `[出力] Ch1 第一体育館`・`Ch3 第一体育館`・`Ch3 2 画面` の `配信休止`(`overlays/pause.html`)を表示し、映像を隠す。
- `Ch1 音声 (USB)` をミュートする。トラックの割り当ては変えません。

obs-multi-rtmp の出力は開始した時点のシーンに固定されるため、プログラムのシーンの切り替えでは Ch1 の映像は変わりません。休止は出力のシーンの中のソースの表示で切り替えます。

時刻は `assets/program.json` から読みます。押しや巻きで時刻がずれた場合は、ホットキーの「配信休止: 出す / 出さない」で固定し、「予定どおり」で `program.json` の時刻に戻します。`assets/` を変更した後は、「ツール → スクリプト」の `channels.lua` の「assets を読み直す」を押します。スクリプトの設定の「確認用の時刻」に `2026-10-24 13:55` のように入れると、その時刻として判定します(リハーサル用。本番では空にします)。

