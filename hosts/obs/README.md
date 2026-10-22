# hosts/obs — 本部 PC（OBS）

本部 PC は、ATEM とスマートフォンから SRT で受信した映像にテロップを合成し、チャンネルごとに配信サーバー（MediaMTX）へ送出します。

| パス | 内容 |
| --- | --- |
| `assets/` | 今年の構成。進行（`program.json`）、OBS のシーン・出力（`scenes.json`）、フォント、計器と時計の画像と Blender のソース（[assets/README.md](assets/README.md)） |
| `overlays/` | テロップと全画面の画面（ブラウザソースの HTML・JS・CSS） |
| `channels.lua` | 音声の振り分け、本部のモニター、配信休止を行う OBS のスクリプト |

OBS・ATEM の設定は、リポジトリの CLI（`kosensai-live`、[tools/kosensai_live/](../../tools/kosensai_live/)）が `config.json`・`.env`・`assets/scenes.json` から行います。

---

## 1. 準備

本部 PC は Windows・macOS・Linux のどれでも構いません。次を用意します。

| もの | バージョン | 入手先・用途 |
| --- | --- | --- |
| OBS Studio | 32.1.2 で確認 | <https://obsproject.com/>。SRT の受信と送出は OBS に含まれる FFmpeg（libsrt）で行うため、SRT のプラグインは不要です |
| obs-multi-rtmp | 0.7.4 | <https://github.com/sorayuki/obs-multi-rtmp/releases/tag/0.7.4>。Ch ごとの送出。`kosensai-live obs build` は、このバージョンの設定ファイルを書き出します |
| Source Record | 0.4.8 | <https://github.com/exeldro/obs-source-record/releases/tag/0.4.8>。Ch ごとのクリーンフィードの録画。無い場合、`obs build` はエラーで止まります |
| uv、Git | ― | <https://docs.astral.sh/uv/>。`kosensai-live` を実行します |
| C コンパイラ | ― | ATEM の制御に使用する pyatem が C 拡張を含むため、初回の `uv run` でビルドします。Windows は Microsoft C++ Build Tools（`winget install Microsoft.VisualStudio.2022.BuildTools --override "--passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"`）、macOS は `xcode-select --install`、Linux は `gcc` |

プラグインは、OBS を終了した状態で各リリースのインストーラー（Windows は `.exe`、macOS は `.pkg`）を実行して入れます。

