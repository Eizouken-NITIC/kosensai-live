# rehearsal — ローカルリハーサル環境

ノート PC 1 台で「テストパターン 4 本 → MediaMTX → Caddy → 視聴ページ」を丸ごと
立ち上げる。配信サーバーを用意しなくても、視聴ページ・サイネージ・Ch 切替・
自動リトライ・負荷まで各自の手元で確認できる。

**本番と同じ `mediamtx.yml` / `Caddyfile` / `web/` をコピーせずマウントして使う。**
コピーを置くと必ず本番とズレるので、ここには設定ファイルの実体を置いていない。
違うのは「自己署名証明書を使う」「ポートが 8443」「テストパターンを流す」の 3 点だけ。

```
現場・本部OBS の代わり            本番と同じもの                  本番と同じもの
┌──────────────┐   SRT   ┌──────────────────┐  HLS  ┌───────────────┐
│ ffmpeg × 4   │────────►│ MediaMTX         │──────►│ Caddy :443    │
│ testsrc      │  :8890  │ ../hosts/server/ │ :8888 │ ../hosts/     │
│ (Ch1〜Ch4)   │         │   mediamtx.yml   │       │  server/      │
└──────────────┘         └──────────────────┘       │   Caddyfile   │
                                                     │ ../web/       │
                                                     └───────┬───────┘
                                                             │ :8443
                              ┌──────────────────────────────┴──────┐
                              │ ブラウザ / scripts/load-test.sh     │
                              └─────────────────────────────────────┘
```

テスト全体の中でのここの位置づけは
[../docs/test-procedure.md](../docs/test-procedure.md) の「段階 1」。

## 使い方

```bash
cd rehearsal

./scripts/up.sh                    # サーバ + テストパターン4本
./scripts/up.sh --idle             # サーバのみ（配信前の「待機中」表示を見たいとき）

./scripts/reload.sh                # app/ をビルドして反映（開発中はこれ）
./scripts/load-test.sh 20 ch1 30   # 20人 / ch1 / 30秒
./scripts/load-test.sh 10 all 60   # 10人ずつ全Ch同時

docker compose logs -f mediamtx    # 受信状況・publish 拒否の理由
./scripts/down.sh                  # 停止
./scripts/down.sh --clean          # 証明書と負荷テストの結果も消す
```

### ブラウザで開く

**`/etc/hosts` の変更も証明書の警告も要らない。**

| | URL |
| --- | --- |
| 視聴ページ | `http://localhost:8080/` |
| サイネージ | `http://localhost:8080/signage/` |
| Ch 直接開き | `http://localhost:8080/?ch=ch3` |

本番の `Caddyfile` はホスト名 `live.kosensai.ichinoseki.ac.jp` で site を
マッチするので、素直にやると `/etc/hosts` への追記が要る。だが**消し忘れると
本番の DNS が引けなくなって事故る**ので、Host ヘッダを付け替えるだけの入口
（`preview.Caddyfile`）を別に立ててある。

```
http://localhost:8080/  →  Host を付け替え  →  https://127.0.0.1:443（本番の Caddy）
```

`http://localhost` はブラウザから secure context として扱われるため、
MediaMTX が張る `Secure` 属性付きの Cookie もそのまま通る。

<details>
<summary>本番と同じホスト名・TLS で開きたい場合</summary>

ホスト名マッチと TLS 自体を目で見たいときだけ使う。

```bash
echo '127.0.0.1 live.kosensai.ichinoseki.ac.jp' | sudo tee -a /etc/hosts
# → https://live.kosensai.ichinoseki.ac.jp:8443/ （証明書警告は「詳細」→「アクセスする」）

# 終わったら必ず消す
sudo sed -i '' '/live\.kosensai\.ichinoseki\.ac\.jp/d' /etc/hosts
```

</details>

## テストパターン

全チャンネルで映像はカラーバー（`smptebars`）、音声は 1kHz の基準音（-18dBFS）に
揃えてある。チャンネルの識別は、映像へ焼き込んだ `CH1`〜`CH4` の文字で行う。
下段の経過時刻は遅延の目視に使う。

送出の内容は [publish.sh](publish.sh) にある。

