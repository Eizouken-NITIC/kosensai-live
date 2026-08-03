# hosts/stream-server — 配信サーバー

**設置場所:** 総合情報センター / Proxmox 上の LXC（または VM）
**担当:** 映像研（ハードウェアと NW は NW 班）
**役割:** MediaMTX（SRT 受信 → HLS 生成）+ Caddy（TLS 終端・静的配信・リバースプロキシ）

このディレクトリの中身だけがこのマシンにデプロイされる。
配信サイト本体は共同成果物なのでリポジトリ直下の `web/` にあり、
`docker-compose.yml` から `../../web` としてマウントしている。

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

Ubuntu 22.04 LXC（`features: nesting=1` で Docker-in-LXC を有効化）または VM。

| 項目 | 値 |
| --- | --- |
| CPU | 2 コア以上（トランスコードはせず HLS リマックスのみ） |
| RAM | 2GB 以上 |
| ディスク | 20GB（ログ・セグメント一時ファイル） |
| ネットワーク | ブリッジ接続・配信用 VLAN・**固定 IP** |

## 2. セットアップ

```bash
# SRT の再送バッファを確保（デフォルトだと不足する）
sudo sysctl -w net.core.rmem_max=26214400
echo 'net.core.rmem_max=26214400' | sudo tee /etc/sysctl.d/99-srt.conf

git clone <このリポジトリ> && cd kosensai-broadcast/hosts/stream-server

# パスフレーズを 4 本生成して .env に記入（Ch ごとに別の値・10〜79 文字）
cp .env.example .env
for i in 1 2 3 4; do echo "ch$i: $(openssl rand -base64 24)"; done
$EDITOR .env

# 証明書（TXT レコード登録依頼を挟むので前日までに）
sudo ./scripts/get-cert.sh

./scripts/preflight.sh      # 起動前チェック
docker compose up -d
./scripts/smoke-test.sh ch1 # 疎通確認
```

`.env` の値は **本部 OBS 側の passphrase と一致させる**こと。
本部に渡す SRT URL は `hosts/hq-obs/srt-urls.sh` で生成できる。

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
| `scripts/preflight.sh` | 起動前チェック（設定・パスフレーズ・証明書・sysctl・Ch 定義の突き合わせ） |
| `scripts/get-cert.sh` | Let's Encrypt を DNS-01（手動）で取得し `certs/` に配置 |
| `scripts/smoke-test.sh` | テストパターンを SRT 送出 → HLS 取得まで確認 |

## 5. 設計上の判断

- **`network_mode: host`** … bridge だと SRT の UDP ポートフォワードで問題が出やすい。
- **`all_others` パスを定義しない** … 定義するとワイルドカードとして任意のパスへの
  publish を許してしまう。ch1〜ch4 以外は `path 'chX' is not configured` で拒否される
  ことを実機確認済み。
- **`hlsVariant: mpegts` を明示** … MediaMTX v1.19 の既定は `lowLatency`。
  LL-HLS はリクエスト頻度が大きく増えるため、ブラウザ互換性優先で通常 HLS にしている。
- **`moq: no`** … v1.19 から MoQ サーバーが既定 on で :8892 を開き、証明書を自動生成する。
  使わないので明示的に落としている。
- **Caddy の自動 ACME は無効** … 学内サーバーには外部からの HTTP-01 審査通信が届かない。
  DNS-01 で手動取得した証明書を `tls` で直指定する。

## 6. 未確定事項

- MediaMTX/Caddy マシンの IP（NW 班待ち。現状は OBS と同一ホスト前提で `127.0.0.1`）
- TLS 終端の最終担当（2026/07/20 時点で Caddy 終端の見込み）。
  NW 班側終端に変わる場合は `Caddyfile` の `tls` 行と `:80` ブロックを見直す。
