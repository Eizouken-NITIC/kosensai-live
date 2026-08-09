# hosts/obs — 本部メイン PC（OBS）

**設置場所:** 本部・統合制御室
**担当:** 映像研（マシン調達は NW 班）
**役割:** Ch1〜Ch3 の SRT 受信・監視、Ch4 の合成、Ch1〜Ch4 の MediaMTX への送出

OBS の入力・出力・エンコード設定・録画方針・当日のトラブル対応は、Notion
「ソフトウェア構成・設定例 §3」にある。

## キーフレーム間隔

OBS のキーフレーム間隔は、`hosts/server/mediamtx.yml` の `hlsSegmentDuration` と
同一にする。いずれも 2 秒である。

HLS のセグメントはキーフレームでのみ分割されるため、片方だけを変更すると、実際の
セグメント長は長い方に引き伸ばされる。セグメント長は再生の遅延と視聴開始までの
待ち時間の双方を決める。

## srt-urls.sh

**入力・出力の URL は手打ちしない。** パスフレーズの打ち間違いは、当日もっとも
切り分けにくい種類の事故になる。

```bash
# 配信サーバー側の .env が読める場所で実行する
./hosts/obs/srt-urls.sh                    # MediaMTX が同一ホスト
MTX_HOST=10.1.2.3 OBS_HOST=10.1.2.4 ./hosts/obs/srt-urls.sh
```

出力は 3 つに分かれる。

1. OBS のメディアソース（SRT Listener）に入れる URL と、現場側へ渡す Caller の URL
2. obs-multi-rtmp から MediaMTX へ送出する URL
3. 視聴 URL

チャンネル定義（ポート・latency・ビットレート）の出どころはリポジトリ直下の
`config.json` だけである。Ch2 が無くなったらそこを削れば、このスクリプトの出力も
視聴ページも一緒に追従する。

パスフレーズは `hosts/server/.env` から読む。出力には実値がそのまま含まれるため、
画面共有やチャットへの貼り付けに注意する。
