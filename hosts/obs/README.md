# hosts/obs — 本部配信 PC（OBS 設定・ユーティリティ）

本ディレクトリは、現場から送信された SRT ストリームを受信・合成し、チャンネルごとに配信サーバー（MediaMTX）へ向けて送信する本部 PC（OBS）に関する設定とユーティリティを管理しています。

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
1. **OBS メディアソース用 URL**: OBS のメディアソース（SRT Listener）に入力する URL、および現場の送信端末（Caller）に渡す接続用 URL
2. **OBS 送出用 URL**: OBS から MediaMTX へストリームを送信する URL
3. **視聴用 URL**: 視聴テスト用の動作確認用 URL

各チャンネルの定義（待受ポート、レイテンシ、ビットレート等）および視聴 URL のホスト名は、すべてリポジトリ直下の `config.json` から自動的に読み込まれます。
SRT 接続用のパスフレーズは `hosts/server/.env` の設定を読み込みます。

- 現場 → OBS（出力 1）には `OBS_<Ch>_LISTEN_PASSPHRASE` を使います。現場の端末に渡すのはこの値です。
- OBS → MediaMTX（出力 2）には `MTX_PATHS_<Ch>_SRTPUBLISHPASSPHRASE` を使います。この値は現場に渡さないでください。
- 配信サーバーは、`.env` の `HQ_IP` からの送出だけを受け付けます。OBS を動かす PC の IP を `HQ_IP` に設定してください。
