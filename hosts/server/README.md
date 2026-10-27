# hosts/server — 配信サーバー

配信サーバーは MediaMTX で SRT のストリームを受信して HLS を生成し、Caddy で TLS 終端・静的配信・リバースプロキシを行います。どちらも Docker Compose で起動します。

配信サーバーにはリポジトリ全体を clone し、`hosts/server/` で `docker compose` を実行します。compose はリポジトリ（検証のスクリプトの `tools/` と、配信サイトのビルド成果物の `web/`）をマウントします。

---

## 1. データフロー

```
                   SRT (:8890)                  HLS (127.0.0.1:8888)
本部 PC ──────────────────► MediaMTX ──────────────────► Caddy (:443) ──► 視聴者・サイネージ
   streamid=publish:chN                                    │
   passphrase=<.env に設定>                                ├─ /            web/index.html
                                                           ├─ /signage/    web/signage/index.html
                                                           ├─ /hls/*       reverse_proxy :8888
                                                           └─ /healthz
```

---

## 2. システム要件

| 項目 | 要件 | 備考 |
| --- | --- | --- |
| OS | Ubuntu 22.04 LTS / 24.04 LTS | |
| CPU | 2 コア以上 | トランスコードは行わず、HLS への remux だけを行います |
| RAM | 4 GB 以上 | HLS のセグメントをメモリに保持します |
| ディスク | 20 GB 以上 | ログと一時的なセグメントのファイル |
| ネットワーク | 配信用 VLAN、固定 IP | VM や LXC（Proxmox など）で動かす場合は、NAT ではなくブリッジ接続で LAN の IP を持たせます（[接続元の制限](#接続元の制限)） |
| カーネルパラメータ | `net.core.rmem_max` が 26214400 以上 | [3.](#3-セットアップの手順) の手順 1 で設定します |

---

## 3. セットアップの手順

```bash
# 1. SRT のバッファを確保する
sudo sysctl -w net.core.rmem_max=26214400
sudo sysctl -n net.core.rmem_max        # 26214400 が表示されることを確認する
echo 'net.core.rmem_max=26214400' | sudo tee /etc/sysctl.d/99-srt.conf

# 2. リポジトリを clone する
git clone https://github.com/Eizouken-NITIC/kosensai-live.git && cd kosensai-live/hosts/server

# 3. .env を作成し、パスフレーズと各マシンの IP を設定する
cp .env.example .env
for i in 1 2 3 4 5; do openssl rand -base64 24; done   # パスフレーズは 1 つずつ別の値にする
$EDITOR .env

# 4. TLS 証明書を取得する（DNS-01 チャレンジ）
sudo ./scripts/get-cert.sh

# 5. 起動前の検証だけを実行する（任意。全ての項目を検証する）
docker compose run --rm init

# 6. コンテナを起動する
docker compose up -d

# 7. 疎通テストを実行する（例: ch1）
./scripts/smoke-test.sh ch1
```

手順 7 の `smoke-test.sh` には SRT に対応した ffmpeg が必要です。`ffmpeg -protocols | grep -w srt` で確認できます。対応したビルドを用意できない場合は、Docker 版（`jrottenberg/ffmpeg` など）を `--network host` で実行します。

### .env の設定項目

| 変数 | 用途 |
| --- | --- |
| `MTX_PATHS_<Ch>_SRTPUBLISHPASSPHRASE` | 本部 PC → 配信サーバーの送出のパスフレーズ。`config.json` の `channels[].id` ごとに設定します。ATEM とスマートフォンには設定しません。10〜79 文字 |
| `OBS_<Ch>_LISTEN_PASSPHRASE` | ATEM・スマートフォン → 本部 PC の中継（SRT Listener、`kosensai-live relay`）のパスフレーズ。ATEM とスマートフォンにはこの値を設定します。`obsListenPort` を持つ Ch にだけ設定します。10〜63 文字 |
| `HQ_IP` | 本部 PC の IPv4 アドレス。配信サーバーはこの IP とサーバー自身からの送出だけを受け付けます。ATEM とスマートフォンの送信先もこの IP です |
| `SERVER_IP` | 本部 PC から見た配信サーバーの IPv4 アドレス。`kosensai-live obs build` が obs-multi-rtmp の送出先の URL に使用します |
| `ATEM_IP` | ATEM の IPv4 アドレス。`kosensai-live atem` が使用します |
| `OBS_RECORD_DIR` | 本部 PC の OBS の録画の保存先。`kosensai-live obs build` が設定します。配信サーバーは使用しません |

パスフレーズは送信側（本部 PC の obs-multi-rtmp、ATEM、スマートフォン）の設定値と一致させます。

次の場合、検証は NG になります。

- `config.json` に無い Ch の `MTX_PATHS_<Ch>_SRTPUBLISHPASSPHRASE` がある
- 受信用（`OBS_<Ch>_LISTEN_PASSPHRASE`）と送出用（`MTX_PATHS_<Ch>_SRTPUBLISHPASSPHRASE`）のパスフレーズが同じ値である

### 起動前の検証

`docker compose up` のたびに、`compose.yml` の 2 つの検証のサービスが `tools/kosensai_live/config.py check` を実行します。NG があれば、そのサービスが対象とするコンテナを起動しません。

| サービス | 検証する項目 | NG の場合に起動しないもの |
| --- | --- | --- |
| `init-mediamtx` | `.env` の Ch と `config.json` の `channels[].id` の一致、パスフレーズの長さと重複、`HQ_IP` の形式、`net.core.rmem_max` | MediaMTX と Caddy |
| `init-caddy` | `.env` の Ch とパスフレーズ、`web/` のビルド成果物とライセンス本文の有無、証明書と秘密鍵の組み合わせ、証明書のホスト名が `config.json` の `site.domain` を含むこと、有効期限 | Caddy |

証明書が無い状態でも MediaMTX は起動し、本部 PC からの送出を受信します。

NG の場合、`docker compose up` は `service "init-caddy" didn't complete successfully` のように終了します。内容は `docker compose logs init-caddy`（または `init-mediamtx`）で確認します。`docker compose run --rm init` はコンテナを起動せずに全ての項目を検証します。

検証に通ると、init-caddy は `config.json` の `site.domain` を `SITE_DOMAIN` として `generated` ボリュームへ書き出します。Caddy は起動時にこのファイルを読み、`Caddyfile` の `{$SITE_DOMAIN}` を置換します。

### 接続元の制限

`mediamtx.yml` の `authInternalUsers` で、MediaMTX に接続できる送信元を制限します。

| 操作 | 許可する送信元 |
| --- | --- |
| publish（送出） | サーバー自身（127.0.0.1）と `HQ_IP` |
| read（取得） | サーバー自身（127.0.0.1）だけ。HLS の視聴者は Caddy を経由し、全て 127.0.0.1 からの接続になります |

`compose.yml` は `HQ_IP` を環境変数 `MTX_AUTHINTERNALUSERS_0_IPS` として MediaMTX へ渡します。`.env` に `HQ_IP` が無い場合、`docker compose up` は起動を中止します。

MediaMTX から本部 PC の IP がそのまま見える必要があります。本部 PC から送出し、`docker compose logs mediamtx` に `is publishing` が出ること、`authentication failed` が出ないことを確認します。

視聴者の IP は Caddy のアクセスログに記録されます。MediaMTX のログでは、HLS の視聴者は全て 127.0.0.1 と表示されます。

---

## 4. 運用のコマンド

```bash
# コンテナの状態を確認する
docker compose ps

# MediaMTX のログを表示する（ストリームの受信の状態）
docker compose logs -f mediamtx

# Caddy のログを表示する
docker compose logs -f caddy

# web/ の更新を反映する
git pull && docker compose restart caddy

# mediamtx.yml の変更を反映する
docker compose restart mediamtx
```

運用中に `.env` か `config.json` を変更した場合は、先に `docker compose run --rm init` で OK を確認し、その後で `docker compose up -d` を実行します。

- `.env` を変更すると、compose は init-mediamtx の完了を待たずに MediaMTX のコンテナを作り直します。init-mediamtx が NG の場合、新しい MediaMTX は起動せず、受信が止まります。
- `config.json` だけを変更した場合は、NG でも稼働中のコンテナはそのまま動作します。
- `docker compose restart` とホストの再起動では、検証のサービスは実行されません。Caddy は前回の init-caddy が書き出した `SITE_DOMAIN` で起動します。

---

## 5. ファイル構成

| ファイル・ディレクトリ | 内容 |
| --- | --- |
| `compose.yml` | 起動前の検証（init-mediamtx・init-caddy と、全ての項目を手で検証する init）、MediaMTX、Caddy のコンテナの定義（`network_mode: host`） |
| `mediamtx.yml` | SRT の受信、HLS の生成、接続元の制限。Ch のパス、パスフレーズ、本部 PC の IP は `.env` から読み込みます |
| `Caddyfile` | TLS 終端、`/hls/*` の MediaMTX へのリバースプロキシ、`web/` の静的配信。ホスト名は init-caddy が書き出した `SITE_DOMAIN` を使用します |
| `.env.example` | `.env` のテンプレート |
| `certs/` | TLS 証明書（Git 管理外） |
| `scripts/get-cert.sh` | Let's Encrypt から手動の DNS-01 チャレンジで TLS 証明書を取得し、`certs/` に保存するスクリプト |
| `scripts/smoke-test.sh` | 配信サーバーへテスト用の SRT のストリームを送信し、Caddy 経由で HLS のプレイリストとセグメントを取得できるかを確認するスクリプト |
| `logs/` | Caddy のアクセスログ（Git 管理外）。`compose.yml` でホストにマウントします |

---

## 6. アクセスログと視聴数の集計

### ログの場所と保存量

Caddy のアクセスログはホストの `hosts/server/logs/`（コンテナの中の `/var/log/caddy/`）に JSON 形式で記録されます。コンテナを作り直しても残ります。

| 項目 | 値 |
| --- | --- |
| ログの場所 | `hosts/server/logs/access.log`（現行分） |
| 形式 | JSON（Caddy の structured log、1 行 1 リクエスト） |
| ローテーション | 100 MiB ごとに gzip で圧縮 |
| 保持 | 300 世代・1 年（元の量で約 30 GB、圧縮後 3 GB 前後） |
| 容量の目安 | 200 人が 8 時間視聴すると 1 日で約 9 GB（圧縮前） |

`hosts/server/logs/` は視聴者の IP アドレスを含み、Git 管理外です。ログのファイルは root の所有で作成され、集計には `sudo` が必要です。

### 集計スクリプトの使い方

視聴ページとサイネージは、30 秒ごとに `/config.json` を読み直す時に、端末 ID・ページの種別・視聴中の Ch をクエリパラメータに付けます（`/config.json?v=<端末ID>&p=<ページ>&ch=<Ch>`）。`tools/analyze-access.py` はこの要求だけをアクセスログから抽出し、視聴数を集計します。

```bash
# 日ごとの延べ端末数と同時視聴数の最大を表示する
sudo python3 tools/analyze-access.py hosts/server/logs/access*.log*

# 1 分ごとの同時視聴数を CSV に書き出す（Ch ごと・サイネージの内訳つき）
sudo python3 tools/analyze-access.py --csv minutes.csv hosts/server/logs/access*.log*
```

| 値 | 定義 |
| --- | --- |
| 同時視聴数 | その 1 分間に要求を送った端末の数。開いている端末は 1 分に 1 回以上数えられます |
| 延べ端末数 | その日に現れた端末 ID の数 |

gzip で圧縮したログ（`.gz`）もそのまま読み込みます。

### 端末 ID に含まれる情報

端末 ID は `crypto.randomUUID()` で生成したランダムな UUID で、ブラウザの `localStorage` に保存されます。同じブラウザで開くと同じ ID が送られ、`localStorage` を消去すると新しい ID になります。ID には氏名・メールアドレス・端末の機種名・IP アドレスなどの個人情報を含みません。

アクセスログの各行には、ID とは別に、接続元の IP アドレスと User-Agent などの要求ヘッダーが記録されます（Cookie と Authorization は Caddy が伏せ字にします）。ログのファイルの取り扱いに注意します。
