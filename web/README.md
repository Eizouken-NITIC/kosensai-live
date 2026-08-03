# web — 配信サイト（視聴ページ・サイネージページ）

配信サーバー（`hosts/server/`）の Caddy が `/srv/live` としてマウントし、
そのまま静的配信する成果物。特定のマシンに紐づくものではなく、
**電算部 HP 部門と共同で内容を詰める**ものなので `hosts/` の外に置いてある。

| URL | ファイル |
| --- | --- |
| `https://live.kosensai.ichinoseki.ac.jp/` | `index.html` |
| `https://live.kosensai.ichinoseki.ac.jp/?ch=ch3` | 同上（Ch 直接指定） |
| `https://live.kosensai.ichinoseki.ac.jp/signage/` | `signage/index.html` |

## ファイル

```
web/
├─ index.html            視聴ページ（Ch タブ切替 + 公式サイト iframe）
├─ signage/index.html    サイネージページ（Kiosk 全画面）
├─ channels.json         ★ チャンネル定義の単一の情報源
├─ assets/
│  ├─ theme.css          ⚠️ 暫定テーマ。HP 部門とすり合わせて差し替える
│  ├─ viewer.css         視聴ページのレイアウト
│  ├─ signage.css        サイネージのレイアウト
│  └─ player.js          HLS 再生ロジック（両ページ共通）
└─ vendor/hls.min.js     hls.js 1.6.15（学内完結のためローカルに同梱）
```

## ⚠️ スタイルの扱い

`assets/theme.css` の色・フォント・角丸は **配信班が仮で置いた値**であって、
確定デザインではない。Notion「責務分担 > 共同で進めるもの」の通り、
配信サイトの見た目は HP 部門とすり合わせて決める項目。

そのため:

- **HTML に色・余白を直書きしない。** すべて `theme.css` の CSS 変数を経由する。
- **レイアウト（viewer.css / signage.css）とテーマ（theme.css）を分けてある。**
  すり合わせ後は `theme.css` の `:root` を差し替えるだけで済む。
- HP 側のデザインが出てきたら、まず `theme.css` を置き換えて突き合わせる。

決める必要があること:

- ライト / ダークどちらを基調にするか（現状はダーク＝映像が主役の前提）
- 高専祭のキーカラー（`--accent`、現状は仮の青）
- 見出しフォント（現状は OS 標準の日本語サンセリフのみ）

## チャンネル定義

`channels.json` が単一の情報源。ここを直すと以下すべてに反映される。

- 視聴ページのタブ
- サイネージの対象 Ch
- `hosts/obs/srt-urls.sh` が生成する OBS 用 URL
- `hosts/server/scripts/preflight.sh` の突き合わせチェック

`id` は MediaMTX のパス名（`hosts/server/mediamtx.yml` の `paths:`）と
一致していなければならない。preflight がずれを検出する。

**Ch2（第二体育館）は開催有無が未確定。** 無くなったら `channels.json` から
1 要素、`mediamtx.yml` から 1 ブロック消すだけでよい。

## ローカルで確認する

```bash
python3 -m http.server 8080 --directory web
# http://localhost:8080/          視聴ページ
# http://localhost:8080/signage/  サイネージ
```

`/hls/` が無いので「まだ配信が始まっていないようです」表示になる。
レイアウト・タブ・iframe の確認はこれで足りる。

映像込みで見たい場合は、配信サーバーを立てて `smoke-test.sh` でテストパターンを
流しながらブラウザで開く。

## 設計上の判断

- **hls.js はローカル同梱**（CDN 参照ではない）。学内限定配信なので、
  外部到達性に依存させない。更新は `vendor/hls.min.js` の差し替え。
- **通常 HLS（セグメント 6 秒）がデフォルト。** LL-HLS はリクエスト頻度が
  大きく増えるため、低遅延が本当に必要と判明した場合のみ検討する。
- **画質選択 UI は無し。** MediaMTX はトランスコード／ABR 非対応で 1Ch 1 品質。
- **デフォルトはタブ切替（グリッド同時視聴ではない）。** 全視聴者が 4ch 同時に見ると
  4.5Mbps × 4ch × 100 人 = 1.8Gbps となり LAG 2Gbps の上限に近づく。
- **配信前でも 10 秒ごとに自動リトライ。** 開場前にサイネージ端末を先に起動しておける。
- **公式サイトは iframe で合成**（private→public は Chrome LNA 対象外）。
  コンテンツを複製せずタイムテーブルを同一画面に出せる。
  成立条件は公式サイト側に `X-Frame-Options` / `CSP frame-ancestors` が無いこと。
  → `docs/checklist.md §G` で確認する。**付いていたら iframe は諦めてリンクに切り替える。**
