# hosts/obs — 本部の PC（OBS）

現場からの SRT を受け、合成し、Ch ごとに MediaMTX へ送出する PC である。このディレクトリに
あるのは `srt-urls.sh` だけで、デプロイするファイルは無い。

OBS 自体の入力・出力・エンコード設定は Notion「ソフトウェア構成・設定例 §3」にある。

## キーフレーム間隔

OBS のキーフレーム間隔は、`hosts/server/mediamtx.yml` の `hlsSegmentDuration` と
同一にする。いずれも 2 秒である。

HLS のセグメントはキーフレームでのみ分割されるため、片方だけを変更すると、実際の
セグメント長は長い方に引き伸ばされる。セグメント長は再生の遅延と視聴開始までの
待ち時間の双方を決める。

## srt-urls.sh

**入力・出力の URL は手打ちしない。** パスフレーズが 1 文字違うと publish が拒否され、
理由は「invalid passphrase」としか出ない。

```bash
# 配信サーバー側の .env が読める場所で実行する
./hosts/obs/srt-urls.sh                    # MediaMTX が同一ホスト
MTX_HOST=10.1.2.3 OBS_HOST=10.1.2.4 ./hosts/obs/srt-urls.sh
```

出力は 3 つに分かれる。

1. OBS のメディアソース（SRT Listener）に入れる URL と、現場側へ渡す Caller の URL
2. obs-multi-rtmp から MediaMTX へ送出する URL
3. 視聴 URL

チャンネル定義（ポート・latency・ビットレート）と視聴 URL のホスト名は、いずれも
リポジトリ直下の `config.json` から読む。Ch を増減させる場合はそこだけを変えれば、
このスクリプトの出力も視聴ページも追従する。パスフレーズは `hosts/server/.env` から読む。
