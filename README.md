# kosensai-live

一関高専の高専祭ライブ配信のために開発した、イベント会場向けのライブ配信システムです。

各会場に設置したカメラの映像を SRT プロトコルで本部 PC（OBS）に集約し、テロップ等をリアルタイム合成したうえで、チャンネルごとに配信サーバーへ送出します。配信サーバーは SRT で受信した映像を HLS に変換し、視聴用の Web ページとサイネージ用ページを同一サーバーから静的コンテンツとして配信します。

高専祭では学内のプライベートネットワーク上に配信サーバーを置き、来場者が会場の Wi-Fi から視聴する構成で運用しています。外部のクラウドや CDN を使わず、学内ネットワークだけで完結する設計です。

### このリポジトリが扱う範囲

配信サーバーの構築（MediaMTX + Caddy の Docker Compose 環境）、視聴ページとサイネージページのフロントエンド（SvelteKit）、サイネージ端末のセットアップ（Raspberry Pi）、本部 OBS の設定ユーティリティ、そしてこれらの動作を PC 1 台で再現できるローカル検証環境を含みます。`config.json` を書き換えることで、チャンネル構成・サイト名・外部埋め込みサイト等を自分のイベントに合わせてカスタマイズできます。

### 技術スタック

| 領域 | 技術 |
| --- | --- |
| 伝送プロトコル | SRT（全区間で統一） |
| 配信形式 | HLS（MediaMTX が SRT → HLS をリマックス） |
| Web サーバー / TLS 終端 | Caddy |
| 視聴ページ / サイネージページ | SvelteKit + TypeScript（静的サイトとしてプリレンダリング） |
| プレイヤー | hls.js + Media Chrome（カスタムコントロール） |
| サイネージ端末 | Raspberry Pi + Chromium Kiosk モード |
| コンテナ管理 | Docker Compose |
| ローカル検証 | FFmpeg によるカラーバー送出 + 自己署名証明書で全系統を再現 |

---

## 1. システム構成

```
現場のカメラ・スイッチャー
   │  SRT Caller
   ▼
本部の PC (OBS)                             ← hosts/obs/
   │  チャンネルごとにエンコードし、SRT Caller で送信
   │  streamid=publish:chN
   ▼
配信サーバー (MediaMTX + Caddy)             ← hosts/server/
   │  SRT 受信 → HLS 生成 → Caddy が TLS 終端して配信
   ├───────────────► 視聴者のブラウザ        ← app/ のビルド成果物
   └───────────────► サイネージ端末          ← hosts/signage/
```

- **プロトコル**: 伝送方式は全区間で SRT に統一しています。パケット損失時の自動再送により、Wi-Fi 環境でも安定した映像伝送を実現します。
- **トランスコードなし**: MediaMTX はトランスコードおよび ABR を行いません。「エンコーダー側のビットレート × 同時視聴者数」がそのまま配信サーバーの下り必要帯域になります。
- **TLS**: 配信サーバーはプライベートネットワーク上にあり、外部からの HTTP-01 チャレンジが到達しないため、Let's Encrypt の DNS-01 チャレンジで証明書を取得しています。

### 視聴ページの機能

- チャンネル切り替え（前回の選択を記憶して次回以降自動復元）
- 配信開始前・回線切断時の自動再接続（5 秒周期でリトライ）
- 初めて視聴ページを開いた人への対話型のオンボーディング案内
- 外部サイト（公式サイト等）の iframe 埋め込みとリサイズ可能なパネル
- Media Session API によるロック画面・通知領域への再生情報表示
- ピクチャー・イン・ピクチャー対応

### サイネージの機能

- 配信開始の自動検出と再生開始（手動操作不要）
- 6 時間周期のページ自動リロード（長時間運転時のメモリリーク対策）
- iframe 埋め込みの 5 分周期自動リロード
- QR コード表示による視聴ページへの誘導

---

## 2. ディレクトリ構成

各マシンに対して `hosts/` 配下の 1 つのフォルダが対応しています。どのファイルがどのマシンに配置されるかを、ディレクトリ構成だけで判断できるように設計しています。

