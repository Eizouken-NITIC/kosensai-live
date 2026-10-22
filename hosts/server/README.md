# hosts/server — 配信サーバー構築・運用手順書

本ディレクトリは、SRT ストリームを受信して HLS 形式の動画を生成する MediaMTX と、TLS 終端・静的コンテンツ配信・リバースプロキシを担う Caddy を、Docker Compose 環境で起動・運用するための各種設定と手順を管理しています。

配信サーバーには、本ディレクトリ配下のファイル群のみを配置（デプロイ）します。配信サイトの実体は、リポジトリ直下の `web/` ディレクトリに格納されており、`compose.yml` 内で `../../web` としてマウントして配信されます。

---

## 1. 配信サーバーのデータフロー

```
                   SRT接続 (:8890)              HLS転送 (127.0.0.1:8888)
本部OBS ──────────────────► MediaMTX ──────────────────► Caddy (:443) ──► 来場者・サイネージ
   streamid=publish:chN                                    │
   passphrase=<.envに設定>                                 ├─ /            web/index.html
                                                           ├─ /signage/    web/signage/index.html
                                                           ├─ /hls/*       reverse_proxy :8888
                                                           └─ /healthz
```

---

## 2. システム要件

| 項目 | 動作環境・システム要件 | 備考 |
| --- | --- | --- |
| **OS** | Ubuntu 22.04 LTS / 24.04 LTS | |
| **CPU** | 2 コア以上 | トランスコードは行わず、HLS への remux のみを行います。 |
| **RAM** | 4 GB 以上 | HLS セグメントをメモリ上に保持します。 |
| **ディスク容量**| 20 GB 以上 | ログおよび一時セグメントファイルの格納領域です。 |
| **ネットワーク**| ブリッジ接続・配信用 VLAN・**固定 IP アドレス** | |

### SRT バッファのカーネルパラメータ設定
SRT プロトコルの安定したパケット転送のため、カーネルパラメータの `net.core.rmem_max` の値を引き上げてください。

```bash
# パラメータの現在値を確認するコマンド
sysctl -n net.core.rmem_max        # 「26214400」が返ることを確認します
```

---

## 3. サーバーセットアップ手順

```bash
# 1. SRT 用のネットワークバッファを確保
sudo sysctl -w net.core.rmem_max=26214400
sudo sysctl -n net.core.rmem_max
echo 'net.core.rmem_max=26214400' | sudo tee /etc/sysctl.d/99-srt.conf

# 2. 本リポジトリをクローンし、作業ディレクトリへ移動します
git clone <本リポジトリのURL> && cd kosensai-live/hosts/server

# 3. .env ファイルを作成し、パスフレーズと各マシンの IP を記述します（パスフレーズは 10〜79 文字。`OBS_<Ch>_LISTEN_PASSPHRASE` は 10〜63 文字）
cp .env.example .env
for i in 1 2 3 4 5; do openssl rand -base64 24; done   # パスフレーズは 1 つずつ別の値にします
$EDITOR .env

# 4. TLS 証明書を取得します（DNS-01 チャレンジを使用します）
sudo ./scripts/get-cert.sh

# 5. 起動前の検証だけを実行します（任意。全ての項目を検証します）
docker compose run --rm init

# 6. コンテナ群をバックグラウンドで起動します
docker compose up -d

# 7. 疎通テストを実行します（例: ch1 の疎通テスト）
./scripts/smoke-test.sh ch1
```

> [!WARNING]
> `.env` に定義する各種パスフレーズ（passphrase）は、送信側（OBS などの送出用 PC）の設定値と完全に一致している必要があります。

### .env の設定項目

| 変数 | 用途 |
| --- | --- |
| `MTX_PATHS_<Ch>_SRTPUBLISHPASSPHRASE` | 本部 OBS → 配信サーバーの送出に使うパスフレーズです。**ATEM・スマートフォンには設定しません。** |
| `OBS_<Ch>_LISTEN_PASSPHRASE` | ATEM・スマートフォン → 本部 OBS（SRT Listener）に使うパスフレーズです。ATEM とスマートフォンに設定するのはこちらです。`obsListenPort` を持つ Ch にだけ設定します。ATEM のパスフレーズの欄は 63 文字までのため、10〜63 文字にします。 |
| `HQ_IP` | 本部 PC の IPv4 アドレスです。配信サーバーへの送出は、この IP とサーバー自身からだけ受け付けます。ATEM・スマートフォンの送信先もこの IP です。 |
| `SERVER_IP` | 本部 PC から見た配信サーバーの IPv4 アドレスです。`kosensai-live obs build` が obs-multi-rtmp の送出先の URL に使用します。 |
| `ATEM_IP` | ATEM の IPv4 アドレスです。`kosensai-live atem` が使用します。 |

