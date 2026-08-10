# hosts/server — 配信サーバー

MediaMTX（SRT 受信 → HLS 生成）と Caddy（TLS 終端・静的配信・リバースプロキシ）を
Docker Compose で動かすマシン。

このディレクトリの中身だけがこのマシンにデプロイされる。配信サイト本体はリポジトリ
直下の `web/` にあり、`docker-compose.yml` から `../../web` としてマウントしている。

```
                   SRT :8890                    HLS 127.0.0.1:8888
本部OBS ──────────────────► MediaMTX ──────────────────► Caddy :443 ──► 来場者/サイネージ
   streamid=publish:chN                                    │
   passphrase=<.env の値>                                   ├─ /            web/index.html
                                                           ├─ /signage/    web/signage/index.html
                                                           ├─ /hls/*       reverse_proxy :8888
                                                           └─ /healthz
```

## 1. マシン要件

| 項目 | 値 |
| --- | --- |
| 形態 | **VM**（LXC ではなく。理由は下記） |
| OS | Ubuntu 22.04 / 24.04 |
| CPU | 2 コア以上（トランスコードはせず HLS リマックスのみ） |
| RAM | 4GB 以上（HLS のセグメントをメモリ上に保持する。`mediamtx.yml` の `hlsSegmentCount` 参照） |
| ディスク | 20GB（ログ・セグメント一時ファイル） |
| ネットワーク | ブリッジ接続・配信用 VLAN・**固定 IP** |

LXC ではなく VM を使う。SRT の再送バッファのために `net.core.rmem_max` を上げるが、
LXC ではカーネルをホストと共有するため、ホスト側の設定変更が必要になる場合がある。
LXC で構築する場合は、設定後に読み戻して効いていることを確認する。

```bash
sysctl -n net.core.rmem_max        # 26214400 が返らなければホスト側の設定が必要
```

## 2. セットアップ

```bash
# SRT の再送バッファを確保（デフォルトだと不足する）
sudo sysctl -w net.core.rmem_max=26214400
sudo sysctl -n net.core.rmem_max     # 26214400 が返ること（§1 参照）
echo 'net.core.rmem_max=26214400' | sudo tee /etc/sysctl.d/99-srt.conf

git clone <このリポジトリ> && cd kosensai-broadcast/hosts/server

# パスフレーズを 4 本生成して .env に記入（Ch ごとに別の値・10〜79 文字）
cp .env.example .env
for i in 1 2 3 4; do echo "ch$i: $(openssl rand -base64 24)"; done
$EDITOR .env

# 証明書。DNS-01 のため TXT レコードの登録を挟み、途中で待ちが入る
sudo ./scripts/get-cert.sh

./scripts/preflight.sh      # 起動前チェック
docker compose up -d
./scripts/smoke-test.sh ch1 # 疎通確認
```

`.env` の値は **送出側の passphrase と一致している必要がある。**
送出側へ渡す SRT URL は `hosts/obs/srt-urls.sh` が生成する。

## 3. 運用コマンド

```bash
docker compose ps
docker compose logs -f mediamtx      # 受信状況・publish 拒否の理由
docker compose logs -f caddy         # HTTPS / HLS のアクセスログ

git pull && docker compose restart caddy    # web/ の更新を反映
docker compose restart mediamtx             # mediamtx.yml の変更を反映
```

`.env` を書き換えた場合は `docker compose up -d` で作り直す（restart では反映されない）。

## 4. ファイル

| ファイル | 内容 |
| --- | --- |
| `docker-compose.yml` | MediaMTX + Caddy。どちらも `network_mode: host` |
| `mediamtx.yml` | SRT 受信・HLS 生成。**パスフレーズは含まない**（`.env` から注入） |
| `Caddyfile` | TLS 終端、`/hls/*` のリバースプロキシ、`web/` の静的配信 |
| `.env.example` | パスフレーズのテンプレート。`.env` は git 管理外 |
| `certs/` | certbot で取得した証明書の置き場。git 管理外 |
| `scripts/preflight.sh` | 起動前チェック（設定・パスフレーズ・証明書・sysctl・`config.json` との突き合わせ） |
| `scripts/get-cert.sh` | Let's Encrypt を DNS-01（手動）で取得し `certs/` に配置 |
| `scripts/smoke-test.sh` | テストパターンを SRT 送出 → HLS 取得まで確認 |

設定値を選んだ理由は `mediamtx.yml` と `Caddyfile` のコメントに、複数のファイルに跨る
決定は Notion「設計上の決定と計測」にある。
