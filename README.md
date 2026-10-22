# kosensai-live

映像研究部が、高専祭のライブ配信のために作った配信システムです！

実運用では、メイン会場にカメラ、スイッチャー、本部 PC（OBS）を配置します。スイッチングした映像を SRT で、音響の音声を USB オーディオで本部 PC へ入力し、移動中継のスマートフォンの映像も SRT で本部 PC へ集約します。本部 PC でテロップ等を合成し、配信サーバー（MediaMTX + Caddy）へ送出します。
その後 MediaMTX で HLS に remux し、視聴ページに配信します。

外部サービスには映像を送出せず、イベント会場内で配信が完結しているのが大きな特徴です。
配信サーバーは、2026高専祭 ネットワークチームが構築した特設ネットワーク上で運用しています。視聴者は会場の特設 Wi-Fi AP に接続して視聴します。

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
メイン会場のカメラ
   │  HDMI等
   ▼
スイッチャー (ATEM) / 移動中継のスマートフォン     音響（配信用ミキサー）
   │  SRT Caller（会場の LAN / Wi-Fi）              │  USB オーディオ
   ▼                                                ▼
本部の PC (OBS)  ← hosts/obs/
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
│  │  ├─ logs/                アクセスログ格納ディレクトリ（Git 管理外）
│  │  └─ scripts/             get-cert / smoke-test
│  ├─ obs/                    本部配信用 PC
│  │  ├─ channels.lua         音声の振り分け・本部のモニター・配信休止を行う OBS のスクリプト
│  │  ├─ assets/              今年の進行・OBS の構成・フォント・画像
│  │  └─ overlays/            テロップと全画面の画面（ブラウザソース）
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
| **配信サーバーの構築・管理** | [hosts/server/README.md](hosts/server/README.md) |
| **本部 PC（OBS）の設定** | [hosts/obs/README.md](hosts/obs/README.md) |
| **サイネージ端末のセットアップ** | [hosts/signage/README.md](hosts/signage/README.md) |
| **ローカル検証環境** | [rehearsal/README.md](rehearsal/README.md) |

### スクリプトの実行

本部 PC（Windows）と開発用の PC（macOS・Windows）で行う操作は、CLI の `kosensai-live` にまとめてあり、OS によらず [uv](https://docs.astral.sh/uv/) で実行します。依存は `pyproject.toml` と `uv.lock` にあり、uv がリポジトリの `.venv/` に用意します。

| コマンド | 内容 |
| --- | --- |
| `uv run kosensai-live check` | `.env` と `config.json` を検証する |
| `uv run kosensai-live obs build` / `obs devices` | 本部 OBS のプロファイル・シーン・出力を設定する / 音声のデバイスを表示する |
| `uv run kosensai-live atem apply` / `check` / `get` / `start` / `stop` / `watch` | ATEM の映像の形式と配信を設定・確認する |
| `uv run kosensai-live urls` | SRT の URL と視聴の URL を表示する |
| `uv run kosensai-live qr` | 視聴ページの QR コードを生成する |
| `uv run kosensai-live render gauge` / `clock` | 計器と時計の画像を Blender で描画する |
| `uv run kosensai-live rehearsal reload` / `load-test` | ローカル検証環境を操作する |

`.env` は既定で `hosts/server/.env` を読みます。別のファイルは `uv run kosensai-live --env <パス> ...` で指定します。

配信サーバー（Linux）とサイネージ端末（Raspberry Pi OS）のシェルスクリプト、コンテナの中の処理は、そのマシンの `bash` と `python3` で実行します。

---

## 3. クイックスタート

```bash
cd rehearsal
docker compose up -d     # 起動
uv run kosensai-live rehearsal reload   # app/ の変更をビルドして検証環境に反映
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
cp .env.example .env     # SRT パスフレーズ（送出用・受信用）と各マシンの IP を設定します
sudo ./scripts/get-cert.sh   # DNS-01 チャレンジで取得します
docker compose up -d         # 起動前に init サービスが設定・証明書・カーネルパラメータを検証します
```

システム要件、SRT 用カーネルパラメータの設定、疎通テストの手順は [hosts/server/README.md](hosts/server/README.md) にあります。

**3. 本部 PC（OBS）を設定する**

本部 OBS と ATEM は、`kosensai-live` が `config.json`・`.env`・`hosts/obs/assets/scenes.json` から設定します。手順は [hosts/obs/README.md](hosts/obs/README.md) にあります。

**4. サイネージ端末を用意する（任意）**

Raspberry Pi 上で `hosts/signage/setup.sh` を実行すると、Chromium のキオスク起動と自動復帰の設定までを行います。詳細は [hosts/signage/README.md](hosts/signage/README.md) にあります。

---

## 5. 設定の編集

### config.json

複数のマシン間で共通する設定値はすべてリポジトリ直下の `config.json` に集約されています。

| 設定キー | 内容 |
| --- | --- |
| `site` | 配信サイトの名称・ホスト名・GitHub リポジトリの URL |
| `video` | ATEM と本部 OBS の映像の形式 |
| `channels` | チャンネル ID・表示名・OBS 待受ポート・SRT レイテンシ・ビットレート |
| `externalSite` | 視聴ページとサイネージに iframe で埋め込む外部サイトの表示名と URL |
| `viewer` | 視聴ページのデフォルトチャンネル |
| `signage` | サイネージページのデフォルトチャンネルおよび QR コード横のテキスト |
| `welcome` | オンボーディング案内文 |

- **適用のタイミング**: `app/` はビルド時にこの設定をインポートします。`hosts/`、`rehearsal/`、`tools/` の各種スクリプトは、実行時に `tools/kosensai_live/config.py` を経由して読み込みます。

### .env

パスフレーズと各マシンの IP は `hosts/server/.env`（Git 管理外）に設定します。配信サーバーの compose に加えて、本部 PC の `kosensai-live` もこのファイルを読みます。設定項目は [hosts/server/README.md](hosts/server/README.md) にあります。

### 設定の検証と反映

`config.json` と `.env` の値は、他の設定ファイルへ書き写しません。

- `Caddyfile` のホスト名は `{$SITE_DOMAIN}` です。compose の init サービスが `config.json` から書き出した値を、Caddy が起動時に読み込みます。
- MediaMTX のパス（Ch）は `.env` の `MTX_PATHS_<Ch>_SRTPUBLISHPASSPHRASE` から作成します。`mediamtx.yml` には Ch を書きません。

init サービスは `docker compose up` のたびに `tools/kosensai_live/config.py check --server` を実行し、`.env` の Ch と `config.json` の一致、パスフレーズ、証明書のホスト名と期限などを検証します。NG があれば MediaMTX と Caddy を起動しません。運用中に `config.json` や `.env` を変更した場合は、`docker compose run --rm init` で OK を確認してから `docker compose up -d` を実行してください。`.env` を変更すると、compose は init の完了を待たずに MediaMTX を作り直すため、NG のまま `up -d` を実行すると受信が止まります（`docker compose restart` では init が実行されません）。

### QR コード

サイネージに表示する QR コードは `uv run kosensai-live qr` で生成します。config のドメインを変更した場合に実行してください。

### エンドポイント

- **視聴用 Web ページ**: `https://<domain>/`
- **サイネージ用ページ**: `https://<domain>/signage/`
- **HLS ストリーミング**: `https://<domain>/hls/<ch>/index.m3u8`

> [!NOTE]
> `<domain>` は `config.json` の `site.domain` に対応します。
