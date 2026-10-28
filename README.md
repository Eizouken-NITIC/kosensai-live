# kosensai-live

映像研究部が高専祭のライブ配信に使用する配信システムです。

第一体育館のカメラの映像を ATEM でスイッチングし、配信用ミキサーの音声と一緒に SRT で本部 PC へ送ります。遊撃の iPhone の映像も SRT で本部 PC へ送ります。本部 PC の OBS がテロップ等を合成し、チャンネルごとに配信サーバー（MediaMTX + Caddy）へ送出します。MediaMTX が HLS に remux し、視聴ページとサイネージに配信します。

映像は外部のサービスへ送出せず、会場内のネットワークで配信します。視聴者は会場の Wi-Fi に接続して視聴します。

| 領域 | 技術 |
| --- | --- |
| 映像伝送 | SRT |
| 本部 PC | OBS Studio + obs-multi-rtmp（チャンネルごとの送出）+ Source Record（遊撃のクリーンフィードの録画） |
| 本部 PC と ATEM の設定 | `kosensai-live`（Python、uv で Windows・macOS・Linux 共通） |
| 配信 | HLS（MediaMTX が SRT → HLS に remux） |
| Web サーバー / TLS 終端 | Caddy |
| 視聴ページ / サイネージ | SvelteKit + TypeScript（静的プリレンダリング） |
| プレイヤー | hls.js + Media Chrome |
| サイネージ端末 | Raspberry Pi + Chromium Kiosk |
| コンテナ管理 | Docker Compose |

---

## 1. システム構成

```
第一体育館のカメラ
   │  HDMI 等
   ▼
ATEM（配信用ミキサーの出力を MIC 1 に入れる） / 遊撃の iPhone
   │  SRT Caller（会場の LAN / Wi-Fi）
   ▼
本部 PC（OBS）  ← hosts/obs/
   │  チャンネルごとにエンコードし、SRT Caller で送信
   │  streamid=publish:chN
   ▼
配信サーバー（MediaMTX + Caddy）  ← hosts/server/
   │  SRT 受信 → HLS 生成 → Caddy が TLS 終端して配信
   ├───────────────► 視聴者のブラウザ
   └───────────────► サイネージ端末
```

| 録画 | 行うもの |
| --- | --- |
| 第一体育館のクリーンフィード | ATEM（USB ディスクへの収録） |
| 遊撃のクリーンフィード | 本部 PC の OBS（Source Record） |
| 総合（プログラム） | 本部 PC の OBS（通常の録画） |

配信サーバーでは、MediaMTX が SRT のストリームを受信し、トランスコードと ABR を行わずに HLS へ remux します。Caddy が TLS 終端・リバースプロキシ・静的配信を行い、視聴ページとサイネージのページも同じサーバーから配信します。

TLS 証明書は Let's Encrypt の DNS-01 チャレンジで取得します。

### 視聴ページ

- チャンネルの切り替え（前回の選択を記憶）
- 配信開始前・回線切断時の自動再接続
- 初めて開いた人へのオンボーディング
- 外部サイトの iframe の埋め込みとリサイズできるパネル
- Media Session API
- ピクチャー・イン・ピクチャー

### サイネージ

無人で運用するディスプレイ向けのページです。Raspberry Pi の Chromium のキオスクモードで表示します。

- 配信開始の自動検出と再生の開始
- ライブの先端への自動追従（遅れを再生速度とシークで詰める）
- ページの自動リロード（6 時間ごと）
- QR コードの表示

### ローカル検証環境

Docker Compose で起動します。視聴ページの動作、チャンネルの切り替え、回線切断からの自動復帰、サイネージの表示、負荷テストを手元で確認できます。

---

## 2. ディレクトリ構成

`hosts/` の下の 1 つのフォルダが 1 つのマシンに対応します。

