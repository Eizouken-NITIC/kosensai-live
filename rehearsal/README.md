# rehearsal — ローカル検証環境

ローカル検証環境は `docker compose` で起動します。MediaMTX と Caddy は `hosts/server/` の `mediamtx.yml` と `Caddyfile`、`web/` をそのままマウントして使用します。本部 PC の SRT の送出はカラーバーを送出する ffmpeg のコンテナ 3 つ（チャンネルごとに 1 つ）が行います。

`caddy-preview` は Host ヘッダーを本番のホスト名に付け替えて、本番の `Caddyfile` で動く `caddy-origin` へ転送します。

---

## 1. 起動と停止

```bash
cd rehearsal

# 起動する（サーバーとカラーバーの送出 3 系統）
docker compose up -d

# publisher を起動せず、配信前の「待機中」の表示を確認する
docker compose up -d mediamtx caddy-origin caddy-preview

# publisher を停止・再開する（回線の切断の再現）
docker compose stop pub-ch1
docker compose start pub-ch1

# app/ をビルドして反映する
uv run kosensai-live rehearsal reload

# 負荷テスト（20 人 / ch1 / 30 秒、10 人 × 全 Ch / 60 秒）
uv run kosensai-live rehearsal load-test 20 ch1 30
uv run kosensai-live rehearsal load-test 10 all 60

# MediaMTX のログを表示する
docker compose logs -f mediamtx

# 停止する
docker compose down -v

# 生成物（証明書・Caddy 用の SITE_DOMAIN・負荷テストの結果）を削除する
rm -rf generated
```

---

## 2. ブラウザで開く

| ページ | URL |
| --- | --- |
| 視聴ページ | [https://localhost:8444/](https://localhost:8444/) |
| サイネージ | [https://localhost:8444/signage/](https://localhost:8444/signage/) |
| チャンネル指定 | [https://localhost:8444/?ch=ch3](https://localhost:8444/?ch=ch3) |

証明書は Caddy の internal CA が発行し、ブラウザは警告を表示します。「詳細設定」から進みます。CA の鍵はボリュームに保存され、一度受け入れると `docker compose down -v` を実行するまで警告は表示されません。HTTP（平文）では待ち受けません。

### LAN の実機（スマートフォン等）から開く

`https://<この PC の IP アドレス>:8444/` を開きます。IP アドレスは OS のネットワークの設定で確認します。証明書のホスト名は一致しませんが、操作は同じです。

### 本番と同じホスト名・TLS で開く

`:8444`（`caddy-preview`）では、本番の `Caddyfile` のホスト名のマッチと TLS の設定を検証できません。これらを確認する場合は、hosts ファイルに一時的に追記し、`caddy-origin` の `:8443` を直接開きます。

1. `config.json` の `site.domain` でホスト名を確認します。
2. hosts ファイル（macOS・Linux は `/etc/hosts`、Windows は `C:\Windows\System32\drivers\etc\hosts`）に管理者の権限で `127.0.0.1 <ホスト名>` の行を追記します。
3. ブラウザで `https://<ホスト名>:8443/` を開きます。
4. 確認した後、追記した行を削除します。

---

## 3. ファイル構成

| パス | 内容 |
| --- | --- |
| `compose.yml` | init・MediaMTX・Caddy 2 つ・カラーバーの送出 3 系統のサービスの定義 |
| `rehearsal.env` | ローカル検証環境のパスフレーズ。本番の `hosts/server/.env` と同じ形式で、MediaMTX と publisher が読み込みます |
| `containers/init/` | `rehearsal.env` を本番と同じ規則（`tools/kosensai_live/config.py check`）で検証し、証明書と Caddy 用の `SITE_DOMAIN` を生成します。`preview.Caddyfile` は `caddy-preview` の設定です |
| `containers/publisher/` | カラーバーと 1 kHz の基準音を SRT で送出します。映像にチャンネル名と経過時刻を表示し、遅延を目視で確認できます |
| `containers/client/pull.sh` | 負荷テストのクライアント。hls.js の取得の手順を curl で実行します |
| `generated/` | 生成物（Git 管理外）。`certs/` に証明書、`caddy/` に Caddy 用の `SITE_DOMAIN`、`load-test/` に負荷テストの結果を保存します |

---

## 4. この環境で再現できないもの

| 項目 | 内容 |
| --- | --- |
| 無線区間の帯域とパケットの損失 | 同じホストの中のループバックで通信します |
| 本部 PC の OBS のエンコードの負荷 | ffmpeg の簡易な送出で代替します |
| SRT の再送の動作 | ― |
| ブラウザの実機ごとの表示の差 | ― |