```
kosensai-live/
├─ config.json                ★ 複数のマシン間で共通する設定値の唯一の情報源
├─ hosts/                     ★ マシンごとのデプロイ単位
│  ├─ server/                 配信サーバー（MediaMTX + Caddy）
│  │  ├─ compose.yml / mediamtx.yml / Caddyfile / .env.example
│  │  ├─ certs/               証明書格納ディレクトリ（Git 管理対象外）
│  │  └─ scripts/             preflight / get-cert / smoke-test
│  ├─ obs/                    本部配信用 PC
│  │  └─ srt-urls.sh          OBS に入力する SRT の URL を自動生成するスクリプト
│  └─ signage/                サイネージ端末（Raspberry Pi + Chromium Kiosk）
│     └─ setup.sh / signage.service
├─ app/                       配信サイトのソースコード（SvelteKit + TypeScript）
│  ├─ src/routes/             視聴ページ (/) とサイネージページ (/signage/)
│  ├─ src/lib/                プレイヤーの状態管理・ロゴ・設定の読み込み
│  ├─ src/styles/             共通 CSS（コンポーネント内には <style> を配置しない設計）
│  └─ static/                 QR コード・ロゴ・ライセンス全文
├─ web/                       app/ のビルド成果物（Caddy がこのディレクトリを配信します）
│                               pnpm build の実行ごとに自動生成されるため直接編集しません
├─ rehearsal/                 ★ ローカル検証環境（PC 1 台で全システムを起動可能）
├─ tools/make-qr.py           サイネージ用 QR コードの生成スクリプト（ドメイン変更時のみ実行）
├─ LICENSE                    MIT ライセンス
└─ THIRD-PARTY.md             同梱しているサードパーティ製ソフトウェアのライセンス一覧
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

ローカルの検証環境（rehearsal）を使うと、配信サーバーや実機が無くても動作確認ができます。Docker だけあれば、カラーバーのテストパターンで全チャンネルの配信が動きます。

### 検証環境の起動と停止

```bash
cd rehearsal
./scripts/up.sh          # 起動（ブラウザで http://localhost:8080/ を開きます）
./scripts/reload.sh      # app/ の変更をビルドして検証環境に反映
./scripts/down.sh        # 停止
```

### 配信サイトのビルド

```bash
cd app
pnpm install
pnpm lint        # Prettier によるコード整形確認および svelte-check
pnpm build       # 本番用ビルド
```

---

## 4. 自分のイベントに合わせる

### config.json

複数のマシン間で共通する設定値はすべてリポジトリ直下の `config.json` に集約されています。フォークしたら、まずこのファイルを自分のイベントに合わせて書き換えてください。

| 設定キー | 内容 |
| --- | --- |
| `site` | 配信サイトの名称およびホスト名 |
| `channels` | チャンネル ID・表示名・OBS 待受ポート・SRT レイテンシ・ビットレート |
| `externalSite` | 視聴ページとサイネージに iframe で埋め込む外部サイトの表示名と URL |
| `signage` | サイネージページのデフォルトチャンネルおよび QR コード横のテキスト |
| `welcome` | 視聴ページを初めて開いた人へ表示する案内文 |

- **適用のタイミング**: `app/` はビルド時にこの設定をインポートし、`hosts/` 内の各種スクリプトと `tools/make-qr.py` は実行時に直接読み込みます。

### Caddyfile

`hosts/server/Caddyfile` はホスト名を直接保持しています。`config.json` の `site.domain` を変更した場合は、Caddyfile 内のホスト名も合わせて書き換える必要があります。`preflight.sh` スクリプトが両者の整合性をチェックします。

### QR コード

サイネージに表示する QR コードは `tools/make-qr.py` で生成します。ドメインを変更した場合に実行してください。

### エンドポイント

デプロイ後のアクセス先は以下の通りです。

- **視聴用 Web ページ**: `https://<domain>/`
- **サイネージ用ページ**: `https://<domain>/signage/`
- **HLS ストリーミング**: `https://<domain>/hls/<ch>/index.m3u8`

> [!NOTE]
> `<domain>` は `config.json` の `site.domain` に対応します。
