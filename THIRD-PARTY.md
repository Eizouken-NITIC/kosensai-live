# サードパーティのソフトウェア

`LICENSE` に記載のMIT Licenseが適用される範囲は、本リポジトリのオリジナルコードに
限られます。本リポジトリには第三者が著作権を有するソフトウェアが含まれており、それらには
以下のライセンスが適用されます。

ライセンスの全文は `app/static/licenses/` に収録しています。このディレクトリはビルド時に
配信物へ含まれるため、配信サイトの `/licenses/` からも取得できます。

## 配布物へ同梱しているもの

`web/` はビルド成果物であり、Git の追跡対象として本リポジトリに含まれます。配信サーバー
上の Caddy はこのディレクトリをそのまま配信するため、以下は視聴者の端末へ配布されます。

| ソフトウェア | バージョン | ライセンス | 著作権者 | 全文 |
| --- | --- | --- | --- | --- |
| [hls.js](https://github.com/video-dev/hls.js) | 1.6.16 | Apache-2.0 | Dailymotion | [app/static/licenses/hls.js-Apache-2.0.txt](app/static/licenses/hls.js-Apache-2.0.txt) |
| [Media Chrome](https://github.com/muxinc/media-chrome) | 4.19.2 | MIT | Mux, Inc. | [app/static/licenses/media-chrome-MIT.txt](app/static/licenses/media-chrome-MIT.txt) |
| [Noto Sans JP](https://github.com/notofonts/noto-cjk) | Fontsource 5.3 経由 | OFL-1.1 | Google Inc. | [app/static/licenses/noto-sans-jp-OFL-1.1.txt](app/static/licenses/noto-sans-jp-OFL-1.1.txt) |

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
