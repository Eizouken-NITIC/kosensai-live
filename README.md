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

配信サーバーでは MediaMTX が SRT ストリームを受信し、トランスコードも ABR も行わずに HLS へ remux します。Caddy が TLS 終端・リバースプロキシ・静的配信を担い、視聴ページとサイネージページも同じサーバーから配信します。

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
- ライブ先端への自動追従（遅れを再生速度とシークで詰め戻し）
- 長時間運転向けのページ自動リロード（6時間周期）
- QR コード表示

### ローカル検証環境

Docker Compose で動きます。視聴ページの挙動確認、チャンネル切り替え、回線切断時の自動復帰、サイネージの表示確認、負荷テストまで手元で実行できます。

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
├─ tools/                     複数のマシンから使用する共通スクリプト
│  ├─ config.sh               config.json の値をシェルから読み出す関数
│  └─ make-qr.py              QR コード生成スクリプト
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

```bash
cd rehearsal
docker compose up -d     # 起動
./scripts/reload.sh      # app/ の変更をビルドして検証環境に反映
docker compose down -v   # 停止
```

負荷テストや LAN の実機からの確認方法は [rehearsal/README.md](rehearsal/README.md) にあります。

---

## 4. 本番環境の構築

自分のイベントで運用する場合は、まず `config.json` を書き換えたうえで（[5 章](#5-設定の編集)）、マシンごとに次の順で構築します。

**1. 配信サイトをビルドする**

```bash
cd app
pnpm install
pnpm lint        # Prettier と svelte-check の実行
pnpm build       # 成果物は web/ に出力されます
```

**2. 配信サーバーを構築する（MediaMTX + Caddy）**

```bash
cd hosts/server
cp .env.example .env     # SRT パスフレーズ（送出用・現場用）と本部 PC の IP を設定します
sudo ./scripts/get-cert.sh   # DNS-01 チャレンジで取得します
./scripts/preflight.sh       # 設定・証明書・カーネルパラメータの整合性を確認します
docker compose up -d
```

システム要件、SRT 用カーネルパラメータの設定、疎通テストの手順は [hosts/server/README.md](hosts/server/README.md) にあります。

**3. 本部 PC（OBS）を設定する**

OBS に入力する SRT の URL は `hosts/obs/srt-urls.sh` が `config.json` と `.env` から生成します。キーフレーム間隔などの設定値は [hosts/obs/README.md](hosts/obs/README.md) を参照してください。

**4. サイネージ端末を用意する（任意）**

Raspberry Pi 上で `hosts/signage/setup.sh` を実行すると、Chromium のキオスク起動と自動復帰の設定までを行います。詳細は [hosts/signage/README.md](hosts/signage/README.md) にあります。

---

## 5. 設定の編集

### config.json

複数のマシン間で共通する設定値はすべてリポジトリ直下の `config.json` に集約されています。

| 設定キー | 内容 |
| --- | --- |
| `site` | 配信サイトの名称・ホスト名・GitHub リポジトリの URL |
| `channels` | チャンネル ID・表示名・OBS 待受ポート・SRT レイテンシ・ビットレート |
| `externalSite` | 視聴ページとサイネージに iframe で埋め込む外部サイトの表示名と URL |
| `viewer` | 視聴ページのデフォルトチャンネル |
| `signage` | サイネージページのデフォルトチャンネルおよび QR コード横のテキスト |
| `welcome` | オンボーディング案内文 |

- **適用のタイミング**: `app/` はビルド時にこの設定をインポートします。`hosts/` と `rehearsal/` の各種スクリプトは実行時に `tools/config.sh` を経由して読み込み、`tools/make-qr.py` は直接読み込みます。

### Caddyfile

`hosts/server/Caddyfile` はホスト名を直接保持しています。`config.json` の `site.domain` を変更した場合は、Caddyfile 内のホスト名も合わせて書き換える必要があります。`preflight.sh` スクリプトが両者の整合性をチェックします。

### QR コード

サイネージに表示する QR コードは `tools/make-qr.py` で生成します。config のドメインを変更した場合に実行してください。

### エンドポイント

- **視聴用 Web ページ**: `https://<domain>/`
- **サイネージ用ページ**: `https://<domain>/signage/`
- **HLS ストリーミング**: `https://<domain>/hls/<ch>/index.m3u8`

> [!NOTE]
> `<domain>` は `config.json` の `site.domain` に対応します。