```
kosensai-live/
├─ config.json                複数のマシン間で共通する設定値
├─ hosts/                     マシンごとのデプロイ単位
│  ├─ server/                 配信サーバー
│  │  ├─ compose.yml / mediamtx.yml / Caddyfile / .env.example
│  │  ├─ certs/               証明書（Git 管理外）
│  │  ├─ logs/                アクセスログ（Git 管理外）
│  │  └─ scripts/             get-cert / smoke-test
│  ├─ obs/                    本部 PC
│  │  ├─ scenes.json          OBS の構成（シーン・出力・録画）
│  │  ├─ atem.json            ATEM の配信の品質と音声のミキサー
│  │  ├─ channels.lua         音声の振り分け、配信休止、転換の画面、CM の自動表示、受信の確認と操作パネルを行う OBS のスクリプト
│  │  ├─ relay-task.ps1       中継を Windows の起動時に動かすタスクの登録
│  │  ├─ design/              画面のフォント・画像と、画像を描画する Blender のスクリプト
│  │  └─ overlays/            テロップと全画面の画面（ブラウザソース）
│  └─ signage/                サイネージ端末
│     └─ setup.sh / signage.service
├─ app/                       配信サイトのソースコード
│  ├─ src/routes/             視聴ページ (/) とサイネージのページ (/signage/)
│  ├─ src/lib/                プレイヤーの状態管理・ロゴ・設定の読み込み
│  ├─ src/styles/             共通 CSS
│  └─ static/                 QR コード・ロゴ・ライセンス
├─ web/                       app/ のビルド成果物
│
├─ rehearsal/                 ローカル検証環境
├─ tools/                     複数のマシンから使用する共通スクリプト
│  ├─ kosensai_live/          本部 PC と開発用の PC の CLI（kosensai-live）
│  │  └─ config.py            config.json と .env の読み込みと検証（配信サーバーでも使用する）
│  └─ analyze-access.py       アクセスログから視聴数を集計するスクリプト（配信サーバーで実行する）
├─ pyproject.toml             kosensai-live の依存
├─ LICENSE
└─ THIRD-PARTY.md
```

### 各マシンの手順書

| 対象マシン・用途 | 参照ドキュメント |
| --- | --- |
| 配信サーバーの構築・管理 | [hosts/server/README.md](hosts/server/README.md) |
| 本部 PC（OBS）と ATEM の設定 | [hosts/obs/README.md](hosts/obs/README.md) |
| サイネージ端末のセットアップ | [hosts/signage/README.md](hosts/signage/README.md) |
| ローカル検証環境 | [rehearsal/README.md](rehearsal/README.md) |

### スクリプトの実行

