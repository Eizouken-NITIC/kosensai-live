# hosts/obs — 本部配信 PC（OBS 設定・ユーティリティ）

本ディレクトリは、ATEM とスマートフォンから送信された SRT ストリームを受信・合成し、チャンネルごとに配信サーバー（MediaMTX）へ向けて送信する本部 PC（OBS）に関する設定とユーティリティを管理しています。本部 PC はメイン会場（第一体育館）に置き、ATEM と同じ会場のスイッチに接続します。

このディレクトリ内にあるのは、SRT の接続用 URL を一括生成する `srt-urls.py` スクリプトのみです。配信サーバーへ直接デプロイするファイルはありません。

---

## 1. キーフレーム間隔の設定

OBS 側の**キーフレーム間隔**の設定値は、配信サーバー側の設定ファイル `hosts/server/mediamtx.yml` 内の `hlsSegmentDuration` の値（デフォルトは **2 秒**）と同一に設定してください。

---

## 2. srt-urls.py（URL 生成スクリプト）

各種入力・出力用の URL は手動で入力せず、本スクリプトで生成した URL をコピー＆ペーストして使用してください。

### スクリプトの実行方法

```bash
./hosts/obs/srt-urls.py                    # hosts/server/.env を読みます
./hosts/obs/srt-urls.py --env path/to/.env # 別の .env を読む場合
```

### 出力される URL
1. **OBS メディアソース用 URL**: OBS のメディアソース（SRT Listener）に入力する URL、および ATEM・スマートフォン（Caller）に設定する URL とパスフレーズ
2. **OBS 送出用 URL**: OBS から MediaMTX へストリームを送信する URL
3. **視聴用 URL**: 視聴テスト用の動作確認用 URL

各チャンネルの定義（待受ポート、レイテンシ、ビットレート等）および視聴 URL のホスト名は、すべてリポジトリ直下の `config.json` から自動的に読み込まれます。
SRT 接続用のパスフレーズと IP は `hosts/server/.env` の設定を読み込みます。配信サーバーと同じ `.env` を本部 PC にも配置してください。

- ATEM・スマートフォンの送信先（出力 1）は `HQ_IP`、OBS の送出先（出力 2）は `SERVER_IP` です。MediaMTX が本部 PC と同じホストにある場合は `SERVER_IP=127.0.0.1` にします。

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
- GUI を使用せず、`./tools/atem-stream/atem.py apply` で上の値をまとめて設定できます。`check` で設定値が `.env` と `config.json` に一致するかを確認できます。詳細は [tools/atem-stream/](../../tools/atem-stream/README.md) を参照してください。

OBS 側は「メディアソース」を追加し、「ローカルファイル」のチェックを外して、`srt-urls.py` の出力 1 の Listener の URL を「入力」に、`mpegts` を「入力フォーマット」に設定します。

---

## 4. Ch1 の音声

Ch1 の音声は、配信用ミキサーの USB オーディオを本部 PC に入力して使用します。ATEM のメディアソースの音声はミュートします。

USB オーディオは SRT の映像より早く届くため、USB オーディオのソースの「同期オフセット」で遅らせて映像に合わせます。オフセットの値はリハーサルで実測して設定してください。
