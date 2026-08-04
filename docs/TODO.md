# TODO

## 1. 巻き戻しの制限を解除する

`app/src/lib/player.svelte.ts` の hls.js 設定に `liveMaxLatencyDurationCount: 10` が
含まれている。この値はライブ点からの許容遅延をターゲット長の倍数で指定するもので、
超過すると hls.js が再生位置をライブ点へ移動させる。セグメント長 2 秒との積により、
20 秒より前へシークした場合に引き戻される。既定値は `Infinity` であり、指定を削除する。

`hosts/server/mediamtx.yml` の `hlsSegmentCount` に付したコメントは、シーク可能な幅が
サーバーの保持本数で決まると記述している。これは視聴を開始した時点についてのみ正しい。
hls.js の `backBufferLength` は既定の `Infinity` であり、視聴を続けた分の巻き戻し幅は
クライアント側のバッファによって伸びる。記述を修正する。

## 2. hls.js を npm 依存へ移行する

`app/static/vendor/hls.min.js` を `<script>` で読み込む構成のため、`player.svelte.ts` に
hls.js の型定義 22 行と、読み込み完了を待つ `loadHlsJs()` 17 行を手書きしている。
npm の `hls.js` は `dist/hls.d.ts` を同梱しており、動的 import に置き換えれば
Vite が別チャンクへ分割するため遅延読み込みも維持される。学内で完結する要件は
バンドルに含まれることで満たされる。

`rehearsal/scripts/check.sh` と `hosts/server/Caddyfile` が `/vendor/` を参照している。

## 3. 再試行を hls.js の loadPolicy へ委譲する

配信開始前のチャンネルは 404 を返し続けるが、hls.js の `playlistLoadPolicy` の
既定は `maxNumRetry: 2` で打ち切るため、独自の再試行ループを持っている
（`RETRY_MS` / `failures` / `fail()` / `clearRetry()`、計 19 行）。
`playlistLoadPolicy` の `errorRetry` は `maxNumRetry` / `retryDelayMs` /
`maxRetryDelayMs` / `backoff` を持ち、同梱している 1.6.15 にも実装されている。
設定へ置き換える。未配信であることを画面へ表示する状態は残す。

## 4. 自動再生のブロックからの復帰を media-chrome へ委譲する

視聴ページには `<media-play-button>` が配置されており、ユーザー操作の受け口が
画面上に存在する。`attemptPlay()` の `blocked` 状態と、`+page.svelte` の
「▶ 再生する」を表示するカバーはこれと重複している。

サイネージは無人で運用するため、自動的に再試行する経路は残す。

## 5. タブ復帰時の処理の要否を確認する（実ブラウザでの確認が必要）

`onVisibility` は、タブへ復帰した際に再生が進まない場合へ接続を張り直す。
一方 hls.js は `detectStallWithCurrentTimeMs`（既定 1250ms）、`nudgeOffset`、
`highBufferWatchdogPeriod` によるストール検出と復帰を持ち、同梱ビルドにも
含まれている。この処理が無くても復帰するのであれば削除する。

ヘッドレスでは判定できないため、実際のブラウザでタブを切り替えて確認する。

## 6. ライブ点までの遅延をどこまで下げるか（判断待ち）

現状、LIVE ボタンを押した時点での遅延は 2〜3 秒である。MediaMTX はセグメントが
閉じるまでプレイリストへ追加しないため、最新のセグメントは常に 0〜2 秒前のものになり、
これに取得時間が加わる。`hlsSegmentDuration: 2s` である限りこれ以下にはならない。

選択肢は次のとおり。

| 方式 | 遅延 | 代償 |
|---|---|---|
| `hlsSegmentDuration: 1s` | 1〜1.5 秒 | OBS のキーフレーム間隔を 1 秒にする必要があり、同一画質に要するビットレートが増える |
| `hlsVariant: lowLatency` | 1 秒未満 | 要求数が増える。hls.js 側で `lowLatencyMode: true` が必要 |
| WebRTC | 1 秒未満 | 配信経路が別になり、キャッシュが効かない。多数の同時視聴での挙動が未検証 |

## 7. サーバー側の巻き戻し可能幅（判断待ち）

視聴を開始した直後に巻き戻せる幅は `hlsSegmentCount` × `hlsSegmentDuration` で、
現在は 7 × 2 秒 = 14 秒である。`hlsDirectory` を指定していないためセグメントは
メモリ上に保持され、本数を増やすとその分の RAM を消費する。

4.5 Mbps・2 秒のセグメント 1 本は約 1.1 MB であり、4 チャンネルで 3 分間を保持する
場合は 90 本 × 1.1 MB × 4 = 約 400 MB になる。`hlsDirectory` を指定してディスクへ
退避する方法もある。