本部 PC と開発用の PC で行う操作は CLI の `kosensai-live` にまとめてあり、OS によらず [uv](https://docs.astral.sh/uv/) で実行します。依存は `pyproject.toml` と `uv.lock` にあり、uv がリポジトリの `.venv/` に用意します。

| コマンド | 内容 |
| --- | --- |
| `uv run kosensai-live check` | `.env` と `config.json` を検証する |
| `uv run kosensai-live obs build` | 本部 PC の OBS のプロファイル・シーン・出力・録画を設定する |
| `uv run kosensai-live atem apply` / `check` / `get` / `start` / `stop` / `watch` | ATEM の映像の形式・配信・品質（ビットレート）・音声のミキサーを設定・確認する |
| `uv run kosensai-live relay` | ATEM と遊撃の iPhone の SRT を受け、OBS へ TCP で渡す |
| `uv run kosensai-live urls` | SRT の URL と視聴の URL を表示する |
| `uv run kosensai-live qr` | 視聴ページの QR コードを生成する |
| `uv run kosensai-live render gauge` / `clock` | 計器と時計の画像を Blender で描画する |
| `uv run kosensai-live rehearsal reload` / `load-test` | ローカル検証環境を操作する |

`.env` は既定で `hosts/server/.env` を読みます。別のファイルは `uv run kosensai-live check --env <パス>` のように、サブコマンドの後に `--env` を付けて指定します。

配信サーバー（Linux）とサイネージ端末（Raspberry Pi OS）のシェルスクリプトと、コンテナの中の処理はそのマシンの `bash` と `python3` で実行します。

---

## 3. クイックスタート

```bash
cd rehearsal
docker compose up -d     # 起動
uv run kosensai-live rehearsal reload   # app/ の変更をビルドして検証環境に反映
docker compose down -v   # 停止
```

負荷テストと LAN の実機からの確認の手順は [rehearsal/README.md](rehearsal/README.md) にあります。

---

## 4. 本番環境の構築

`config.json` を書き換えた後（[5.](#5-設定の編集)）、マシンごとに次の順で構築します。

### 4-1. 配信サイトをビルドする

```bash
cd app
pnpm install
pnpm lint        # Prettier と svelte-check を実行する
pnpm build       # 成果物は web/ に出力される
```

### 4-2. 配信サーバーを構築する（MediaMTX + Caddy）

```bash
cd hosts/server
cp .env.example .env         # パスフレーズ（送出用・受信用）と各マシンの IP を設定する
sudo ./scripts/get-cert.sh   # DNS-01 チャレンジで証明書を取得する
docker compose up -d
```

システム要件、SRT のカーネルパラメータ、起動前の検証、疎通テストの手順は [hosts/server/README.md](hosts/server/README.md) にあります。

### 4-3. 本部 PC（OBS）と ATEM を設定する

OBS に obs-multi-rtmp と Source Record のプラグインをインストールします。OBS と ATEM は、`kosensai-live` が `config.json`・`.env`・`hosts/obs/scenes.json`・`hosts/obs/atem.json` と kosensai-live-assets のフォルダ（その年の進行と CM のスライド。このリポジトリには含めません）から設定します。必要なものと手順は [hosts/obs/README.md](hosts/obs/README.md) にあります。

### 4-4. サイネージ端末を用意する（任意）

Raspberry Pi で `hosts/signage/setup.sh` を実行し、Chromium のキオスクモードの自動起動を設定します。手順は [hosts/signage/README.md](hosts/signage/README.md) にあります。

---

## 5. 設定の編集

### config.json

複数のマシン間で共通する設定値はリポジトリの直下の `config.json` にあります。

| 設定キー | 内容 |
| --- | --- |
| `site` | 配信サイトの名前・ホスト名・GitHub リポジトリの URL |
| `video` | ATEM と本部 PC の OBS の映像の形式 |
| `channels` | チャンネルの ID・表示名・OBS の待ち受けのポート・SRT のレイテンシ・ビットレート |
| `externalSite` | 視聴ページとサイネージに iframe で埋め込む外部サイトの表示名と URL |
| `viewer` | 視聴ページの既定のチャンネル |
| `signage` | サイネージのページの既定のチャンネルと、QR コードの横のテキスト |
| `welcome` | オンボーディングの案内文 |

`app/` はビルド時にこのファイルをインポートします。`hosts/`、`rehearsal/`、`tools/` のスクリプトは実行時に `tools/kosensai_live/config.py` を経由して読み込みます。

### .env

パスフレーズと各マシンの IP は `hosts/server/.env`（Git 管理外）に設定します。配信サーバーの compose と、本部 PC の `kosensai-live` がこのファイルを読みます。設定項目は [hosts/server/README.md](hosts/server/README.md#env-の設定項目) にあります。

### 設定の検証と反映

`config.json` と `.env` の値は他の設定ファイルへ書き写しません。

- `Caddyfile` のホスト名は `{$SITE_DOMAIN}` です。compose の init-caddy が `config.json` から書き出した値を Caddy が起動時に読み込みます。
- MediaMTX のパス（Ch）は `.env` の `MTX_PATHS_<Ch>_SRTPUBLISHPASSPHRASE` から作成します。`mediamtx.yml` には Ch を書きません。

`docker compose up` のたびに init-mediamtx と init-caddy が `.env` と `config.json` を検証します。検証の項目と、運用中に設定を変更する手順は [hosts/server/README.md](hosts/server/README.md#起動前の検証) にあります。

### QR コード

サイネージに表示する QR コードは `uv run kosensai-live qr` で生成します。`config.json` の `site.domain` を変更した場合に実行します。

### エンドポイント

`<domain>` は `config.json` の `site.domain` です。

| 用途 | URL |
| --- | --- |
| 視聴ページ | `https://<domain>/` |
| サイネージのページ | `https://<domain>/signage/` |
| HLS | `https://<domain>/hls/<ch>/index.m3u8` |
