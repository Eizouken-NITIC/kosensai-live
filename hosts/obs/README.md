# hosts/obs — 本部 PC（OBS）

本部 PC は、ATEM とスマートフォンから SRT で受信した映像にテロップを合成し、チャンネルごとに配信サーバー（MediaMTX）へ送出します。

| パス | 内容 |
| --- | --- |
| `scenes.json` | OBS の構成（プロファイル、入力、シーンごとの並びと配置、obs-multi-rtmp の出力、録画、音声の振り分け、配信休止・遊撃の切断・CM の対象）（[5.](#5-scenesjson)） |
| `overlays/` | テロップと全画面の画面（ブラウザソースの HTML・JS・CSS） |
| `design/` | 画面のフォント、計器と時計の画像と、画像を描画する Blender のスクリプト |
| `channels.lua` | 音声の振り分け、本部のモニター、配信休止、CM の自動表示を行う OBS のスクリプト |

その年の中身（進行の `program.json`、CM のスライド）は、別のリポジトリ [kosensai-live-assets]()（非公開）にあります。OBS・ATEM の設定は、リポジトリの CLI（`kosensai-live`、[tools/kosensai_live/](../../tools/kosensai_live/)）が `config.json`・`.env`・`scenes.json` と kosensai-live-assets から行います。

---

## 1. 準備

本部 PC は Windows・macOS・Linux のどれでも構いません。次を用意します。

| もの | バージョン | 入手先・用途 |
| --- | --- | --- |
| OBS Studio | 32.1.2 で確認 | <https://obsproject.com/>。SRT の受信と送出は OBS に含まれる FFmpeg（libsrt）で行うため、SRT のプラグインは不要です |
| obs-multi-rtmp | 0.7.4 | <https://github.com/sorayuki/obs-multi-rtmp/releases/tag/0.7.4>。Ch ごとの送出。`kosensai-live obs build` は、このバージョンの設定ファイルを書き出します |
| Source Record | 0.4.8 | <https://github.com/exeldro/obs-source-record/releases/tag/0.4.8>。Ch ごとのクリーンフィードの録画。無い場合、`obs build` はエラーで止まります |
| uv、Git | ― | <https://docs.astral.sh/uv/>。`kosensai-live` を実行します。Python 3.12 は uv が用意します（`.python-version`） |

プラグインは、OBS を終了した状態で各リリースのインストーラー（Windows は `.exe`、macOS は `.pkg`）を実行して入れます。

kosensai-live と kosensai-live-assets を同じ階層に clone し、kosensai-live の場所で作業します。

```bash
git clone https://github.com/Eizouken-NITIC/kosensai-live.git
git clone 
cd kosensai-live
```

kosensai-live-assets を別の場所に置いた場合は、`uv run kosensai-live obs build --assets <場所>` のように `--assets` で指定するか、環境変数 `KOSENSAI_LIVE_ASSETS` に場所を設定します。

1. 配信サーバーの `hosts/server/.env` を、本部 PC の同じ場所（`hosts/server/.env`）にコピーします。パスフレーズは配信サーバーと一致している必要があるため、本部 PC で値を作り直さないでください。配信サーバーをまだ用意していない場合は、`hosts/server/.env.example` をコピーして値を入れます（設定項目は [hosts/server/README.md](../server/README.md)）。
2. `.env` の `HQ_IP` に本部 PC の IP、`SERVER_IP` に配信サーバーの IP、`ATEM_IP` に ATEM の IP を設定します。
3. 次を実行し、NG が無いことを確認します。

   ```bash
   uv run kosensai-live check
   ```

4. OBS を起動し、「ツール → WebSocket サーバー設定」でサーバーを有効にします。

---

## 2. 設定の手順

### 2-1. OBS を設定する

配信と録画を停止した状態で実行します。

```bash
uv run kosensai-live obs build
```

| 設定するもの | 内容 |
| --- | --- |
| プロファイル | `KOSENSAI-LIVE`。映像の形式は `config.json` の `video.mode`（1080p29.97） |
| スタジオモード | 無効（[3-1.](#3-1-シーン)） |
| シーンコレクション | `KOSENSAI-LIVE`。`scenes.json` のシーンは、項目の有無・並び・配置を `scenes.json` に合わせます。項目の表示・非表示は変えません（`channels.lua` が切り替えるため）。`scenes.json` に無いシーンには手を加えません |
| ソース | SRT Listener の URL とパスフレーズ、ページのファイルの場所（URL の `?assets=` に kosensai-live-assets の場所を付けます）、CM のスライドの一覧、音声のデバイスとトラック。毎回上書きします |
| 録画 | `[録画] …` のシーンの Source Record のフィルター（[3-4.](#3-4-録画)） |
| obs-multi-rtmp の出力 | Ch1・Ch2・Ch3 の 3 つ（[3-3.](#3-3-出力obs-multi-rtmp)）。送出先の URL とパスフレーズは `.env` から作ります |

obs-multi-rtmp の出力、Ch3 の録画の設定（プロファイル）、Ch1・Ch2 の録画のフィルターが変わる場合、`obs build` は「OBS を終了してください」と表示して OBS の終了を待ち、終了した後に設定を書き込みます。書き込んだら OBS を起動し直します。obs-multi-rtmp は設定を OBS の起動時に読んで終了時に書き戻し、録画の設定は起動中に変えると録画の出力と食い違うためです。

その後、OBS で次を設定します。

1. 「ツール → スクリプト」で `hosts/obs/channels.lua` を追加する。
2. 「設定 → ホットキー」で「配信休止: 出す」「配信休止: 消す」「CM 小窓: 自動で出す」「CM 小窓: 出さない」にキーを割り当てる。
3. 「設定 → 音声 → 詳細設定」のモニタリングデバイスに、本部のヘッドホンをつなぐデバイスを選ぶ。
4. 「設定 → 出力 → 録画」の録画ファイルのパスに、録画を保存するディスクを選ぶ（Source Record もこのパスに保存します）。
5. `Ch1 音声 (USB)` の「オーディオの詳細プロパティ」で同期オフセットを設定する（リハーサルで実測した値）。USB オーディオは SRT の映像より早く届くためです。

kosensai-live-assets の `program.json` や `cm/out/` を変更した場合は、本部 PC で `git pull` した後に `uv run kosensai-live obs build` を実行し直します。`obs build` は全てのブラウザソースを読み込み直します。

### 2-2. 音声のデバイスを指定する

```bash
uv run kosensai-live obs devices
```

`Ch1 音声 (USB)` に選べるデバイスの名前を表示します。配信用ミキサーの名前（の一部）を `scenes.json` の `Ch1 音声 (USB)` の `device` に書き、`uv run kosensai-live obs build` をもう一度実行します。`device` が無い場合、`obs build` は WARN を表示し、OS の既定の入力を使用します。

### 2-3. ATEM を設定する

```bash
uv run kosensai-live atem apply      # 映像の形式・配信サービス・URL・キー・パスフレーズを設定し、確認する
uv run kosensai-live atem check      # 確認だけを行う
```

ATEM の映像の形式を `config.json` の `video.mode` に、配信の送信先を本部 PC の Ch1 の SRT Listener に設定します。配信中は設定できないため、`uv run kosensai-live atem stop` の後に実行します。品質（`HyperDeck Low`）は ATEM Software Control で設定します（ATEM 本体に保存されるため、設営時に 1 回だけ設定します）。

| コマンド | 内容 |
| --- | --- |
| `atem get` | 現在の設定を表示する（パスフレーズも表示する） |
| `atem start` / `atem stop` | 配信を開始・停止する |
| `atem watch [秒]` | 配信の状態とビットレートを 1 秒ごとに表示する（既定は 10 秒） |

### 2-4. スマートフォン（Ch2）を設定する

```bash
uv run kosensai-live urls
```

「1.」の遊撃の `Moblin` の URL を Moblin に入力します。「2.」は obs-multi-rtmp の送出先、「3.」は視聴の URL で、どちらも確認用です。

### 2-5. 配信を開始する

1. ATEM の配信を開始する（`uv run kosensai-live atem start`）。
2. スマートフォンの配信を開始する。
3. obs-multi-rtmp のドックで「すべて開始」を押す。
4. OBS の「録画開始」を押す（[3-4.](#3-4-録画)）。

---

## 3. OBS の構成

### 3-1. シーン

| シーン | 用途 |
| --- | --- |
| `[音声] 常時` | Ch1・Ch2 の音声のソースを置くシーン。映像は画面の外にあり、映りません |
| `[操作] パネル` | 操作パネル（`overlays/control.html`）。OBS でソースを右クリックし「対話」で開いて、お知らせと遊撃の現在地を選びます |
| `[出力] Ch1 第一体育館` | obs-multi-rtmp の Ch1 の出力 |
| `[出力] Ch2 遊撃` | obs-multi-rtmp の Ch2 の出力 |
| `[録画] Ch1 第一体育館`・`[録画] Ch2 遊撃` | Ch ごとのクリーンフィード（テロップの無い映像）の録画 |
| `Ch3 …` | Ch3（プログラム）で切り替えるシーン。待機・第一体育館・遊撃・2 画面・UP NEXT・タイムテーブル・CM |

Ch3 はシーンをクリックした時点で切り替わります。スタジオモードは使用しません。待機画面などのページは本番に出た時に読み込み直すため、プレビューと本番が分かれるスタジオモードでは意図した表示になりません。`obs build` はスタジオモードを無効にします。

### 3-2. 音声

obs-multi-rtmp でプログラム以外のシーンを送出しても、そのシーンにしか無いソースの音声は OBS のミキサーに入りません。そのため、Ch1・Ch2 の音声のソースは `[音声] 常時` に置き、`channels.lua` がこのシーンを出力チャンネルにつないで、常にミキサーに入れます。

| ソース | トラック | 本部のモニター |
| --- | --- | --- |
| `Ch1 音声 (USB)` | 2（Ch1）。Ch3 で第一体育館を映している間は 1 も | Ch3 で第一体育館を映している間 |
| `Ch2 iPhone` | 3（Ch2）。Ch3 で遊撃を映している間は 1 も | Ch3 で遊撃を映している間 |
| `Ch1 ATEM` | なし（ATEM の埋め込み音声は使用しません） | なし |
| `BGM` | 1（待機・UP NEXT・タイムテーブルのシーンを出している間だけ鳴ります） | 常に |

`channels.lua` は、プログラムのシーンに `Ch1 ATEM` が映っていれば `Ch1 音声 (USB)` を、`Ch2 iPhone` が映っていれば `Ch2 iPhone` をトラック 1 に入れ、本部のモニターにも出します。本部では Ch3 の視聴者と同じ音を聞きます。両方が映る 2 画面では Ch1 の音声を使用します。待機画面などの全画面のシーンでは、Ch3 に会場の音声は入りません。CM はスライドショー（画像）のため、音声はありません。`BGM` にはファイルを指定していないため、既定では無音です。音楽を流す場合は、OBS で `BGM` に音楽のファイルを指定します（ループして再生し、待機・UP NEXT・タイムテーブルの間で切り替えても続きから再生します）。

### 3-3. 出力（obs-multi-rtmp）

| 出力 | 映像のシーン | 音声のトラック | ビットレート |
| --- | --- | --- | --- |
| Ch1 | `[出力] Ch1 第一体育館` | 2 | `config.json` の `bitrateKbps` |
| Ch2 | `[出力] Ch2 遊撃` | 3 | 同上 |
| Ch3 | プログラム（OBS のシーンの切り替え） | 1 | 同上 |

エンコーダーは `scenes.json` の `video_encoder` で OS ごとに指定します（Windows は NVENC、macOS は VideoToolbox、Linux は x264）。CBR、キーフレーム間隔 2 秒です。キーフレーム間隔は、配信サーバーの `hosts/server/mediamtx.yml` の `hlsSegmentDuration` と同じ値にします。

### 3-4. 録画

OBS の「録画開始」で、次の 3 つが同時に始まります。保存先は OBS の録画の設定のパスです。

| ファイル | 内容 |
| --- | --- |
| `<日時> Ch1.mkv` | `[録画] Ch1 第一体育館`（ATEM の映像だけ）と、トラック 2（第一体育館の音声） |
| `<日時> Ch2.mkv` | `[録画] Ch2 遊撃`（スマートフォンの映像だけ）と、トラック 3（遊撃の音声） |
| `<日時>.mkv` | プログラム（Ch3）。OBS の通常の録画で、テロップを含みます |

3 つとも `scenes.json` の `recordings` の設定（CBR 12 Mbps、音声 320 kbps、mkv）で録画します。Ch1・Ch2 は Source Record のフィルターが、Ch3 は OBS の出力の「シンプル」の設定（`obs build` がプロファイルに書く）が録画します。配信休止の間は、録画も休止の画面になり、音声はミュートされます。

### 3-5. 配信休止

第一体育館の配信をしない演目（`program.json` の種類が `ng` の項目）は、本部が演目の始まりと終わりを見て、ホットキーで切り替えます。演目の時刻は押しや巻きでずれるため、時刻では切り替えません。操作パネルが、遅延を反映した時刻で配信休止を予告します。

「配信休止: 出す」で、`channels.lua` が次の 2 つを行います。「配信休止: 消す」で戻します。休止の状態はスクリプトの設定に保存され、OBS を再起動しても残ります。

- `[出力] Ch1 第一体育館`・`[録画] Ch1 第一体育館`・`Ch3 第一体育館`・`Ch3 2 画面` の `配信休止`（`overlays/pause.html`）を表示し、映像を隠す。
- `Ch1 音声 (USB)` をミュートする。トラックの割り当ては変えません。

obs-multi-rtmp の出力は開始した時点のシーンに固定されるため、プログラムのシーンの切り替えでは Ch1 の映像は変わりません。休止は出力のシーンの中のソースの表示で切り替えます。

待機画面とタイムテーブルは、配信しない演目の時間を「配信休止中」として表示します。`scenes.json` を変更した後は、「ツール → スクリプト」の `channels.lua` の「scenes.json を読み直す」を押します。

### 3-6. CM

CM は、kosensai-live-assets の `cm/out/` の画像（1920x1080）を、ファイル名の順に 6 秒ずつ表示するスライドショーです。画像の一覧は `obs build` が設定します。スライドショーの入力は次の 3 つです。

| 入力 | 置き場所 | 動作 |
| --- | --- | --- |
| `CM` | `Ch3 CM`（全画面） | 表示していない間も進む |
| `CM 小窓` | `Ch3 遊撃` の右下 | 隠すと止まり、次に表示すると続きから進む |
| `CM 自動` | `Ch3 遊撃` の全画面 | 同上 |

`channels.lua` は、`Ch3 遊撃` に毎時 5 分ごとに CM を 30 秒表示し、隠します（`scenes.json` の `cm_corner`）。普段は右下の `CM 小窓` を、遊撃の映像が切れて休止の画面が出ている間は全画面の `CM 自動` を出します。毎回、前回の続きのスライドから出ます。ホットキーの「CM 小窓: 出さない」で止めて表示中の CM も隠し、「CM 小窓: 自動で出す」で戻します。状態はスクリプトの設定に保存され、OBS を再起動しても残ります。`cm/out/` に画像が無い場合は表示しません。

待機・タイムテーブル・2 画面では、右下に出演の並びや見出しがあり小窓と重なるため、小窓を置いていません。待機中に CM を出す場合は、全画面の `Ch3 CM` に切り替えます。

### 3-7. 遊撃の映像が切れた時

`Ch2 iPhone` の下に `遊撃 休止`（`overlays/pause.html?ch=ch2`）を配置しています。スマートフォンからの SRT が切れて映像が消えると、「配信休止中 | 遊撃」の画面が見えます。映像が消えている間は、`channels.lua` が遊撃のテロップを隠します（`scenes.json` の `signal_lost`）。SRT は数秒の途切れでは切断にならないため、短い途切れでは画面は変わらず、直前の映像が止まって見えます。

### 3-8. 操作パネル

`[操作] パネル` の `操作パネル`（`overlays/control.html`）を右クリックし「対話」で開きます。配信には映らないため、画面のデザインは使用しません。

| 項目 | 内容 |
| --- | --- |
| 状態 | 今の第一体育館の演目、遅延、表示中のお知らせ、遊撃の現在地 |
| 配信休止の予告 | 次の配信休止の演目と、遅延を反映した時刻。ホットキーの操作を促す |
| 第一体育館の遅延 | 演目が始まった時に「開始」を押すと、その演目以降の時刻を、予定との差だけずらす。待機画面・UP NEXT・タイムテーブル・テロップ・休止の画面の時刻に反映する。「遅延を削除」で予定に戻す |
| お知らせ | 文言の登録と削除。「ループ」に入れたお知らせを 1 分ごとに 1 件ずつ 15 秒出す。「即時」は 15 秒だけ出し、「固定」は解除するまで出し続ける |
| 遊撃の現在地 | 候補（`program.json` の `ch2.places`）か自由な文言を選ぶと、次の発表の枠が始まるまで出す。発表の枠（公式のイベントスケジュールの `ch` が `ch2` の項目）の間は枠の演目を出す。何も無ければ `ch2.default` を出す |

状態はブラウザソースの localStorage に保存され、OBS を再起動しても残ります。

---

## 4. テロップ（overlays/）

テロップと全画面の画面は、OBS の「ブラウザソース」で `overlays/` の HTML を読み込みます。サイズはすべて 1920x1080 です。

| ファイル | 内容 |
| --- | --- |
| `lower-third.html` | 現在の演目のテロップ。`?ch=ch1`（既定）は第一体育館、`?ch=ch2` は遊撃 |
| `clock.html` | 左上の時計 |
| `notice.html` | お知らせの帯。操作パネルの固定・即時・ループのお知らせを出す |
| `watermark.html` | 右上のロゴの透かし |
| `lobby.html` | `standby.html` と `timetable.html` を交互に出す（次の出演の 5 分前からは待機画面に固定） |
| `standby.html` | 待機画面（開始前と休憩中の残り時間、配信休止中、終了後） |
| `upnext.html` | 次の演目の全画面の告知 |
| `timetable.html` | 当日のタイムテーブル |
| `split.html` | 2 画面の背景と見出し |
| `pause.html` | 配信休止の画面。`?ch=ch1`（既定）は第一体育館の配信休止、`?ch=ch2` は遊撃の映像が切れた時 |
| `control.html` | 操作パネル（[3-8.](#3-8-操作パネル)） |

- 演目・時刻・お知らせの初期値は kosensai-live-assets の `program.json` に書きます（[6.](#6-programjson)）。各画面は URL の `?assets=` の場所から `program.json` を読み込み、現在時刻と操作パネルの状態（遅延・お知らせ・遊撃の現在地）から表示を切り替えます。
- ブラウザで開いて確認する場合は、URL に `?assets=<kosensai-live-assets の場所>` を付けます。`&now=2026-10-24T13:35` を付けると、その時刻から時計を進めて表示します。
- 操作パネルの状態は、`control.html` が localStorage と BroadcastChannel で各画面に渡します。
- 色と線の規則は `overlay.css` の先頭に書いています。
- 計器の画像（`design/gauge/`）と待機画面の時計の画像（`design/clock-face/`）は、`design/render/` のスクリプトで Blender の Cycles で描画します。形・材質・光源を変えた場合は、次で描き直してコミットします。

  ```bash
  uv run kosensai-live render gauge
  uv run kosensai-live render clock
  ```

  Blender は、環境変数 `BLENDER`、`PATH` の `blender`、OS の既定のインストール先の順に探します。GPU（OptiX・CUDA・HIP・oneAPI・Metal）があれば GPU だけで描画します。

---

## 5. scenes.json

`scenes.json` は OBS の Lua（`obs_data`）でも読むため、配列の要素はオブジェクトにします（配列の中の配列や文字列は `obs_data` で読めません）。

| キー | 内容 |
| --- | --- |
| `collection` | シーンコレクションの名前 |
| `profile` | プロファイルの名前。映像の形式と obs-multi-rtmp の出力を設定する |
| `program_scene` | 作成後にプログラムに出すシーン |
| `places` | 配置の名前 → `{x, y, w, h}`。`pane-left`・`pane-right` は `overlays/split.html` の映像の枠と一致させる |
| `inputs` | 入力の名前 → 種類と設定。`type` は `srt`（`channel` の SRT Listener、ポートとパスフレーズは `config.json` と `.env`）、`audio`（音声入力のデバイス）、`page`（`overlays/` の `page`、`query` で引数、`replay` で表示のたびに読み込み直す）、`slides`（`cm` のフォルダの画像のスライドショー。`behavior` は隠している間の動作で、`always_play` は進み、`pause_unpause` は止まる）、`media`（動画・音楽のファイル。OBS で指定する。`restart` が false なら同じ入力を持つシーンの間で切り替えても続きから再生し、`loop` が false なら 1 回だけ再生する）。`tracks` は音声のトラックの番号。`audio` の `device` はデバイスの名前の一部（`kosensai-live obs devices` で確認する）。`monitor` が true の入力は常に本部のモニターに出す |
| `scenes` | シーンの名前 → 下から順の `{source, place, hidden}`。`hidden` の項目は `channels.lua` が必要な時だけ表示する |
| `video_encoder` | OS（`win32`・`darwin`・`linux`）ごとの映像のエンコーダーの ID。出力と録画に使用する |
| `outputs` | obs-multi-rtmp の出力。`video_param` はエンコーダーの設定、`audio_bitrate` は音声のビットレート（kbps）、`channels` は Ch ごとの映像のシーン（無ければプログラム）と音声のトラック。映像のビットレートは `config.json` の `bitrateKbps` |
| `recordings` | 録画。`video_param` はエンコーダーの設定（ビットレートを含む）、`audio_bitrate`、`format` はファイルの形式、`scenes` は Source Record で録画するシーン・音声のトラック・ファイル名に付ける名前、`program_encoder` は Ch3（OBS の通常の録画）の OS ごとのエンコーダー（出力の「シンプル」の名前） |
| `audio.always` | 音声のソースを置き、常にミキサーに入れるシーン |
| `audio.ch3` | Ch3（トラック 1）の音声の候補 `{video, audio}`。プログラムに `video` が映っていると、`audio` をトラック 1 に入れる（先の項目を優先） |
| `audio.pause` | 配信休止の対象。ホットキーの「配信休止: 出す」で、`source` を表示し、`audio` をミュートする |
| `cm` | CM のスライドショー。`folder` は kosensai-live-assets の中の画像のフォルダ、`slide_sec` は 1 枚を表示する秒数 |
| `cm_corner` | `scene` に、毎時 `every_min` 分ごとに CM を `show_sec` 秒表示する。普段は `source`（右下）を、`lost_video` の映像が消えている間は `full_source`（全画面）を出す |
| `signal_lost` | 映像が消えた時に隠すソース。`video` の幅が 0 の間（SRT が切れている間）、`hide` のソースを全シーンで隠す |

- `Ch1 音声 (USB)` の `device` は、Windows の表示名 `ライン (2- USB AUDIO  CODEC)` から、USB ポートで変わる番号（`2-`）を除いたものです（空白は 2 つ）。
- TODO：Windows の NVENC（`obs_nvenc_h264_tex`）の出力は、本番機で未確認です。NVENC は obs-multi-rtmp の 3 出力、Source Record の 2 つ、Ch3 の録画の 6 か所で同時に使用します（Sunshine を使う場合は 7 か所）。GPU とドライバーが同時に扱えるセッション数を本番機で確認します。
- macOS の Ch3 の録画は x264 にしています。Ch3 の録画に VideoToolbox を使うと、Source Record の VideoToolbox のエンコーダーが「Unsupported color format」で動かず、Ch1・Ch2 のファイルが作られませんでした（OBS 32.1.2、Source Record 0.4.8）。
- 仕様補完：obs-multi-rtmp の音声のビットレートは 160 kbps としました（OBS の既定値）。
- 仕様補完：録画は Ch1〜Ch3 とも CBR 12 Mbps（ATEM の送出の品質 `HyperDeck Low` と同じ）、音声 320 kbps、mkv（録画中に OBS が落ちてもファイルが残る形式）としました。
- 仕様補完：CM は 1 枚 6 秒、`Ch3 遊撃` に 5 分ごとに 30 秒、右下の小窓は 480x270 としました。遊撃の休止中も同じ間隔で、全画面で出します。
- 仕様補完：Linux のエンコーダーは、GPU によらず使用できる x264 としました。

## 6. program.json

kosensai-live-assets の `program.json` の形式です。

| キー | 内容 |
| --- | --- |
| `title` | 画面の左上に出す名前 |
| `events` | 日付 → 公式サイトのイベントスケジュール（<https://kosensai.ichinoseki.ac.jp/events>）の `{venue, start, end, title, ch}`。`ch` が無い項目は配信しない |
| `ch1.days` | 日付 → 第一体育館の出演順 `{end, items}`。`items` は `{at, title, kind}` で、終了は次の項目の `at`、最後は `end` |
| `ch1.kinds` | `kind` の表示名。`band` = 軽音楽部、`dance` = ダンス部、`break` = 休憩、`ng` = 配信しない時間 |
| `ch2.default` | 遊撃の発表の枠の外で、操作パネルで現在地を選んでいない時に出す `{title, place}` |
| `ch2.places` | 操作パネルで選ぶ遊撃の現在地の候補 `{title, place}`。選ぶと次の発表の枠が始まるまで出す |
| `notices` | お知らせの初期値。操作パネルで登録・削除すると、操作パネルの状態が優先する |

遊撃の発表の枠は、`events` の `ch` が `ch2` の項目です。


- 2 日目の軽音楽部は 14:00 まで、公式の枠は 14:30 までなので、14:00〜14:30 は休憩にしています。
- ダンス部は 14:50 以降の撮影と録画をしないため、`ng` にしています。`ng` は待機画面とタイムテーブルの表示に使用し、配信休止はホットキーで切り替えます。
- 仕様補完：遊撃の発表の枠の外に出す現在地の既定値を「校内の様子（校内各所）」としました。
- 仕様補完：お知らせのループは、1 分ごとに 1 件を 15 秒出すとしました（`overlays/overlay.js` の `NOTICE_CYCLE`・`NOTICE_SHOW`）。