MediaMTX は `MTX_PATHS_<Ch>_SRTPUBLISHPASSPHRASE` から Ch のパスを作成します。`config.json` に無い Ch の変数があると、公開されないパスを作成するため NG にします。

受信用と送出用のパスフレーズを同じ値にすると、ATEM・スマートフォンを操作する人が本部 OBS を通さずに公開 Ch へ送出できてしまうため、NG にします。

### 起動前の検証

`docker compose up` のたびに、`compose.yml` の 2 つの検証のサービスが `tools/kosensai_live/config.py check` を実行します。NG があれば、そのサービスが対象とするコンテナを起動しません（稼働中の場合の動作は「4. 運用・管理コマンド」の注意を参照してください）。

| サービス | 検証する項目 | NG の場合に起動しないもの |
| --- | --- | --- |
| `init-mediamtx` | `.env` の Ch と `config.json` の `channels[].id` の一致、パスフレーズの長さと重複、`HQ_IP` の形式、`net.core.rmem_max` | MediaMTX と Caddy |
| `init-caddy` | `.env` の Ch とパスフレーズ、`web/` のビルド成果物とライセンス本文の有無、証明書と秘密鍵の組み合わせ、証明書のホスト名が `config.json` の `site.domain` を含むこと、有効期限 | Caddy |

証明書は Caddy（HTTPS）だけが使用するため、証明書が無い状態でも MediaMTX は起動し、本部 OBS からの送出を受信できます。

NG の場合、`docker compose up` は `service "init-caddy" didn't complete successfully` のように終了します。内容は `docker compose logs init-caddy`（または `init-mediamtx`）で確認してください。`docker compose run --rm init` は、起動せずに全ての項目を検証します。

検証に通ると、init-caddy は `config.json` の `site.domain` を `SITE_DOMAIN` として `generated` ボリュームへ書き出します。Caddy は起動時にこのファイルを読み、`Caddyfile` の `{$SITE_DOMAIN}` を置換します。

### 接続元の制限

`mediamtx.yml` の `authInternalUsers` で、MediaMTX に接続できる送信元を制限しています。

| 操作 | 許可する送信元 |
| --- | --- |
| publish（送出） | サーバー自身（127.0.0.1）と `HQ_IP` |
| read（取得） | サーバー自身（127.0.0.1）のみ。HLS の視聴者は Caddy を経由するため、すべて 127.0.0.1 からの接続になります。 |

`HQ_IP` は `compose.yml` が環境変数 `MTX_AUTHINTERNALUSERS_0_IPS` として MediaMTX へ渡します。`.env` に `HQ_IP` が無い場合、`docker compose up` は起動を中止します。

この制限は、MediaMTX から**送信元の IP がそのまま見えている**ことを前提にしています。配信サーバーを VM や LXC（Proxmox など）で動かす場合は、ブリッジ接続で LAN 上に固有の IP を持たせてください。NAT を挟むと、本部 PC からの送出が NAT の IP に見えて拒否されます。本部 PC から送出して `docker compose logs mediamtx` に `is publishing` が出ること、`authentication failed` が出ないことを確認してください。

視聴者の IP は Caddy のアクセスログに残ります。MediaMTX のログでは、HLS の視聴者はすべて 127.0.0.1 と表示されます。

手順 7 の `smoke-test.sh` には、SRT を有効にしてビルドされた ffmpeg が必要です。`ffmpeg -protocols | grep -w srt` で確認できます。非対応のビルドしか用意できない場合は、Docker 版（`jrottenberg/ffmpeg` など）を `--network host` で実行して代用してください。

---

## 4. 運用・管理コマンド

```bash
# コンテナの稼働ステータスを確認します
docker compose ps

# MediaMTX のログを表示（ストリーム受信状態などの確認）
docker compose logs -f mediamtx

# Caddy のログを表示（アクセスログの確認）
docker compose logs -f caddy

# 静的コンテンツ（web/ 配下）の更新内容を反映します
git pull && docker compose restart caddy

# MediaMTX の設定（mediamtx.yml）の変更を即時反映します
docker compose restart mediamtx
```

> [!WARNING]
> 運用中に `.env` や `config.json` を変更した場合は、先に `docker compose run --rm init` を実行して OK を確認し、その後で `docker compose up -d` を実行してください。
> `.env` を変更すると、compose は init-mediamtx の完了を待たずに MediaMTX のコンテナを削除して作り直します。init-mediamtx が NG の場合、新しい MediaMTX は起動せず、受信が止まります。`config.json` だけを変更した場合は、NG でも稼働中のコンテナはそのまま動作します。
>
> `docker compose restart` では検証のサービスが実行されません。ホストの再起動時も検証は実行されず、前回の init-caddy が書き出した値で起動します。

