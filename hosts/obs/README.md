# hosts/obs — 本部配信 PC（OBS 設定・ユーティリティ）

本ディレクトリは、ATEM とスマートフォンから送信された SRT ストリームを受信・合成し、チャンネルごとに配信サーバー（MediaMTX）へ向けて送信する本部 PC（OBS）で実行するユーティリティを管理しています。

このディレクトリには、SRT の接続用 URL を一括生成する `srt-urls.py`、テロップの画面（`overlays/`）、今年の構成（`assets/`）、シーンを作成する `build-scenes.py`、音声と配信休止を切り替える `channels.lua` があります。配信サーバーへ直接デプロイするファイルはありません。

---

## 1. 準備（.env）

本部 PC の作業は、リポジトリを clone した場所で行います。Python のスクリプトは `uv run` で実行します（Windows でも同じです）。

1. 配信サーバーの `hosts/server/.env` を、本部 PC の同じ場所（`hosts/server/.env`）にコピーします。パスフレーズは配信サーバーと一致している必要があるため、本部 PC で値を作り直さないでください。配信サーバーをまだ用意していない場合は、`hosts/server/.env.example` をコピーして値を入れます（設定項目は [hosts/server/README.md](../server/README.md)）。
2. 本部 PC の IP を `HQ_IP`、配信サーバーの IP を `SERVER_IP`、ATEM の IP を `ATEM_IP` に設定します。
3. 次を実行し、NG が無いことを確認します。

   ```bash
   uv run tools/config.py check
   ```

`.env` は Git の管理外です。本部 PC の後の作業は、[5. シーンの作成](#5-シーンの作成build-scenespy)（OBS の SRT Listener を作成）、[3. ATEM](#3-atemch1の設定)、スマートフォン（[2.](#2-srt-urlspyurl-生成スクリプト) の出力 1）、obs-multi-rtmp（2. の出力 2）の順に行います。

---

## 2. srt-urls.py（URL 生成スクリプト）

各種入力・出力用の URL は手動で入力せず、本スクリプトで生成した URL をコピー＆ペーストして使用してください。

### スクリプトの実行方法

```bash
uv run hosts/obs/srt-urls.py                    # hosts/server/.env を読みます
uv run hosts/obs/srt-urls.py --env path/to/.env # 別の .env を読む場合
```

### 出力される URL
1. **OBS メディアソース用 URL**: OBS のメディアソース（SRT Listener）に入力する URL、および ATEM・スマートフォン（Caller）に設定する URL とパスフレーズ。OBS の URL の `latency` はマイクロ秒、Moblin 向けの URL の `latency` はミリ秒です（どちらも `config.json` の `srtLatencyUs` から換算します）
2. **OBS 送出用 URL**: OBS から MediaMTX へストリームを送信する URL
3. **視聴用 URL**: 視聴テスト用の動作確認用 URL

各チャンネルの定義（待受ポート、レイテンシ、ビットレート等）および視聴 URL のホスト名は、すべてリポジトリ直下の `config.json` から自動的に読み込まれます。
SRT 接続用のパスフレーズと IP は `hosts/server/.env`（[1.](#1-準備env)）の設定を読み込みます。

- ATEM・スマートフォンの送信先（出力 1）は `HQ_IP`、OBS の送出先（出力 2）は `SERVER_IP` です。MediaMTX が本部 PC と同じホストにある場合は `SERVER_IP=127.0.0.1` にします。

- ATEM・スマートフォン → OBS（出力 1）には `OBS_<Ch>_LISTEN_PASSPHRASE` を使います。ATEM とスマートフォンに設定するのはこの値です。
- OBS → MediaMTX（出力 2）には `MTX_PATHS_<Ch>_SRTPUBLISHPASSPHRASE` を使います。この値は ATEM・スマートフォンには設定しないでください。
- 配信サーバーは、`.env` の `HQ_IP` からの送出だけを受け付けます。OBS を動かす PC の IP を `HQ_IP` に設定してください。
- SRT の latency は送受信の大きい方の値が使われるため、ATEM・スマートフォンからの区間は OBS 側の Listener の URL の `latency`（`config.json` の `srtLatencyUs`）で決まります。

OBS のメディアソース（SRT Listener）は `build-scenes.py`（[5.](#5-シーンの作成build-scenespy)）が出力 1 と同じ URL で作成します。

---

## 3. ATEM（Ch1）の設定

ATEM の配信設定（サービス名・URL・キー・パスフレーズ）は、`./tools/atem-stream/atem.py apply` で `.env` と `config.json` から設定し、`check` で確認します。詳細は [tools/atem-stream/](../../tools/atem-stream/README.md) を参照してください。

---

## 4. テロップ（overlays/）

テロップと全画面の画面は、OBS の「ブラウザソース」で `overlays/` の HTML を「ローカルファイル」として読み込みます。サイズはすべて 1920x1080 です。

| ファイル | 内容 |
| --- | --- |
| `lower-third.html` | 現在の演目のテロップ。`?ch=ch1`（既定）は第一体育館、`?ch=ch2` は遊撃 |
| `clock.html` | 左上の時計 |
| `notice.html` | お知らせの帯。`control.html` で選んだお知らせを出す |
| `watermark.html` | 右上のロゴの透かし |
| `lobby.html` | `standby.html` と `timetable.html` を交互に出す（次の出演の 5 分前からは待機画面に固定） |
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
  blender -b --factory-startup -P hosts/obs/render-gauge.py -- hosts/obs/overlays/gauge
  blender -b --factory-startup -P hosts/obs/render-clock.py -- hosts/obs/overlays/clock-face
  ```

  `blender` は Blender の実行ファイルです（macOS は `/Applications/Blender.app/Contents/MacOS/Blender`、Windows は `C:\Program Files\Blender Foundation\Blender <バージョン>\blender.exe`）。GPU（OptiX・CUDA・HIP・oneAPI・Metal）があれば GPU だけで描画します。

---

## 5. シーンの作成（build-scenes.py）

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
| Ch1 | SRT/RIST | `srt-urls.py` の出力 2 の Ch1 | `[出力] Ch1 第一体育館` | 2 |
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

