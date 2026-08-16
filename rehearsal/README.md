# rehearsal — ローカル検証環境

`docker compose` で起動します。MediaMTX と Caddy は `hosts/server/` の `mediamtx.yml` と `Caddyfile`、および `web/` をそのままマウントして使用します。本番で本部 OBS が行う SRT 送出は、カラーバーを生成する ffmpeg のコンテナ 4 つ（チャンネルごとに 1 つ）が代わりに行います。

証明書と `preview` の Caddyfile は `init` サービスが起動時に生成するため、事前の準備はありません。

---

## 1. 起動と停止

```bash
cd rehearsal

# 起動（サーバーとテスト映像 4 系統）
docker compose up -d

# publisher を起動せず、配信前の「待機中」表示を確認する
docker compose up -d mediamtx caddy preview

# 起動済みの publisher を停止・再開する（回線切断のシミュレーション）
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

# 生成物（証明書・preview の Caddyfile・負荷テストの結果）を削除する
rm -rf certs generated out
```

---

## 2. ブラウザで開く

| ページ | URL |
| --- | --- |
| 視聴ページ | [http://localhost:8080/](http://localhost:8080/) |
| サイネージ | [http://localhost:8080/signage/](http://localhost:8080/signage/) |
| チャンネル指定 | [http://localhost:8080/?ch=ch3](http://localhost:8080/?ch=ch3) |

### LAN の実機（スマートフォン等）から開く

`https://<この PC のアドレス>:8444/` を開きます。IP アドレスは `ipconfig getifaddr en0`、mDNS 名は `hostname -s` の結果に `.local` を付けたもので確認できます。

証明書は Caddy の internal CA が接続時に発行するため、ブラウザは発行元を信頼せず警告を表示します。「詳細設定」から進んでください。IP で直接開いた場合は証明書のホスト名も一致しませんが、操作は同じです。

平文の `http://` では再生が始まりません。MediaMTX が HLS のセッション Cookie に `Secure` 属性を付与するためです。`http://localhost` だけは例外的に安全なコンテキストとして扱われるため、この PC からは `:8080` で視聴できます。

### 本番と同じホスト名・TLS で開く

`:8080` と `:8444` は Host ヘッダを付け替えて本番 Caddy へ転送するプレビュー用のエントリポイントです。本番 `Caddyfile` のホスト名マッチと TLS 設定そのものを確認する場合は、`/etc/hosts` へ一時的に追記して `:8443` を直接開きます。

```bash
DOMAIN=$(python3 -c 'import json;print(json.load(open("../config.json"))["site"]["domain"])')
echo "127.0.0.1 ${DOMAIN}" | sudo tee -a /etc/hosts

# ブラウザで https://${DOMAIN}:8443/ を開く

# 確認後は必ず追記を削除する
sudo sed -i '' "/${DOMAIN//./\\.}/d" /etc/hosts
```

---

## 3. ファイル構成

- `compose.yml` … init・MediaMTX・Caddy・プレビュー中継・テストパターン送出 4 系統
- `init/` … 証明書と `preview` の Caddyfile を生成するコンテナ
- `publisher/` … カラーバーと 1kHz の基準音を SRT で送出するコンテナ。チャンネル名と経過時刻を映像へ焼き込むため、遅延の目視に使用できます
- `client/pull.sh` … 負荷テストのクライアント。hls.js の取得手順を curl で再現します
- `scripts/` … ホスト上で実行するスクリプト
- `certs/` `generated/` `out/` … 生成物（Git 管理対象外）

---

## 4. この環境で再現できないもの

- 無線区間の帯域とパケット損失。同一ホスト内のループバックで通信するため発生しません
- 本番 OBS のエンコード負荷。ffmpeg による簡易送出であるため再現しません
- SRT の再送挙動
- ブラウザ実機ごとの表示差
