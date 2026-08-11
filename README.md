# kosensai-live

映像研究部が、高専祭のライブ配信のために作った配信システムです！

実運用では、複数の会場にカメラとスイッチャーを配置しスイッチング、
映像を SRT で本部 PC（OBS）へ集約してテロップ等を合成、配信サーバー（MediaMTX + Caddy）へ送出します。
その後 MediaMTX で HLS に remux し、視聴ページに配信します。

外部サービスには映像を送出せず、イベント会場内で配信が完結しているのが大きな特徴です。
配信サーバーは、2026高専祭 ネットワークチームが構築した特設ネットワーク上で運用しています。視聴者は会場の 特設Wi-Fi AP に接続して視聴します。

| 領域 | 技術 |
| --- | --- |
| 映像伝送 | SRT |
| 配信 | HLS（MediaMTX が SRT → HLS に remux） |
| Web サーバー / TLS 終端 | Caddy |
| 視聴ページ / サイネージ | SvelteKit + TypeScript（静的プリレンダリング） |
| プレイヤー | hls.js + Media Chrome |
| サイネージ端末 | Raspberry Pi + Chromium Kiosk |
| コンテナ管理 | Docker Compose |

---

## 1. システム構成

安定した伝送のため、プロトコルには SRT を採用しています。

```
現場のカメラ
   │  HDMI等
   ▼
スイッチャー / 現場スマートフォン
   │  SRT Caller
   ▼
本部の PC (OBS)                            ← hosts/obs/
   │  チャンネルごとにエンコードし、SRT Caller で送信
   │  streamid=publish:chN
   ▼
配信サーバー (MediaMTX + Caddy)             ← hosts/server/
   │  SRT 受信 → HLS 生成 → Caddy が TLS 終端して配信
   ├───────────────► 視聴者のブラウザ
   └───────────────► サイネージ端末
```

配信サーバーでは MediaMTX が SRT ストリームを受信し、トランスコードせずに HLS へ remux します。トランスコードや ABR は行なわれません。Caddy が TLS 終端・リバースプロキシ・静的配信を担い、視聴ページとサイネージページも同じサーバーから配信します。

TLS 証明書は、配信サーバーがプライベートネットワーク上にあり HTTP-01 チャレンジが到達しないため、Let's Encrypt の DNS-01 チャレンジで取得しています。

### 視聴ページ

- チャンネル切り替え（前回の選択を記憶）
- 配信開始前・回線切断時の自動再接続
- 初めて開いた人へのオンボーディング
- 外部サイトの iframe 埋め込みとリサイズ可能なパネル
- Media Session API 対応
- ピクチャー・イン・ピクチャー対応

### サイネージ

無人運用するディスプレイ向けのページです。
Raspberry Pi 上で Chromium Kiosk モードでの運用を想定しています。

- 配信開始の自動検出と再生開始
- 長時間運転向けのページ自動リロード（6時間周期）
- QR コード表示

### ローカル検証環境

Docker Compose で動くローカル検証環境を用意しています。
視聴ページの挙動確認、チャンネル切り替え、回線切断時の自動復帰、サイネージの表示確認、負荷テストまで手元で実行できます。

---

## 2. ディレクトリ構成

各マシンに対して `hosts/` 配下の 1 つのフォルダが対応しています。どのファイルがどのマシンに配置されるかを、ディレクトリ構成だけで判断できるように設計しています。

```
kosensai-live/
├─ config.json                複数のマシン間で共通する設定値
├─ hosts/                     マシンごとのデプロイ単位
│  ├─ server/                 配信サーバー
│  │  ├─ compose.yml / mediamtx.yml / Caddyfile / .env.example
│  │  ├─ certs/               証明書格納ディレクトリ（Git 管理外）
│  │  └─ scripts/             preflight / get-cert / smoke-test
│  ├─ obs/                    本部配信用 PC
│  │  └─ srt-urls.sh          OBS に入力する SRT の URL を自動生成するスクリプト
│  └─ signage/                サイネージ端末
│     └─ setup.sh / signage.service
├─ app/                       配信サイトのソースコード
│  ├─ src/routes/             視聴ページ (/) とサイネージページ (/signage/)
│  ├─ src/lib/                プレイヤーの状態管理・ロゴ・設定の読み込み
│  ├─ src/styles/             共通 CSS
│  └─ static/                 QR コード・ロゴ・ライセンス
├─ web/                       app/ のビルド成果物
│
├─ rehearsal/                 ローカル検証
├─ tools/make-qr.py           QR コード生成スクリプト
├─ LICENSE
└─ THIRD-PARTY.md
```

### 各マシンの手順書

| 対象マシン・用途 | 参照ドキュメント |
| --- | --- |
| **配信サーバーの構築・管理** | [hosts/server/README.md](hosts/server/README.md) |
| **本部 PC（OBS）の設定** | [hosts/obs/README.md](hosts/obs/README.md) |
| **サイネージ端末のセットアップ** | [hosts/signage/README.md](hosts/signage/README.md) |
| **ローカル検証環境** | [rehearsal/README.md](rehearsal/README.md) |

---

## 3. クイックスタート

### 検証環境の起動と停止

```bash
cd rehearsal
./scripts/up.sh          # 起動
./scripts/reload.sh      # app/ の変更をビルドして検証環境に反映
./scripts/down.sh        # 停止
```

### 配信サイトのビルド

```bash
cd app
pnpm install
pnpm lint        # Prettier と svelte-check の実行
pnpm build       # 本番用ビルド
```

---

## 4. 設定の編集

`config.json` を書き換えることで、チャンネル構成・サイト名・外部埋め込みサイト等をカスタマイズできます。

### config.json

複数のマシン間で共通する設定値はすべてリポジトリ直下の `config.json` に集約されています。

| 設定キー | 内容 |
| --- | --- |
| `site` | 配信サイトの名称・ホスト名・GitHub リポジトリの URL |
| `channels` | チャンネル ID・表示名・OBS 待受ポート・SRT レイテンシ・ビットレート |
| `externalSite` | 視聴ページとサイネージに iframe で埋め込む外部サイトの表示名と URL |
| `signage` | サイネージページのデフォルトチャンネルおよび QR コード横のテキスト |
| `welcome` | オンボーディング案内文 |

- **適用のタイミング**: `app/` はビルド時にこの設定をインポートし、`hosts/` 内の各種スクリプトと `tools/make-qr.py` は実行時に直接読み込みます。

### Caddyfile

`hosts/server/Caddyfile` はホスト名を直接保持しています。`config.json` の `site.domain` を変更した場合は、Caddyfile 内のホスト名も合わせて書き換える必要があります。`preflight.sh` スクリプトが両者の整合性をチェックします。

### QR コード

サイネージに表示する QR コードは `tools/make-qr.py` で生成します。config のドメインを変更した場合に実行してください。

### エンドポイント

デプロイ後のアクセス先は以下の通りです。

- **視聴用 Web ページ**: `https://<domain>/`
- **サイネージ用ページ**: `https://<domain>/signage/`
- **HLS ストリーミング**: `https://<domain>/hls/<ch>/index.m3u8`

> [!NOTE]
> `<domain>` は `config.json` の `site.domain` に対応します。