---

## 5. ファイル構成と役割

| ファイル・ディレクトリ | 役割・設定内容 |
| --- | --- |
| `compose.yml` | 起動前の検証（init-mediamtx・init-caddy、手で全ての項目を検証する init）、MediaMTX、Caddy のコンテナ定義（`network_mode: host`） |
| `mediamtx.yml` | SRT ストリームの受信と HLS 生成、接続元の制限の設定。Ch のパス、パスフレーズ、本部 PC の IP は `.env` から読み込みます。 |
| `Caddyfile` | TLS 終端、`/hls/*` パスに対する MediaMTX へのリバースプロキシ転送、および `web/` の静的配信設定。ホスト名は init-caddy が書き出した `SITE_DOMAIN` を使用します。 |
| `.env.example` | 各種パスフレーズと各マシンの IP を設定するためのテンプレート。 |
| `certs/` | Certbot 経由で取得した本番用 TLS 証明書の格納先（Git 管理対象外）。 |
| `scripts/get-cert.sh` | Let's Encrypt から手動 DNS-01 チャレンジ方式で TLS 証明書を取得し、`certs/` に配置するスクリプト。 |
| `scripts/smoke-test.sh` | 配信サーバーへテスト用 SRT ストリームを送信し、正常に HLS セグメントが生成されて再生可能かを実機検証するスクリプト。 |
| `logs/` | Caddy が出力するアクセスログの格納先（Git 管理対象外）。`compose.yml` でホストにマウントされます。 |

---

## 6. アクセスログと視聴数の集計

### ログの場所と保存量

Caddy のアクセスログは、ホスト側の `hosts/server/logs/` ディレクトリ（コンテナ内の `/var/log/caddy/`）に JSON 形式で記録されます。`compose.yml` でホストのディレクトリにマウントしているため、コンテナを再作成しても消えません。

| 項目 | 値 |
| --- | --- |
| **ログの場所** | `hosts/server/logs/access.log`（現行分） |
| **形式** | JSON（Caddy structured log、1 行 1 リクエスト） |
| **ローテーション** | 100 MiB ごとに gzip 圧縮 |
| **保持世代数** | 300 世代（元の量で約 30 GB、圧縮後 3 GB 前後） |
| **目安容量** | 200 人が 8 時間視聴すると 1 日で約 9 GB（圧縮前） |

`hosts/server/logs/` は来場者の IP アドレスを含むため、`.gitignore` で Git 管理対象外にしています。ログファイルは root 所有で作成されるため、集計時は `sudo` が必要です。

### 集計スクリプトの使い方

視聴ページとサイネージは、30 秒ごとに `/config.json` を読み直す際、クエリパラメータとして端末 ID・ページ種別・視聴中の Ch を付与します（`/config.json?v=<端末ID>&p=<ページ>&ch=<Ch>`）。`tools/analyze-access.py` はこの要求だけをアクセスログから抽出し、視聴数を集計します。

```bash
# 日ごとの延べ端末数・同時視聴数の最大を表示します
sudo python3 tools/analyze-access.py hosts/server/logs/access*.log*

# 1 分ごとの同時視聴数を CSV に書き出します（Ch ごと・サイネージの内訳つき）
sudo python3 tools/analyze-access.py --csv minutes.csv hosts/server/logs/access*.log*
```

同時視聴数は、その 1 分間に要求を送った端末の数です。読み直しは 30 秒ごとのため、開いている端末は 1 分に必ず 1 回以上数えられます。延べ端末数は、その日に現れた ID の数です。gzip 圧縮済みのログファイル（`.gz`）もそのまま読めます。

### 端末 ID に含まれる情報

端末 ID は `crypto.randomUUID()` で生成したランダムな UUID であり、ブラウザの `localStorage` に保存されます。同じブラウザで再度開くと同じ ID が送られます。

- **含まれるもの**: ランダムな文字列のみ
- **含まれないもの**: 氏名・メールアドレス・端末の機種名・IP アドレスなどの個人情報

ID からは「同じブラウザからの接続である」ことだけが分かります。`localStorage` を消去すると新しい ID が割り振られます。

ID 自体は個人情報を含みませんが、アクセスログの各行には ID とは別に、接続元の IP アドレスと User-Agent などの要求ヘッダーが記録されます（Cookie と Authorization は Caddy が伏せ字にします）。ログファイルの取り扱いには注意してください。
