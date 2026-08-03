# hosts/server — 配信サーバー

**設置場所:** 総合情報センター / Proxmox 上の VM
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

**Proxmox の VM 1 台に、MediaMTX と Caddy を Docker Compose で同居させる。**

| 項目 | 値 |
| --- | --- |
| 形態 | **VM**（LXC ではなく。理由は下記） |
| OS | Ubuntu 22.04 / 24.04 |
| CPU | 2 コア以上（トランスコードはせず HLS リマックスのみ） |
| RAM | 2GB 以上 |
| ディスク | 20GB（ログ・セグメント一時ファイル） |
| ネットワーク | ブリッジ接続・配信用 VLAN・**固定 IP** |

### MediaMTX と Caddy の同居について

Notion「インフラ・ネットワーク連携要件 §3-1」で決定済み。同一ホストの :443 で
Caddy を TLS 終端とし、MediaMTX は `hlsAddress: 127.0.0.1:8888`・
`hlsTrustedProxies: [127.0.0.1]` で待ち受ける（値も同 §3-1 の表で指定されている）。
このリポジトリはその決定をそのまま実装しているだけで、ここで再検討はしていない。

なお `hlsAddress` は MediaMTX の設定値であって仕様上の制約ではない
（既定は `:8888` で全インターフェース）。将来分離したくなった場合は、
この値と MediaMTX 側のアクセス制御を見直せば技術的には分離できる。

### VM か LXC か（Notion では未確定。ここで決めた）

Notion「ソフトウェア構成・設定例 §8」は **LXC（または VM）** とだけ書かれていて
どちらでもよい形になっている。ここでは **VM を選ぶ**。

SRT の再送バッファのために `net.core.rmem_max` を上げる必要があるが、
**この sysctl がネットワーク名前空間ごとに持てるかどうかはカーネル次第**。
新しめのカーネルでは namespaced だが、古いカーネルではホスト全体で 1 つしかない。

- **VM なら**、カーネルが独立しているのでゲスト内で設定すれば必ず効く。
- **LXC だと**、カーネルを Proxmox ホストと共有するため、namespaced でない
  カーネルでは **Proxmox ホスト側**で設定する必要があり、他のゲストにも影響する。
  サーバーは NW 班の管理物なので、ホスト全体の設定変更を依頼しなくて済む形が望ましい。

加えて Docker-in-LXC は `nesting=1` 等の追加設定が要る。VM の方が部品が少ない。

LXC でやる場合は、コンテナ内で設定して**読み戻しで効いているか必ず確認する**こと。

```bash
sysctl -w net.core.rmem_max=26214400
sysctl -n net.core.rmem_max        # 26214400 が返らなければホスト側で設定が必要
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

# 証明書（TXT レコード登録依頼を挟むので前日までに）
sudo ./scripts/get-cert.sh

./scripts/preflight.sh      # 起動前チェック
docker compose up -d
./scripts/smoke-test.sh ch1 # 疎通確認
```

`.env` の値は **本部 OBS 側の passphrase と一致させる**こと。
本部に渡す SRT URL は `hosts/obs/srt-urls.sh` で生成できる。

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

### Notion で既に決まっていること（ここでは実装するだけ）

- **Caddy を唯一の TLS 終端とし、MediaMTX と同一ホストに置く**（インフラ §3-1）
- **`hlsAddress: 127.0.0.1:8888` / `hlsEncryption: no` / `hlsTrustedProxies: [127.0.0.1]`**（同 §3-1 の表）
- **Caddy の自動 ACME は無効、DNS-01 で手動取得した証明書を直指定**（同 §3-1）。
  学内サーバーには外部からの HTTP-01 審査通信が届かないため。
- **`network_mode: host`**（ソフトウェア構成 §8）。bridge だと SRT の UDP
  ポートフォワードで問題が出やすい。
- **通常 HLS（セグメント 6 秒）をデフォルトとし、LL-HLS は必要と判明した場合のみ**（同 §1）

### このリポジトリで判断したこと

- **VM を選択**（§1）。Notion は LXC / VM どちらでもよい書き方だった。
- **`hlsVariant: mpegts` を明示的に書く。** Notion には「デフォルト通常 HLS」と
  あるが、MediaMTX v1.19 の既定は `lowLatency` に変わっている。明示しないと
  意図せず LL-HLS になる。
- **`moq: no`。** v1.19 から MoQ サーバーが既定 on で :8892 を開き、証明書を
  自動生成する。使わないので落とした。
- **`all_others` パスを定義しない。** 定義するとワイルドカードとして任意のパスへの
  publish を許してしまう。ch1〜ch4 以外が `path 'chX' is not configured` で
  拒否されることは実機確認済み。
- **パスフレーズを `.env` から `MTX_PATHS_*` で注入。** Notion の例では
  `mediamtx.yml` に直書きされているが、それだと git に載るため分離した。
- **Caddy の `/hls` ブロックで CORS / Cache-Control を足さない。** 同一オリジンで
  CORS チェックが走らないうえ、Caddy の `header` は上書きなので MediaMTX の
  `private, no-cache` を潰してしまうため。

## 6. 未確定事項

- MediaMTX/Caddy マシンの IP（NW 班待ち。現状は OBS と同一ホスト前提で `127.0.0.1`）
- TLS 終端の最終担当（2026/07/20 時点で Caddy 終端の見込み）。
  NW 班側終端に変わる場合は `Caddyfile` の `tls` 行と `:80` ブロックを見直す。
