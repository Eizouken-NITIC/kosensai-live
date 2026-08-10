# kosensai-broadcast（高専祭ライブ配信システム）

本プロジェクトは、高専祭ライブ配信の配信基盤および配信サイト用のリポジトリです。
SRTプロトコルで受信した映像をHLS形式に変換して配信し、視聴用のWebページとサイネージ用ページを同一サーバーから静的コンテンツとして配信します。

## 1. 配信URL・エンドポイント

- **視聴用Webページ**: `https://<domain>/`
- **サイネージ用ページ**: `https://<domain>/signage/`
- **HLSストリーミング**: `https://<domain>/hls/<ch>/index.m3u8`

> [!NOTE]
> `<domain>` の値は、リポジトリ直下にある `config.json` の設定に基づいて決定されます。

---

## 2. システム構成

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

- **プロトコル**: 伝送方式は、全区間でSRTに統一しています。
- **仕様**: MediaMTXはトランスコードおよびABR（最高ビットレート自動選択）を行いません。そのため、「エンコーダー側のビットレート × 同時視聴者数」が、そのまま配信サーバーの下り必要帯域となります。

---

## 3. ディレクトリ構成

各マシンに対して、`hosts/` ディレクトリ配下の1つのフォルダが対応しています。どのファイルがどのマシンに配置されるかを、ディレクトリ構成だけで容易に判断できるように設計しています。

```
kosensai-broadcast/
├─ config.json                ★ 複数のマシン間で共通して使用する設定値の唯一の情報源
├─ hosts/                     ★ マシンごとのデプロイ単位
│  ├─ server/                 配信サーバー（MediaMTX + Caddy）
│  │  ├─ compose.yml / mediamtx.yml / Caddyfile / .env.example
│  │  ├─ certs/               証明書格納ディレクトリ（Git管理対象外）
│  │  └─ scripts/             preflight / get-cert / smoke-test
│  ├─ obs/                    本部配信用PC
│  │  └─ srt-urls.sh          OBSに入力するSRTのURLを自動生成するスクリプト
│  └─ signage/                サイネージ端末（Raspberry Pi + Chromium Kiosk）
│     └─ setup.sh / signage.service
├─ app/                       配信サイトのソースコード（SvelteKit + TypeScript）
│  ├─ src/routes/             視聴ページ (/) とサイネージページ (/signage/)
│  ├─ src/lib/                プレイヤーの状態管理・ロゴ・設定の読み込み
│  ├─ src/styles/             共通CSS（コンポーネント内には <style> を配置しない設計）
│  └─ static/                 QRコード・ロゴ・ライセンス全文
├─ web/                       app/ のビルド成果物（Caddyがこのディレクトリを配信します）
│                               ※pnpm build の実行ごとに自動生成されるため、直接編集はしないでください
├─ rehearsal/                 ★ ローカル検証環境（PC1台で全システムをモック起動可能）
├─ tools/make-qr.py           視聴ページ用のQRコードを生成するスクリプト（domain変更時のみ実行）
├─ LICENSE                    MITライセンス
└─ THIRD-PARTY.md             同梱しているサードパーティ製ソフトウェアのライセンス一覧
```

### 各マシンの手順書

| 対象マシン・用途 | 参照ドキュメント |
| --- | --- |
| **配信サーバーの構築・管理** | [hosts/server/README.md](hosts/server/README.md) |
| **本部PC（OBS）の設定** | [hosts/obs/README.md](hosts/obs/README.md) |
| **サイネージ端末のセットアップ** | [hosts/signage/README.md](hosts/signage/README.md) |
| **ローカル検証環境の動作確認** | [rehearsal/README.md](rehearsal/README.md) |

---

## 4. クイックスタート（はじめかた）

配信サイトの開発や動作確認を行う場合は、ローカルで検証環境を立ち上げて動作確認を行います。

### 検証環境の起動と停止

```bash
cd rehearsal
./scripts/up.sh          # システムの起動（ブラウザで http://localhost:8080/ を開きます）
./scripts/reload.sh      # app/ の変更をビルドして検証環境に反映
./scripts/down.sh        # システムの停止
```

### 配信サイトのビルド手順

```bash
cd app
pnpm install
pnpm lint        # Prettierによるコード整形確認および svelte-check
pnpm build       # 本番用ビルドの実行
```

---

## 5. 設定の管理について

複数のマシン間で共通して使用する設定値は、すべてリポジトリ直下の `config.json` に集約されています。

| 設定キー | 設定内容 |
| --- | --- |
| `site` | 配信サイトの名称およびホスト名 |
| `channels` | チャンネルID、表示名、OBS待受ポート、SRTのレイテンシ、ビットレート、映像ソース情報 |
| `externalSite` | 視聴ページとサイネージに iframe で埋め込む外部サイトの表示名およびURL |
| `signage` | サイネージページのデフォルトチャンネル、およびQRコード横に表示するテキスト |

- **適用のタイミング**: `app/` はビルド時にこの設定をインポートし、`hosts/` 内の各種スクリプトと `tools/make-qr.py` は実行時に直接読み込みます。
- **注意点**: `Caddyfile` はホスト名を直接保持しています。不整合を防ぐため、`preflight.sh` スクリプトが `config.json` との整合性をチェックします。