以前はチャンネルごとに生成パターンと音程を変えて見分けていたが、これはイメージに
フォントが無く `drawtext` を使えなかったことへの回避策であり、実機から届く信号とも
異なっていた。`publisher.Dockerfile` でフォントを追加して解消してある。

音声は全チャンネルで同一であるため、音だけで切替を判別することはできない。判別は
画面の文字で行う。

## 何を確認できるか / できないか

### 確認できる

- 視聴ページの Ch タブ切替、`?ch=` 直接開き、前回選択の復元
- **配信開始前の挙動**（`--idle` で起動 → 「まだ配信が始まっていないようです」→
  publisher を上げると**リロードなしで**再生が始まる）
- 切断からの自動復帰（`docker compose stop pub-ch1` → 再度 `start`）
- サイネージページの全画面表示と待機画面
- 公式サイトの iframe が実際にどう見えるか（狭い枠での崩れ具合）
- 本番の Caddyfile が正しく動くこと。`/hls` の Location 書き戻しが欠けると
  映像が始まらないため、再生できた時点でこれも確かめられている
- MediaMTX が N セッションを捌けるか、1 人あたり何 Mbps 流れるか

### 確認できない

- **当日の律速は Wi-Fi の AP エアタイム。** 同一ホスト内のループバックでは
  再現できない。`load-test.sh` の合計 Mbps を「学内で出る帯域」と読まないこと。
- **OBS の 4Ch 同時エンコード負荷。** ここでは ffmpeg が代役をしているだけ。
- SRT のパケットロス・再送の挙動（ロスがまず起きない経路なので）
- 実機ブラウザの差異（Safari iOS のネイティブ HLS 経路、サイネージ RPi の Chromium）

`load-test.sh` の「1 人あたり Mbps」が設定ビットレートより低く出るのは正常。
`testsrc` は圧縮が効きすぎて CBR 指定値まで使い切らないため。実カメラの映像なら
設定値に近づく。

## ファイル

| ファイル | 内容 |
| --- | --- |
| `docker-compose.yml` | MediaMTX + Caddy + プレビュー入口 + テストパターン送出 4 本 |
| `publisher.Dockerfile` | テストパターン送出用の ffmpeg。フォントを追加して `drawtext` を使えるようにする |
| `publish.sh` | 1 チャンネル分の送出。カラーバー・基準音・チャンネル名・経過時刻を組み立てる |
| `preview.Caddyfile` | `localhost:8080` 用の入口。Host を付け替えて本番 Caddy に渡す |
| `scripts/up.sh` | 自己署名証明書の生成 → 起動 |
| `scripts/down.sh` | 停止（`--clean` で生成物も削除） |
| `scripts/reload.sh` | `app/` をビルドして反映。ビルドのたびに `web/` が作り直されて bind mount が切れるので、caddy を張り直す |
| `scripts/load-test.sh` | 視聴クライアントを N 本立てて負荷をかける |
| `client/pull.sh` | 視聴クライアントの実体。hls.js と同じ手順を curl で再現 |
| `certs/` | `up.sh` が生成する自己署名証明書（git 管理外） |
| `out/` | 負荷テストの結果（git 管理外） |

## 本番との差分

| | リハーサル | 本番 |
| --- | --- | --- |
| 証明書 | 自己署名（`up.sh` が生成） | certbot の DNS-01 |
| ポート | 8443（+ プレビュー 8080） | 443 |
| プレビュー入口 | あり（`/etc/hosts` 回避用） | 無し |
| ネットワーク | caddy と publisher が mediamtx の netns に相乗り | 全部 `network_mode: host` |
| 映像ソース | ffmpeg の testsrc × 4 | 現場 ATEM / iPhone → 本部 OBS |
| パスフレーズ | compose に直書きの使い捨て値 | `hosts/server/.env` |
| `mediamtx.yml` | **同じもの**（マウント） | — |
| `Caddyfile` | **同じもの**（マウント） | — |
| `web/` | **同じもの**（マウント） | — |

ネットワーク形態が違うのは、macOS の Docker Desktop で `network_mode: host` が
素直に使えないため。caddy を mediamtx のネットワーク名前空間に相乗りさせることで、
caddy から `127.0.0.1:8888` で MediaMTX に届く状態を作り、本番の Caddyfile を
そのまま使えるようにしている。
