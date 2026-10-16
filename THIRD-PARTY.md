# サードパーティ製ソフトウェアのライセンスについて

本プロジェクトの `LICENSE` ファイルに記載されている「MIT License」が適用される範囲は、本リポジトリ向けに新規作成されたオリジナルのソースコードのみに限定されます。本リポジトリには第三者が著作権を有するソフトウェアが含まれており、それぞれ以下のライセンス条件が適用されます。

各ライセンスの全文は `app/static/licenses/` ディレクトリに格納しています。このディレクトリはビルド時に静的ファイルとして同梱されるため、公開後の配信サイトの `/licenses/` パスからも直接取得できます。

---

## 配布物に同梱しているソフトウェア

`web/` ディレクトリはビルド成果物の出力先であり、Git の追跡対象として本リポジトリに含まれています。配信サーバー上の Caddy がこのディレクトリをそのまま静的配信するため、以下のソフトウェアは視聴者のブラウザ端末へ配布されます。

| ソフトウェア | バージョン | ライセンス | 著作権者 | ライセンス全文へのリンク |
| --- | --- | --- | --- | --- |
| [hls.js](https://github.com/video-dev/hls.js) | 1.6.16 | Apache-2.0 | Dailymotion | [app/static/licenses/hls.js-Apache-2.0.txt](app/static/licenses/hls.js-Apache-2.0.txt) |
| [Media Chrome](https://github.com/muxinc/media-chrome) | 4.19.2 | MIT | Mux, Inc. | [app/static/licenses/media-chrome-MIT.txt](app/static/licenses/media-chrome-MIT.txt) |
| [driver.js](https://github.com/kamranahmedse/driver.js) | 1.8.0 | MIT | Kamran Ahmed | [app/static/licenses/driver.js-MIT.txt](app/static/licenses/driver.js-MIT.txt) |
| [Noto Sans JP](https://github.com/notofonts/noto-cjk) | Fontsource 5.3 経由 | OFL-1.1 | Google Inc. | [app/static/licenses/noto-sans-jp-OFL-1.1.txt](app/static/licenses/noto-sans-jp-OFL-1.1.txt) |
