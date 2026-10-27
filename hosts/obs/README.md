# hosts/obs — 本部 PC（OBS）

本部 PC は、ATEM とスマートフォンから SRT で受信した映像にテロップを合成し、チャンネルごとに配信サーバー（MediaMTX）へ送出します。

| パス | 内容 |
| --- | --- |
| `scenes.json` | OBS の構成（プロファイル、入力、シーン、obs-multi-rtmp の出力、録画、会場、配信休止・転換・CM、ホットキー、OBS 全体の設定）（[5.](#5-scenesjson)） |
| `atem.json` | ATEM の配信の品質と音声のミキサー |
| `overlays/` | テロップと全画面の画面（ブラウザソースの HTML・JS・CSS）（[4.](#4-テロップoverlays)） |
| `design/` | 画面のフォント、計器と時計の画像と、画像を描画する Blender のスクリプト |
| `channels.lua` | 音声の振り分け、配信休止、転換の画面、CM の自動表示、受信の確認と操作パネルを行う OBS のスクリプト |
| `relay-task.ps1` | 中継（[3-9.](#3-9-中継relay)）を Windows の起動時に動かすタスクの登録 |

その年の中身（進行の `program.json`、CM のスライド）は、このリポジトリには含めず、kosensai-live-assets のフォルダに置きます。OBS と ATEM は、CLI の `kosensai-live`（[tools/kosensai_live/](../../tools/kosensai_live/)）が `config.json`・`.env`・`scenes.json`・`atem.json` と kosensai-live-assets から設定します。

---

## 1. 準備

本部 PC は Windows・macOS・Linux のどれでも構いません。次を用意します。

| もの | バージョン | 入手先・用途 |
| --- | --- | --- |
| OBS Studio | 32.1.2 で確認 | <https://obsproject.com/>。SRT のプラグインは不要です |
| ffmpeg | 9.0.2（gyan.dev の essentials）で確認 | <https://www.gyan.dev/ffmpeg/builds/>。SRT に対応したビルド。中継（[3-9.](#3-9-中継relay)）が使用します |
| obs-multi-rtmp | 0.7.4 | <https://github.com/sorayuki/obs-multi-rtmp/releases/tag/0.7.4>。Ch ごとの送出。`obs build` はこのバージョンの設定ファイルを書き出します |
| Source Record | 0.4.8 | <https://github.com/exeldro/obs-source-record/releases/tag/0.4.8>。遊撃のクリーンフィードの録画 |
| uv、Git | ― | <https://docs.astral.sh/uv/>。`kosensai-live` を実行します。Python 3.12 は uv が用意します |

プラグインは、OBS を終了した状態で各リリースのインストーラーを実行して入れます。

kosensai-live を clone し、同じ階層に kosensai-live-assets のフォルダを置いて、kosensai-live の場所で作業します。

```bash
git clone https://github.com/Eizouken-NITIC/kosensai-live.git
cd kosensai-live
```

kosensai-live-assets を別の場所に置いた場合は、`uv run kosensai-live obs build --assets <場所>` で指定するか、環境変数 `KOSENSAI_LIVE_ASSETS` に場所を設定します。

1. 配信サーバーと同じ `hosts/server/.env` を、本部 PC の `hosts/server/.env` に置きます。配信サーバーをまだ用意していない場合は、`hosts/server/.env.example` をコピーして値を入れます（設定項目は [hosts/server/README.md](../server/README.md)）。
2. `.env` の `HQ_IP` に本部 PC の IP、`SERVER_IP` に配信サーバーの IP、`ATEM_IP` に ATEM の IP、`OBS_RECORD_DIR` に録画の保存先を設定します。
3. 次を実行し、NG が無いことを確認します。

   ```bash
   uv run kosensai-live check
   ```

4. OBS を起動し、「ツール → WebSocket サーバー設定」でサーバーを有効にします。
5. Windows では、管理者の PowerShell で次を実行し、中継を PC の起動時に動かすタスクと、SRT のポート（`config.json` の `obsListenPort`）の受信の許可を登録します。登録の直後は `schtasks /run /tn "kosensai-live relay"` で起動します。macOS・Linux では、`uv run kosensai-live relay` を別の端末で動かし続けます。

   ```powershell
   powershell -ExecutionPolicy Bypass -File hosts\obs\relay-task.ps1 -Ffmpeg <ffmpeg.exe の場所>
   ```

6. 本部のヘッドホンを、OS の既定の出力デバイスにします（OBS のモニタリングデバイスは「既定」のまま使用します）。

---

## 2. 設定の手順

### 2-1. OBS を設定する

配信と録画を停止した状態で実行します。

```bash
uv run kosensai-live obs build
```

| 設定するもの | 内容 |
| --- | --- |
| プロファイル | `KOSENSAI-LIVE`。映像の形式は `config.json` の `video.mode`（1080p29.97）。Ch3 の録画の設定 |
| 録画の保存先 | `.env` の `OBS_RECORD_DIR` |
| スタジオモード | 無効 |
| シーンコレクション | `KOSENSAI-LIVE`。`scenes.json` のシーンの項目の有無・並び・配置を `scenes.json` に合わせます。項目の表示・非表示は変えません。`scenes.json` に無いシーンには手を加えません |
| ソース | 中継の TCP の URL、ページのファイルの場所（URL の `?assets=` に kosensai-live-assets の場所）、CM のスライドの一覧、音声のトラック。毎回上書きします |
| グローバル音声デバイス | 「設定 → 音声」のデスクトップ音声・マイク音声を削除します |
| スクリプト | 「ツール → スクリプト」に `channels.lua` を追加します |
| OBS 全体の設定 | `scenes.json` の `obs_settings`。終了時にプロジェクターを保存する、録画の停止の時に確認する、OBS が前面に無くてもホットキーを有効にする、起動時に更新を確認しない |
| 録画 | `[録画] Ch2 遊撃` の Source Record のフィルター（[3-4.](#3-4-録画)） |
| obs-multi-rtmp の出力 | Ch1・Ch2・Ch3 の 3 つ（[3-3.](#3-3-出力obs-multi-rtmp)）。送出先の URL とパスフレーズは `.env` から作ります |

obs-multi-rtmp の出力、Ch3 の録画の設定、録画のフィルター、グローバル音声デバイス、`channels.lua` の追加、OBS 全体の設定のいずれかを変える場合、`obs build` は「OBS を終了してください」と表示して OBS の終了を待ち、終了した後に書き込みます。書き込んだら OBS を起動し直します。

ホットキーは、`channels.lua` が `scenes.json` の `hotkeys` のキーを割り当てます。操作パネル（[3-8.](#3-8-操作パネル)）と受信の確認（[3-10.](#3-10-受信の確認)）にも一覧が出ます。

| 操作 | キー |
| --- | --- |
| 受信の確認を開く | F1 |
| 操作パネルを開く | F2 |
| 第一体育館 転換: 出す / 消す | F3 / F4 |
| 遊撃 休止: 出す / 消す | F7 / F8 |
| 第一体育館 休止: 出す / 消す | F9 / F10 |
| CM 小窓: 自動で出す / 出さない | F11 / F12 |

kosensai-live-assets の `program.json` や `cm/out/` を変更した場合は、本部 PC で `git pull` した後に `obs build` を実行し直します。`obs build` は全てのブラウザソースを読み込み直します。

### 2-2. 会場の音声を ATEM に入れる

第一体育館の音声は、配信用ミキサーの出力を ATEM の MIC 1（3.5 mm）に入れ、ATEM が映像と一緒に送ります。OBS では同期オフセットを設定しません。ATEM の音声のミキサーは `atem apply` が設定します（[2-3.](#2-3-atem-を設定する)）。

### 2-3. ATEM を設定する

配信を停止した状態で実行します（`uv run kosensai-live atem stop`）。

```bash
uv run kosensai-live atem apply      # 設定し、確認する
uv run kosensai-live atem check      # 確認だけを行う
```

| 設定するもの | 値 |
| --- | --- |
| 映像の形式 | `config.json` の `video.mode` |
| 配信 | サービス `Custom URL H.264`、送信先は本部 PC の中継（Ch1 の SRT Listener）、キーは空、パスフレーズは `.env` の `OBS_CH1_LISTEN_PASSPHRASE` |
| 品質 | `atem.json` の `bitrate`（HyperDeck Low。配信と USB ディスクへの収録に適用される） |
| 音声のミキサー | `atem.json` の `audio`。MIC 1 を ON、カメラの入力と MIC 2 を OFF |

ISO 収録（カメラごとの収録）は、ATEM Software Control で有効にします（ATEM 本体に保存されます）。

| コマンド | 内容 |
| --- | --- |
| `atem get` | 現在の設定を表示する（パスフレーズも表示する） |
| `atem start` / `atem stop` | 配信を開始・停止する |
| `atem watch [秒]` | 配信の状態とビットレートを 1 秒ごとに表示する（既定は 10 秒） |

### 2-4. スマートフォン（Ch2）を設定する

```bash
uv run kosensai-live urls
```

「1.」の遊撃の `Moblin` の URL を Moblin に入力します。「2.」は obs-multi-rtmp の送出先、「3.」は視聴の URL です。

### 2-5. 配信を開始する

1. ATEM の配信を開始する（`uv run kosensai-live atem start`）。ATEM の収録を開始する。
2. スマートフォンの配信を開始する。
3. obs-multi-rtmp のドックで「すべて開始」を押す。
4. OBS の「録画開始」を押す（[3-4.](#3-4-録画)）。

---

## 3. OBS の構成

### 3-1. シーン

| シーン | 用途 |
| --- | --- |
| `[音声] 常時` | `Ch1 ATEM`・`Ch2 iPhone` と `操作パネル` を画面の外に置くシーン。`channels.lua` が出力チャンネルにつなぎ、常に有効にします |
| `[確認] 受信` | 第一体育館と遊撃の受信の映像（[3-10.](#3-10-受信の確認)）。プログラムには出しません |
| `[出力] Ch1 第一体育館` | obs-multi-rtmp の Ch1 の出力 |
| `[出力] Ch2 遊撃` | obs-multi-rtmp の Ch2 の出力 |
| `[録画] Ch2 遊撃` | 遊撃のクリーンフィード（テロップの無い映像）の録画 |
| `Ch3 …` | Ch3（プログラム）で切り替えるシーン。待機・第一体育館・遊撃・2 画面・UP NEXT・タイムテーブル・CM |

Ch3 はシーンをクリックした時点で切り替わります（スタジオモードは使用しません）。

### 3-2. 音声

| ソース | トラック | 本部のモニター |
| --- | --- | --- |
| `Ch1 ATEM` | 2（Ch1）。Ch3 で第一体育館を映している間は 1 も | Ch3 で第一体育館を映している間 |
| `Ch2 iPhone` | 3（Ch2）。Ch3 で遊撃を映している間は 1 も | Ch3 で遊撃を映している間 |
| `BGM` | 1（待機・UP NEXT・タイムテーブルのシーンを出している間だけ鳴ります） | 常に |

- `channels.lua` は、プログラムのシーンに映っている会場の音声をトラック 1（Ch3）と本部のモニターに出します。両方が映る 2 画面では第一体育館の音声を使用します。待機画面などの全画面のシーンでは、Ch3 に会場の音声は入りません。
- CM には音声がありません。
- `BGM` は既定では無音です。音楽を流す場合は、OBS で `BGM` に音楽のファイルを指定します（ループして再生し、待機・UP NEXT・タイムテーブルの間で切り替えても続きから再生します）。

### 3-3. 出力（obs-multi-rtmp）

| 出力 | 映像のシーン | 音声のトラック | ビットレート |
| --- | --- | --- | --- |
| Ch1 | `[出力] Ch1 第一体育館` | 2 | `config.json` の `bitrateKbps` |
| Ch2 | `[出力] Ch2 遊撃` | 3 | 同上 |
| Ch3 | プログラム | 1 | 同上 |

エンコーダーは `scenes.json` の `video_encoder`（Windows は NVENC のプリセット p2・1 パス、macOS は VideoToolbox、Linux は x264）で、CBR、キーフレーム間隔 2 秒です。

### 3-4. 録画

| 録画 | 行うもの | 内容 |
| --- | --- | --- |
| 第一体育館のクリーンフィード | ATEM（USB ディスクへの収録） | プログラムとカメラごとの映像、ATEM の音声。OBS と配信休止によらず続く |
| `<日時> Ch2.mkv` | OBS（Source Record） | `[録画] Ch2 遊撃` と、トラック 3（遊撃の音声）。遊撃の配信休止の間は黒になり、音声はミュートされる |
| `<日時>.mkv` | OBS（通常の録画） | プログラム（Ch3）。テロップを含む |

OBS の 2 つは、OBS の「録画開始」で同時に始まり、`OBS_RECORD_DIR` に `scenes.json` の `recordings` の設定（CBR 12 Mbps、音声 320 kbps、mkv）で保存します。エンコーダーは、Ch2 が `recordings.encoder`（Windows は x264 の veryfast）、Ch3 が `recordings.program_encoder`（Windows は NVENC）です。

### 3-5. 配信休止

配信休止は会場ごとにホットキーで切り替えます（`scenes.json` の `audio.pause`）。第一体育館の配信をしない演目（`program.json` の種類が `ng` の項目）は、本部が演目の始まりと終わりを見て切り替えます。操作パネルが、遅延を反映した時刻で配信休止を予告します。休止の状態は OBS を再起動しても残ります。

| 会場 | 「休止: 出す」で行うこと（「休止: 消す」で戻す） |
| --- | --- |
| 第一体育館（F9 / F10） | `[出力] Ch1 第一体育館`・`Ch3 第一体育館`・`Ch3 2 画面` に `配信休止`（`overlays/pause.html`）を出し、`Ch1 ATEM` の音声をミュートする。ATEM の収録は続く |
| 遊撃（F7 / F8） | 全シーンの `Ch2 iPhone` の映像と `テロップ 遊撃` を隠し、映像の下の `遊撃 休止`（「配信休止中 \| 遊撃」）を見せる。`Ch2 iPhone` の音声をミュートする |

待機画面とタイムテーブルは、配信しない演目の時間を「配信休止中」として表示します。

### 3-6. CM

CM は、kosensai-live-assets の `cm/out/` の画像（1920x1080）を、ファイル名の順に 6 秒ずつ表示するスライドショーです。

| 入力 | 置き場所 | 動作 |
| --- | --- | --- |
| `CM` | `Ch3 CM`（全画面） | 表示していない間も進む |
| `CM 小窓` | `Ch3 遊撃` の右下 | 隠すと止まり、次に表示すると続きから進む |
| `CM 自動` | `Ch3 遊撃` の全画面 | 同上 |

- `channels.lua` は、`Ch3 遊撃` に毎時 5 分ごとに CM を 30 秒出します（`scenes.json` の `cm_corner`）。普段は右下の `CM 小窓` を、遊撃の映像が切れているか休止している間は全画面の `CM 自動` を出します。
- ホットキーの「CM 小窓: 出さない」で止めて表示中の CM も隠し、「CM 小窓: 自動で出す」で戻します。状態は OBS を再起動しても残ります。
- `cm/out/` に画像が無い場合は出しません。
- 待機・タイムテーブル・2 画面には小窓がありません。待機中に CM を出す場合は、`Ch3 CM` に切り替えます。

### 3-7. 遊撃の映像が切れた時

`Ch2 iPhone` の下に `遊撃 休止`（`overlays/pause.html?ch=ch2`）を置いています。スマートフォンからの SRT が切れて映像が消えると「配信休止中 | 遊撃」の画面が見え、`channels.lua` が遊撃のテロップを隠します（`scenes.json` の `signal_lost`）。数秒の途切れでは画面は変わらず、直前の映像が止まって見えます。送信元がつなぎ直すと、映像は自動で戻ります。

### 3-8. 操作パネル

ホットキーの「操作パネルを開く」（F2）で、`操作パネル`（`overlays/control.html`）の「対話」のウィンドウを開きます。プログラムのシーンは変わりません。「遅延」「お知らせ」「遊撃」のタブで表示を切り替え、長い表は「▲」「▼」で送ります。

| 項目 | 内容 |
| --- | --- |
| 状態 | 今の第一体育館の演目、遅延、表示中のお知らせ、遊撃の現在地、各会場の受信（受信中・切断中と切断した時刻・休止中・転換中） |
| ホットキー | キーと操作の一覧 |
| 配信休止の予告 | 次の配信休止の演目と、遅延を反映した時刻 |
| 第一体育館の遅延 | 演目が始まった時に「開始」を押すと、その演目以降の時刻を、予定との差だけずらす。待機画面・UP NEXT・タイムテーブル・テロップ・休止の画面の時刻に反映する。「遅延を削除」で予定に戻す |
| お知らせ | 文言の登録と削除。「ループ」に入れたお知らせを 1 分ごとに 1 件ずつ 15 秒出す。「即時」は 15 秒だけ出し、「固定」は解除するまで出し続ける |
| 遊撃の現在地 | 候補（`program.json` の `ch2.places`）か自由な文言を選ぶと、次の発表の枠が始まるまで出す。発表の枠の間は枠の演目を出す。何も無ければ `ch2.default` を出す |

状態はブラウザソースの localStorage に保存され、OBS を再起動しても残ります。

### 3-9. 中継（relay）

ATEM とスマートフォンの SRT は、本部 PC の中継（`uv run kosensai-live relay`、`tools/kosensai_live/relay.py`）が受けます。

```
ATEM・iPhone ──SRT──▶ 中継（ffmpeg、:obsListenPort）──TCP──▶ OBS の Ch1 ATEM・Ch2 iPhone（127.0.0.1:relayPort に接続）
```

- 中継は `relayPort` で OBS の接続を待ち、OBS が接続したら `obsListenPort` で SRT を受け、映像と音声をそのまま OBS へ送ります（ポートは `config.json`）。
- 送信元が切断すると、中継は OBS への接続を閉じ、OBS の映像が消えます。送信元がつなぎ直すと、OBS を再起動せずに映像が戻ります。
- タスクで動かす場合、中継の出力は `hosts/obs/.relay/relay.log` に追記されます。
- 中継を止める場合は、`kosensai-live.exe`（`relay`）のプロセスを子のプロセス（ffmpeg）ごと終了します。

### 3-10. 受信の確認

ホットキーの「受信の確認を開く」（F1）で、`[確認] 受信` のウィンドウ プロジェクターを開きます。`Ch1 ATEM` と `Ch2 iPhone` の受信の映像を並べ、上に会場の名前と受信の状態（受信中・切断中と切断した時刻・休止中・転換中）、下にホットキーの一覧を出します（`overlays/monitor.html`）。配信休止でも映像は隠しません。

### 3-11. 転換の画面

第一体育館の演目の間の転換中は、ホットキーの「第一体育館 転換: 出す」（F3）で、`[出力] Ch1 第一体育館` と `Ch3 第一体育館` に `UP NEXT 第一体育館`（`overlays/upnext.html`）を全画面で出し、「第一体育館 転換: 消す」（F4）で消します（`scenes.json` の `transition`）。本部が転換の始まりと終わりを見て切り替えます。

- 音声はミュートしません。
- テロップ・お知らせ・時計の上に重なり、ウォーターマークと配信休止の画面はその上に出ます。
- 「NEXT」には、今の時刻より後に始まる最初の出演（遅延を反映した時刻）を出します。
- 状態は OBS を再起動しても残ります。

## 4. テロップ（overlays/）

テロップと全画面の画面は、OBS の「ブラウザソース」で `overlays/` の HTML を読み込みます。サイズは 1920x1080 です（操作パネルは 1280x1000）。

| ファイル | 内容 |
| --- | --- |
| `lower-third.html` | 現在の演目のテロップ。`?ch=ch1`（既定）は第一体育館、`?ch=ch2` は遊撃。演目が変わった時と、その後 3 分ごとに 20 秒だけ大きく出し、それ以外は 1 行にする。第一体育館は下端の段に「つぎ」を出す |
| `clock.html` | 左上の時計 |
| `notice.html` | お知らせの帯。帯に収まらない文言は、先頭で 2 秒止めてから 120 px/秒で末尾まで流し、末尾で 2 秒止めて先頭に戻る。`?beside=ch1` では、第一体育館のテロップの「つぎ」が出ている間、その右に並べる |
| `watermark.html` | 右上のロゴの透かし |
| `lobby.html` | `standby.html`（20 秒）・`upnext.html`（15 秒）・`timetable.html`（15 秒）を順に出す。次の出演の 5 分前からは待機画面に固定する |
| `standby.html` | 待機画面（開始前と休憩中の残り時間、配信休止中、終了後） |
| `upnext.html` | 次の演目の全画面の告知 |
| `timetable.html` | 当日のタイムテーブル |
| `split.html` | 2 画面の背景と見出し |
| `pause.html` | 配信休止の画面。`?ch=ch1`（既定）は第一体育館、`?ch=ch2` は遊撃 |
| `control.html` | 操作パネル（[3-8.](#3-8-操作パネル)） |
| `monitor.html` | 受信の確認（[3-10.](#3-10-受信の確認)） |

- 演目・時刻・お知らせの初期値は kosensai-live-assets の `program.json` に書きます（[6.](#6-programjson)）。各画面は URL の `?assets=` の場所から `program.json` を読み込み、現在時刻と操作パネルの状態（localStorage と BroadcastChannel）から表示を切り替えます。
- ブラウザで開いて確認する場合は、URL に `?assets=<kosensai-live-assets の場所>` を付けます。`&now=2026-10-24T13:35` を付けると、その時刻から時計を進めて表示します。
- 色と線の規則は `overlay.css` の先頭にあります。
- 計器の画像（`design/gauge/`）と待機画面の時計の画像（`design/clock-face/`）は、`design/render/` のスクリプトで Blender（Cycles）で描画します。形・材質・光源を変えた場合は、次で描き直してコミットします。Blender は、環境変数 `BLENDER`、`PATH` の `blender`、OS の既定のインストール先の順に探します。

  ```bash
  uv run kosensai-live render gauge
  uv run kosensai-live render clock
  ```

---

## 5. scenes.json

配列の要素はオブジェクトにします（`channels.lua` も読むため）。

| キー | 内容 |
| --- | --- |
| `collection` | シーンコレクションの名前 |
| `profile` | プロファイルの名前 |
| `program_scene` | シーンコレクションを作った時にプログラムに出すシーン |
| `places` | 配置の名前 → `{x, y, w, h}`。`pane-left`・`pane-right` は `overlays/split.html` の映像の枠、`monitor-left`・`monitor-right` は `overlays/monitor.html` のラベルの位置と一致させる |
| `inputs` | 入力の名前 → 種類と設定。`type` は `srt`（`channel` の中継の TCP）、`page`（`overlays/` の `page`。`query` は引数、`replay` は表示のたびに読み込み直す、`width`・`height` はページの大きさで既定は 1920x1080）、`slides`（`cm` のフォルダの画像のスライドショー。`behavior` は隠している間の動作で、`always_play` は進み、`pause_unpause` は止まる）、`media`（動画・音楽のファイル。OBS で指定する。`restart` が false なら同じ入力を持つシーンの間で切り替えても続きから再生し、`loop` が false なら 1 回だけ再生する）。`tracks` は音声のトラックの番号、`monitor` が true の入力は常に本部のモニターに出す |
| `scenes` | シーンの名前 → 下から順の `{source, place, hidden}`。`hidden` の項目は `channels.lua` が必要な時だけ表示する |
| `obs_settings` | OBS 全体の設定のファイル（`user.ini`・`global.ini`）→ セクション → キー → 値 |
| `video_encoder` | OS（`win32`・`darwin`・`linux`）ごとの映像のエンコーダーの ID。出力と録画に使用する |
| `outputs` | obs-multi-rtmp の出力。`video_param` はエンコーダーの設定、`audio_bitrate` は音声のビットレート（kbps）、`channels` は Ch ごとの映像のシーン（無ければプログラム）と音声のトラック |
| `recordings` | 録画。`video_param` はエンコーダーの設定、`audio_bitrate`、`format` はファイルの形式、`scenes` は Source Record で録画するシーン・音声のトラック・ファイル名に付ける名前、`encoder` は Source Record の OS ごとのエンコーダー、`program_encoder` は Ch3 の OS ごとのエンコーダー（出力の「シンプル」の名前）、`program_nvenc_preset` はその NVENC のプリセット |
| `venues` | 会場 `{id, name, source}`。`id` は Ch の id、`name` は操作パネル等とホットキーに出す名前、`source` は会場の映像と音声の入力。`audio`・`transition`・`signal_lost`・`cm_corner` は会場を `id` で指定する。`overlays/monitor.html` は、この順に左（`monitor-left`）・右（`monitor-right`）の映像に会場の状態を出す |
| `audio.always` | 会場の入力と操作パネルを置き、常に有効にするシーン |
| `audio.ch3` | Ch3（トラック 1）の音声の候補の会場 `{venue}`。プログラムに会場の映像が映っていると、その会場の音声をトラック 1 に入れる（先の項目を優先し、休止中の会場は除く） |
| `audio.pause` | 会場ごとの配信休止 `{venue, show, hide}`。「<会場> 休止: 出す」で `show` のソースを表示し、`hide` のソースを隠し、会場の音声をミュートする |
| `transition` | 会場ごとの転換の画面 `{venue, show}`。「<会場> 転換: 出す」で `show` のソースを表示し、「<会場> 転換: 消す」で隠す |
| `monitor` | 受信の確認。`scene` はウィンドウ プロジェクターで開くシーン（配信休止では隠さない）、`pages` は会場ごとの状態とホットキーの一覧を送るブラウザソース `{source}` |
| `panel` | 操作パネル。`source` は「操作パネルを開く」で「対話」のウィンドウを開くブラウザソース |
| `hotkeys` | ホットキーの ID（`monitor.open`・`panel.open`・`pause.<会場の id>.on`・`pause.<会場の id>.off`・`transition.<会場の id>.on`・`transition.<会場の id>.off`・`cm.on`・`cm.off`）→ キー（`F9` のように `OBS_KEY_` を除いた名前）。`channels.lua` の読み込みと「scenes.json を読み直す」のたびに割り当てる |
| `cm` | CM のスライドショー。`folder` は kosensai-live-assets の中の画像のフォルダ、`slide_sec` は 1 枚を表示する秒数 |
| `cm_corner` | `scene` に、毎時 `every_min` 分ごとに CM を `show_sec` 秒表示する。普段は `source`（右下）を、`lost_venue` の会場の映像が消えているか休止している間は `full_source`（全画面）を出す |
| `signal_lost` | 映像が消えた時に隠すソース `{venue, hide}`。会場の映像が消えている（SRT が切れている）間、`hide` のソースを全シーンで隠す |

## 6. program.json

kosensai-live-assets の `program.json` の形式です。

| キー | 内容 |
| --- | --- |
| `title` | 画面の左上に出す名前 |
| `events` | 日付 → 公式サイトのイベントスケジュール（<https://kosensai.ichinoseki.ac.jp/events>）の `{venue, start, end, title, ch}`。`ch` が無い項目は配信しない。`ch` が `ch2` の項目は遊撃の発表の枠 |
| `ch1.days` | 日付 → 第一体育館の出演順 `{end, items}`。`items` は `{at, title, kind}` で、終了は次の項目の `at`、最後は `end` |
| `ch1.kinds` | `kind` の表示名。`band` = 軽音楽部、`dance` = ダンス部、`break` = 休憩、`ng` = 配信しない時間 |
| `ch2.default` | 遊撃の発表の枠の外で、操作パネルで現在地を選んでいない時に出す `{title, place}` |
| `ch2.places` | 操作パネルで選ぶ遊撃の現在地の候補 `{title, place}` |
| `notices` | お知らせの初期値。操作パネルで登録・削除すると、操作パネルの状態が優先する |
