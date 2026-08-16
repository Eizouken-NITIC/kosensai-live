# rehearsal — ローカル検証環境

`docker compose` で起動します。MediaMTX と Caddy は `hosts/server/` の `mediamtx.yml` と `Caddyfile`、および `web/` をそのままマウントして使用します。本番で本部 OBS が行う SRT 送出は、カラーバーを生成する ffmpeg のコンテナ 4 つ（チャンネルごとに 1 つ）が代わりに行います。

`caddy-preview` が Host ヘッダを付け替えて `caddy-origin` へ転送します（本番のCaddyfileを使用しつつプレビューしたいため）。

---

## 1. 起動と停止

```bash
cd rehearsal

# 起動（サーバーとテスト映像 4 系統）
docker compose up -d

# publisher を起動せず、配信前の「待機中」表示を確認する
docker compose up -d mediamtx caddy-origin caddy-preview

# publisher を停止・再開する（回線切断のシミュレーション）
docker compose stop pub-ch1
docker compose start pub-ch1

# app/ をビルドして反映する
./scripts/reload.sh

# 負荷テスト（20 人 / ch1 / 30 秒、および 10 人 × 全 Ch / 60 秒）
./scripts/load-test.sh 20 ch1 30
./scripts/load-test.sh 10 all 60

# MediaMTX のログを表示する
docker compose logs -f mediamtx

# 停止する
docker compose down -v

# 生成物（証明書・caddy-preview の Caddyfile・負荷テストの結果）を削除する
rm -rf generated
```

---

## 2. ブラウザで開く

| ページ | URL |
| --- | --- |
| 視聴ページ | [https://localhost:8444/](https://localhost:8444/) |
| サイネージ | [https://localhost:8444/signage/](https://localhost:8444/signage/) |
| チャンネル指定 | [https://localhost:8444/?ch=ch3](https://localhost:8444/?ch=ch3) |

証明書は Caddy の internal CA が接続時に発行するため、ブラウザは発行元を信頼せず警告を表示します。「詳細設定」から進んでください。CA の鍵はボリュームへ保持するので、一度受け入れれば `docker compose down -v` を実行するまでは再表示されません。

平文で待ち受けないのは、MediaMTX が HLS のセッション Cookie に `Secure` 属性を付与しており、ブラウザが安全なコンテキストと見なさない接続では Cookie を保存できず、再生が始まらないためです。

### LAN の実機（スマートフォン等）から開く

`https://<この PC のアドレス>:8444/` を開きます。IP アドレスは `ipconfig getifaddr en0`、mDNS 名は `hostname -s` の結果に `.local` を付けたもので確認できます。IP で直接開いた場合は証明書のホスト名も一致しませんが、操作は同じです。

### 本番と同じホスト名・TLS で開く

`:8444` は `caddy-preview` のエントリポイントであるため、本番 `Caddyfile` のホスト名マッチと TLS 設定そのものは検証できません。これらを確認する場合は、`/etc/hosts` へ一時的に追記して `caddy-origin` の `:8443` を直接開きます。

```bash
DOMAIN=$(python3 -c 'import json;print(json.load(open("../config.json"))["site"]["domain"])')
echo "127.0.0.1 ${DOMAIN}" | sudo tee -a /etc/hosts

# ブラウザで https://${DOMAIN}:8443/ を開く

# 追記を削除
sudo sed -i '' "/${DOMAIN//./\\.}/d" /etc/hosts
```

---

## 3. ファイル構成

- `compose.yml` … init・MediaMTX・Caddy 2 つ・テストパターン送出 4 系統のサービス定義
- `containers/` … コンテナの中で動作するもの
  - `init/` … 証明書と `caddy-preview` の Caddyfile を生成します
  - `publisher/` … カラーバーと 1kHz の基準音を SRT で送出します。チャンネル名と経過時刻を映像へ焼き込むため、遅延の目視に使用できます
  - `client/pull.sh` … 負荷テストのクライアント。hls.js の取得手順を curl で再現します
- `scripts/` … ホスト上で実行するスクリプト
- `generated/` … 生成物（Git 管理対象外）。`certs/` に証明書、`caddy/` に `caddy-preview` の Caddyfile、`load-test/` に負荷テストの結果を置きます

---

## 4. この環境で再現できないもの

- 無線区間の帯域とパケット損失。同一ホスト内のループバックで通信するため発生しません
- 本番 OBS のエンコード負荷。ffmpeg による簡易送出であるため再現しません
- SRT の再送挙動
- ブラウザ実機ごとの表示差
