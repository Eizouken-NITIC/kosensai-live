# hosts/obs — 本部配信 PC（OBS 設定・ユーティリティ）

本ディレクトリは、ATEM とスマートフォンから送信された SRT ストリームを受信・合成し、チャンネルごとに配信サーバー（MediaMTX）へ向けて送信する本部 PC（OBS）で実行するユーティリティを管理しています。

このディレクトリ内にあるのは、SRT の接続用 URL を一括生成する `srt-urls.py` スクリプトのみです。配信サーバーへ直接デプロイするファイルはありません。

---

## 1. srt-urls.py（URL 生成スクリプト）

各種入力・出力用の URL は手動で入力せず、本スクリプトで生成した URL をコピー＆ペーストして使用してください。

### スクリプトの実行方法

```bash
./hosts/obs/srt-urls.py                    # hosts/server/.env を読みます
./hosts/obs/srt-urls.py --env path/to/.env # 別の .env を読む場合
```

### 出力される URL
1. **OBS メディアソース用 URL**: OBS のメディアソース（SRT Listener）に入力する URL、および ATEM・スマートフォン（Caller）に設定する URL とパスフレーズ。OBS の URL の `latency` はマイクロ秒、Moblin 向けの URL の `latency` はミリ秒です（どちらも `config.json` の `srtLatencyUs` から換算します）
2. **OBS 送出用 URL**: OBS から MediaMTX へストリームを送信する URL
3. **視聴用 URL**: 視聴テスト用の動作確認用 URL

各チャンネルの定義（待受ポート、レイテンシ、ビットレート等）および視聴 URL のホスト名は、すべてリポジトリ直下の `config.json` から自動的に読み込まれます。
SRT 接続用のパスフレーズと IP は `hosts/server/.env` の設定を読み込みます。配信サーバーと同じ `.env` を本部 PC にも配置してください。

- ATEM・スマートフォンの送信先（出力 1）は `HQ_IP`、OBS の送出先（出力 2）は `SERVER_IP` です。MediaMTX が本部 PC と同じホストにある場合は `SERVER_IP=127.0.0.1` にします。

- ATEM・スマートフォン → OBS（出力 1）には `OBS_<Ch>_LISTEN_PASSPHRASE` を使います。ATEM とスマートフォンに設定するのはこの値です。
- OBS → MediaMTX（出力 2）には `MTX_PATHS_<Ch>_SRTPUBLISHPASSPHRASE` を使います。この値は ATEM・スマートフォンには設定しないでください。
- 配信サーバーは、`.env` の `HQ_IP` からの送出だけを受け付けます。OBS を動かす PC の IP を `HQ_IP` に設定してください。
- SRT の latency は送受信の大きい方の値が使われるため、ATEM・スマートフォンからの区間は OBS 側の Listener の URL の `latency`（`config.json` の `srtLatencyUs`）で決まります。

OBS 側は「メディアソース」を追加し、「ローカルファイル」のチェックを外して、出力 1 の Listener の URL を「入力」に、`mpegts` を「入力フォーマット」に設定します。

---

## 2. ATEM（Ch1）の設定

ATEM の配信設定（サービス名・URL・キー・パスフレーズ）は、`./tools/atem-stream/atem.py apply` で `.env` と `config.json` から設定し、`check` で確認します。詳細は [tools/atem-stream/](../../tools/atem-stream/README.md) を参照してください。
