# kosensai-live

一関高専 映像研究部が、高専祭のライブ配信のために開発した配信システムです。

複数の会場にカメラとスイッチャーを設置し、映像を SRT で本部 PC（OBS）へ集約してテロップ等をリアルタイム合成し、チャンネルごとに配信サーバーへ送出します。配信サーバー（**MediaMTX** + **Caddy**）が SRT を HLS に remux し、視聴ページ・サイネージページとともに配信します。視聴者はブラウザから視聴でき、アプリのインストールは不要です。

高専祭の配信はイベント会場内に限定しており、配信サーバーは学内のプライベートネットワーク上で運用しています。視聴者は会場の Wi-Fi に接続して視聴します。

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

映像の流れは「現場 → 本部 → 配信サーバー → 視聴者」の一方向です。伝送には SRT を採用しており、パケット損失時の自動再送によって Wi-Fi 環境でも安定した映像伝送を実現しています。

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

配信サーバーでは MediaMTX が SRT ストリームを受信し、トランスコードせずに HLS へ remux します。トランスコードや ABR は行わないため、「エンコーダー側のビットレート × 同時視聴者数」がそのまま下り帯域になります。Caddy が TLS 終端・リバースプロキシ・静的配信を担い、視聴ページとサイネージページも同じサーバーから配信します。

TLS 証明書は、配信サーバーがプライベートネットワーク上にあり HTTP-01 チャレンジが到達しないため、Let's Encrypt の DNS-01 チャレンジで取得しています。

### 視聴ページ

- チャンネル切り替え（前回の選択を記憶して自動復元）
- 配信開始前・回線切断時の自動再接続
- 初めて開いた人への対話型オンボーディング案内
- 外部サイトの iframe 埋め込みとリサイズ可能なパネル
- Media Session API によるロック画面への再生情報表示
- ピクチャー・イン・ピクチャー対応

### サイネージ

Raspberry Pi + Chromium Kiosk モードで無人運用するディスプレイ向けのページです。

- 配信開始の自動検出と再生開始（手動操作不要）
- 長時間運転向けのページ自動リロード（6 時間周期）
- QR コード表示による視聴ページへの誘導

### ローカル検証環境

PC 1 台で配信システムの全系統を再現できるローカル検証環境を用意しています。Docker だけあれば、カラーバーのテストパターンで全チャンネルの配信が動きます。視聴ページの挙動確認、チャンネル切り替え、回線切断時の自動復帰、サイネージの表示確認、負荷テストまで手元で実行できます。

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

`config.json` を書き換えることで、チャンネル構成・サイト名・外部埋め込みサイト等をカスタマイズできます。

### config.json

複数のマシン間で共通する設定値はすべてリポジトリ直下の `config.json` に集約されています。フォークしたら、まずこのファイルを自分のイベントに合わせて書き換えてください。

| 設定キー | 内容 |
| --- | --- |
| `site` | 配信サイトの名称・ホスト名・GitHub リポジトリの URL |
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
