# hosts/obs — 本部配信PC（OBS設定・ユーティリティ）

本ディレクトリは、現場から送信されたSRTストリームを受信・合成し、チャンネルごとに配信サーバー（MediaMTX）へ向けて送信する本部PC（OBS）に関する設定とユーティリティを管理しています。

このディレクトリ内にあるのは、SRTの接続用URLを一括生成する `srt-urls.sh` スクリプトのみです。配信サーバーへ直接デプロイするファイルはありません。

---

## 1. キーフレーム間隔の設定

OBS側の**キーフレーム間隔**の設定値は、配信サーバー側の設定ファイル `hosts/server/mediamtx.yml` 内の `hlsSegmentDuration` の値（デフォルトは **2秒**）と同一に設定してください。

---

## 2. srt-urls.sh（URL生成スクリプト）

各種入力・出力用のURLは手動で入力せず、本スクリプトで生成したURLをコピー＆ペーストして使用してください。

### スクリプトの実行方法

```bash
# 配信サーバー側の .env が参照できるディレクトリで実行します
./hosts/obs/srt-urls.sh                    # MediaMTXが同一ホストにある場合

# 配信サーバー（MediaMTX）とOBSが異なるマシンにある場合
MTX_HOST=10.1.2.3 OBS_HOST=10.1.2.4 ./hosts/obs/srt-urls.sh
```

### 出力されるURL
1. **OBSメディアソース用URL**: OBSのメディアソース（SRT Listener）に入力するURL、および現場の送信端末（Caller）に渡す接続用URL
2. **OBS送出用URL**: OBSからMediaMTXへストリームを送信するURL
3. **視聴用URL**: 視聴テスト用の動作確認用URL

各チャンネルの定義（待受ポート、レイテンシ、ビットレート等）および視聴URLのホスト名は、すべてリポジトリ直下の `config.json` から自動的に読み込まれます。
SRT接続用のパスフレーズは `hosts/server/.env` の設定を読み込みます。

- 現場 → OBS（出力 1）には `OBS_<Ch>_LISTEN_PASSPHRASE` を使います。現場の端末に渡すのはこの値です。
- OBS → MediaMTX（出力 2）には `MTX_PATHS_<Ch>_SRTPUBLISHPASSPHRASE` を使います。この値は現場に渡さないでください。
- 配信サーバーは、`.env` の `HQ_IP` からの送出だけを受け付けます。OBS を動かす PC の IP を `HQ_IP` に設定してください。