リポジトリを clone した場所で作業します。

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
| シーンコレクション | `KOSENSAI-LIVE`。`scenes.json` のシーンは、項目の有無・並び・配置を `scenes.json` に合わせます。項目の表示・非表示は変えません（`channels.lua` が切り替えるため）。`scenes.json` に無いシーンには手を加えません |
| ソース | SRT Listener の URL とパスフレーズ、ページのファイルの場所、音声のデバイスとトラック。毎回上書きします |
| 録画 | `[録画] …` のシーンの Source Record のフィルター（[3-4.](#3-4-録画)） |
| obs-multi-rtmp の出力 | Ch1・Ch2・Ch3 の 3 つ（[3-3.](#3-3-出力obs-multi-rtmp)）。送出先の URL とパスフレーズは `.env` から作ります |

obs-multi-rtmp の出力、Ch3 の録画の設定（プロファイル）、Ch1・Ch2 の録画のフィルターが変わる場合、`obs build` は「OBS を終了してください」と表示して OBS の終了を待ち、終了した後に設定を書き込みます。書き込んだら OBS を起動し直します。obs-multi-rtmp は設定を OBS の起動時に読んで終了時に書き戻し、録画の設定は起動中に変えると録画の出力と食い違うためです。

その後、OBS で次を設定します。

1. 「ツール → スクリプト」で `hosts/obs/channels.lua` を追加する。
2. 「設定 → ホットキー」で「配信休止: 出す」「配信休止: 消す」「CM 小窓: 自動で出す」「CM 小窓: 出さない」にキーを割り当てる。
3. 「設定 → 音声 → 詳細設定」のモニタリングデバイスに、本部のヘッドホンをつなぐデバイスを選ぶ。
4. 「設定 → 出力 → 録画」の録画ファイルのパスに、録画を保存するディスクを選ぶ（Source Record もこのパスに保存します）。
5. `Ch1 音声 (USB)` の「オーディオの詳細プロパティ」で同期オフセットを設定する（リハーサルで実測した値）。USB オーディオは SRT の映像より早く届くためです。
6. `CM` に動画ファイルを指定する。

### 2-2. 音声のデバイスを指定する

```bash
uv run kosensai-live obs devices
```

`Ch1 音声 (USB)` に選べるデバイスの名前を表示します。配信用ミキサーの名前（の一部）を `assets/scenes.json` の `Ch1 音声 (USB)` の `device` に書き、`uv run kosensai-live obs build` をもう一度実行します。`device` が無い場合、`obs build` は WARN を表示し、OS の既定の入力を使用します。

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

### 3-2. 音声

obs-multi-rtmp でプログラム以外のシーンを送出しても、そのシーンにしか無いソースの音声は OBS のミキサーに入りません。そのため、Ch1・Ch2 の音声のソースは `[音声] 常時` に置き、`channels.lua` がこのシーンを出力チャンネルにつないで、常にミキサーに入れます。

| ソース | トラック | 本部のモニター |
| --- | --- | --- |
| `Ch1 音声 (USB)` | 2（Ch1）。Ch3 で第一体育館を映している間は 1 も | Ch3 で第一体育館を映している間 |
| `Ch2 iPhone` | 3（Ch2）。Ch3 で遊撃を映している間は 1 も | Ch3 で遊撃を映している間 |
| `Ch1 ATEM` | なし（ATEM の埋め込み音声は使用しません） | なし |
| `CM` | 1（CM のシーンを出している間だけ鳴ります） | 常に |
| `CM 小窓` | なし（映像だけ） | なし |
| `BGM` | 1（待機・UP NEXT・タイムテーブルのシーンを出している間だけ鳴ります） | 常に |

`channels.lua` は、プログラムのシーンに `Ch1 ATEM` が映っていれば `Ch1 音声 (USB)` を、`Ch2 iPhone` が映っていれば `Ch2 iPhone` をトラック 1 に入れ、本部のモニターにも出します。本部では Ch3 の視聴者と同じ音を聞きます。両方が映る 2 画面では Ch1 の音声を使用します。待機画面などの全画面のシーンでは、Ch3 に会場の音声は入りません。`BGM` にはファイルを指定していないため、既定では無音です。音楽を流す場合は、OBS で `BGM` に音楽のファイルを指定します（ループして再生し、待機・UP NEXT・タイムテーブルの間で切り替えても続きから再生します）。

### 3-3. 出力（obs-multi-rtmp）

| 出力 | 映像のシーン | 音声のトラック | ビットレート |
| --- | --- | --- | --- |
| Ch1 | `[出力] Ch1 第一体育館` | 2 | `config.json` の `bitrateKbps` |
| Ch2 | `[出力] Ch2 遊撃` | 3 | 同上 |
| Ch3 | プログラム（OBS のシーンの切り替え） | 1 | 同上 |

エンコーダーは `assets/scenes.json` の `video_encoder` で OS ごとに指定します（Windows は NVENC、macOS は VideoToolbox、Linux は x264）。CBR、キーフレーム間隔 2 秒です。キーフレーム間隔は、配信サーバーの `hosts/server/mediamtx.yml` の `hlsSegmentDuration` と同じ値にします。

### 3-4. 録画

OBS の「録画開始」で、次の 3 つが同時に始まります。保存先は OBS の録画の設定のパスです。

| ファイル | 内容 |
| --- | --- |
| `<日時> Ch1.mkv` | `[録画] Ch1 第一体育館`（ATEM の映像だけ）と、トラック 2（第一体育館の音声） |
| `<日時> Ch2.mkv` | `[録画] Ch2 遊撃`（スマートフォンの映像だけ）と、トラック 3（遊撃の音声） |
| `<日時>.mkv` | プログラム（Ch3）。OBS の通常の録画で、テロップを含みます |

3 つとも `assets/scenes.json` の `recordings` の設定（CBR 12 Mbps、音声 320 kbps、mkv）で録画します。Ch1・Ch2 は Source Record のフィルターが、Ch3 は OBS の出力の「シンプル」の設定（`obs build` がプロファイルに書く）が録画します。配信休止の間は、録画も休止の画面になり、音声はミュートされます。

### 3-5. 配信休止

第一体育館の配信をしない演目（`assets/program.json` の種類が `ng` の項目）は、本部が演目の始まりと終わりを見て、ホットキーで切り替えます。演目の時刻は押しや巻きでずれるため、時刻では切り替えません。操作パネルが、遅れを反映した時刻で配信しない演目を予告します。

「配信休止: 出す」で、`channels.lua` が次の 2 つを行います。「配信休止: 消す」で戻します。休止の状態はスクリプトの設定に保存され、OBS を再起動しても残ります。

- `[出力] Ch1 第一体育館`・`[録画] Ch1 第一体育館`・`Ch3 第一体育館`・`Ch3 2 画面` の `配信休止`（`overlays/pause.html`）を表示し、映像を隠す。
- `Ch1 音声 (USB)` をミュートする。トラックの割り当ては変えません。

obs-multi-rtmp の出力は開始した時点のシーンに固定されるため、プログラムのシーンの切り替えでは Ch1 の映像は変わりません。休止は出力のシーンの中のソースの表示で切り替えます。

待機画面とタイムテーブルは、配信しない演目の時間を「配信休止中」として表示します。`assets/scenes.json` を変更した後は、「ツール → スクリプト」の `channels.lua` の「assets を読み直す」を押します。

### 3-6. 右下の CM

`Ch3 遊撃` の右下に、`CM 小窓`（全画面の `CM` と同じ動画）を 5 分ごとに表示し、再生が終わったら隠します（`channels.lua`、`assets/scenes.json` の `cm_corner`）。小窓では音を出しません（会場の音と混ざるため）。動画のファイルは `CM` に指定したものを `channels.lua` が `CM 小窓` に合わせます。ホットキーの「CM 小窓: 出さない」で止めて表示中の小窓も隠し、「CM 小窓: 自動で出す」で戻します。状態はスクリプトの設定に保存され、OBS を再起動しても残ります。

待機・タイムテーブル・2 画面では、右下に出演の並びや見出しがあり小窓と重なるため、小窓を置いていません。待機中に CM を出す場合は、全画面の `Ch3 CM` に切り替えます。

### 3-7. 遊撃の映像が切れた時

`Ch2 iPhone` の下に `遊撃 休止`（`overlays/pause.html?ch=ch2`）を配置しています。スマートフォンからの SRT が切れて映像が消えると、「配信休止中 | 遊撃」の画面が見えます。映像が消えている間は、`channels.lua` が遊撃のテロップを隠します（`assets/scenes.json` の `signal_lost`）。SRT は数秒の途切れでは切断にならないため、短い途切れでは画面は変わらず、直前の映像が止まって見えます。

### 3-8. 操作パネル

`[操作] パネル` の `操作パネル`（`overlays/control.html`）を右クリックし「対話」で開きます。配信には映らないため、画面のデザインは使用しません。

| 項目 | 内容 |
| --- | --- |
| 状態 | 今の第一体育館の演目、遅れ、出ているお知らせ、遊撃の現在地 |
| 配信しない演目の予告 | 次の配信しない演目と、遅れを反映した時刻。ホットキーの操作を促す |
| 第一体育館の遅れ | 演目が始まった時に「始まった」を押すと、その演目と後の演目の時刻を、予定との差だけずらす。待機画面・UP NEXT・タイムテーブル・テロップ・休止の画面の時刻に反映する。「遅れをなくす」で予定に戻す |
| お知らせ | 文言の登録と削除。「ループ」に入れたお知らせを 1 分ごとに 1 件ずつ 15 秒出す。「今すぐ」は 15 秒だけ出し、「固定」は解除するまで出し続ける |
| 遊撃の現在地 | 候補（`program.json` の `ch2.places`）か自由な文言を選ぶと、次の発表の枠が始まるまで出す。発表の枠（公式のイベントスケジュールの `ch` が `ch2` の項目）の間は枠の演目を出す。何も無ければ `ch2.default` を出す |

状態はブラウザソースの localStorage に保存され、OBS を再起動しても残ります。

---

## 4. テロップ（overlays/）

テロップと全画面の画面は、OBS の「ブラウザソース」で `overlays/` の HTML を読み込みます。サイズはすべて 1920x1080 です。

| ファイル | 内容 |
| --- | --- |
| `lower-third.html` | 現在の演目のテロップ。`?ch=ch1`（既定）は第一体育館、`?ch=ch2` は遊撃 |
| `clock.html` | 左上の時計 |
| `notice.html` | お知らせの帯。操作パネルの固定・今すぐ・ループのお知らせを出す |
| `watermark.html` | 右上のロゴの透かし |
| `lobby.html` | `standby.html` と `timetable.html` を交互に出す（次の出演の 5 分前からは待機画面に固定） |
| `standby.html` | 待機画面（開始前と休憩中の残り時間、配信休止中、終了後） |
| `upnext.html` | 次の演目の全画面の告知 |
| `timetable.html` | 当日のタイムテーブル |
| `split.html` | 2 画面の背景と見出し |
| `pause.html` | 配信休止の画面。`?ch=ch1`（既定）は第一体育館の配信休止、`?ch=ch2` は遊撃の映像が切れた時 |
| `control.html` | 操作パネル（[3-8.](#3-8-操作パネル)） |

- 演目・時刻・お知らせの初期値は `assets/program.json` に書きます。各画面は現在時刻と操作パネルの状態（遅れ・お知らせ・遊撃の現在地）から表示を切り替えます。
- URL に `?now=2026-10-24T13:35` を付けると、その時刻から時計を進めて表示します。ブラウザで開いて確認できます。
- 操作パネルの状態は、`control.html` が localStorage と BroadcastChannel で各画面に渡します。
- 色と線の規則は `overlay.css` の先頭に書いています。
- 計器の画像（`assets/gauge/`）と待機画面の時計の画像（`assets/clock-face/`）は、`assets/render/` のスクリプトで Blender の Cycles で描画します。形・材質・光源を変えた場合は、次で描き直してコミットします。

  ```bash
  uv run kosensai-live render gauge
  uv run kosensai-live render clock
  ```

  Blender は、環境変数 `BLENDER`、`PATH` の `blender`、OS の既定のインストール先の順に探します。GPU（OptiX・CUDA・HIP・oneAPI・Metal）があれば GPU だけで描画します。
