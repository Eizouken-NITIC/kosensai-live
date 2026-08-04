# サードパーティのソフトウェア

本リポジトリには第三者が著作権を有するソフトウェアが含まれています。内訳と適用される
ライセンスは次のとおりです。ライセンスの全文は `licenses/` に収録しています。

## 配布物へ同梱しているもの

`web/` はビルド成果物であり、Git の追跡対象として本リポジトリに含まれます。配信サーバー
上の Caddy はこのディレクトリをそのまま配信するため、以下は視聴者の端末へ配布されます。

| ソフトウェア | バージョン | ライセンス | 著作権者 | 全文 |
| --- | --- | --- | --- | --- |
| [hls.js](https://github.com/video-dev/hls.js) | 1.6.16 | Apache-2.0 | Dailymotion | [licenses/hls.js-Apache-2.0.txt](licenses/hls.js-Apache-2.0.txt) |
| [Media Chrome](https://github.com/muxinc/media-chrome) | 4.19.2 | MIT | Mux, Inc. | [licenses/media-chrome-MIT.txt](licenses/media-chrome-MIT.txt) |
| [Noto Sans JP](https://github.com/notofonts/noto-cjk) | Fontsource 5.3 経由 | OFL-1.1 | Google Inc. | [licenses/noto-sans-jp-OFL-1.1.txt](licenses/noto-sans-jp-OFL-1.1.txt) |

hls.js と Media Chrome は Vite によってバンドルされ、`web/_app/immutable/chunks/` 配下へ
出力されます。

Noto Sans JP は [Fontsource](https://github.com/fontsource/font-files) の
`@fontsource-variable/noto-sans-jp` を経由して取得しており、フォントファイルは
unicode-range で分割された 124 個の woff2 として `web/_app/immutable/assets/` 配下へ
出力されます。SIL Open Font License 1.1 は、フォントを再配布する各コピーが著作権表示と
ライセンス本文を伴うことを条件としています。`licenses/noto-sans-jp-OFL-1.1.txt` が
これに当たります。

## 実行時に取得するもの

次のソフトウェアは配信サーバー上で Docker がイメージとして取得するものであり、本リポジトリ
には含まれません。本リポジトリが持つのは、これらへ与える設定ファイルのみです。

| ソフトウェア | バージョン | ライセンス |
| --- | --- | --- |
| [MediaMTX](https://github.com/bluenviron/mediamtx) | 1.19.3 | MIT |
| [Caddy](https://github.com/caddyserver/caddy) | 2.11.4 | Apache-2.0 |

`rehearsal/` のテスト配信では、MediaMTX の ffmpeg 同梱イメージに含まれる
[FFmpeg](https://ffmpeg.org/) を使用します。これも同様にイメージとして取得するもので、
本リポジトリには含まれません。
