# kosensai-broadcast

高専祭ライブ配信 — 映像研側担当のソフトウェア一式。

一関高専 映像研究会 × 電算部。責務分担のうち **調達マシン上のソフトウェア構築**
（MediaMTX / Caddy / OBS 環境 / 配信サイト / サイネージ）をこのリポジトリで管理する。
ハードウェア調達・拠点間接続・DNS・イントラ SSID は NW 班側。

- 視聴ページ: `https://live.kosensai.ichinoseki.ac.jp/`
- サイネージ: `https://live.kosensai.ichinoseki.ac.jp/signage/`
- HLS: `https://live.kosensai.ichinoseki.ac.jp/hls/<ch>/index.m3u8`

---

## 1. 構成

```
現場 (ATEM Mini Pro / iPhone+Moblin)      ← hosts/field/
   │  SRT Caller → :9001-9003
   ▼
本部メイン PC (OBS)                        ← hosts/obs/
   │  Ch1〜3 受信・Ch4 合成・4系統エンコード
   │  SRT Caller → :8890 (streamid=publish:chN)
   ▼
配信サーバー (Proxmox VM / MediaMTX + Caddy) ← hosts/server/
   │  HLS 127.0.0.1:8888 → Caddy :443
   ├───────────────► 来場者スマホ           ← web/index.html
   └───────────────► 校内サイネージ (RPi)   ← hosts/signage/ + web/signage/
```

| Ch | ソース | 用途 |
| --- | --- | --- |
| ch1 | 第一体育館 ATEM Mini Pro | メインステージ |
| ch2 | 第二体育館 ATEM Mini Pro | サブステージ（**開催有無 未確定**） |
| ch3 | 屋外遊撃 iPhone 15 Pro + Moblin | 屋台エリア・校内の様子 |
| ch4 | 本部 OBS 合成 | サイネージ用（ダイジェスト・CM・タイムテーブル） |

伝送は全区間 SRT に統一（MediaMTX が RIST 非対応のため）。
MediaMTX はトランスコード／ABR を行わないので、**エンコーダ側のビットレート ×
同時視聴者数がそのまま下り帯域**になる。

---

## 2. ディレクトリ構成

**マシン 1 台 = `hosts/` 下の 1 ディレクトリ。** どのファイルがどのマシンに
乗るのかを、ディレクトリだけで判断できるようにしてある。

```
kosensai-broadcast/
├─ hosts/                     ★ マシンごと。ここがデプロイ単位
│  ├─ server/                 配信サーバー (Proxmox VM: MediaMTX + Caddy)
│  │  ├─ docker-compose.yml / mediamtx.yml / Caddyfile / .env.example
│  │  ├─ certs/               証明書置き場（git 管理外）
│  │  └─ scripts/             preflight / get-cert / smoke-test
│  ├─ obs/                    本部メイン PC
│  │  ├─ README.md            OBS の入力・出力・エンコード・録画
│  │  └─ srt-urls.sh          OBS に入れる SRT URL を生成（手打ち禁止）
│  ├─ signage/                校内サイネージ端末 (Raspberry Pi)
│  │  ├─ setup.sh / signage.service
│  │  └─ README.md
│  └─ field/                  現場（ATEM / iPhone）— 機材設定のドキュメントのみ
│     ├─ README.md            Ch1/Ch2 ATEM・PTZ・音声取り込み
│     └─ moblin.md            Ch3 遊撃 iPhone
├─ web/                       配信サイト（HP 部門と共同。server が配信する）
│  ├─ index.html / signage/index.html
│  ├─ config.json           ★ チャンネル定義の単一の情報源
│  ├─ assets/                 theme.css(暫定) / viewer.css / signage.css / player.js
│  └─ vendor/hls.min.js
└─ docs/
   └─ checklist.md            本番前チェックリスト
```

各ディレクトリの README がそのマシンの手順書。まずそこを読む。

| 担当するもの | 読むファイル |
| --- | --- |
| 配信サーバーを立てる | [hosts/server/README.md](hosts/server/README.md) |
| 本部 OBS を組む | [hosts/obs/README.md](hosts/obs/README.md) |
| サイネージ端末を置く | [hosts/signage/README.md](hosts/signage/README.md) |
| 現場の機材を組む | [hosts/field/README.md](hosts/field/README.md) |
| 配信サイトを触る | [web/README.md](web/README.md) |
| 本番前の確認 | [docs/checklist.md](docs/checklist.md) |

### なぜモノレポか（submodule を使わない理由）

マシンごとにリポジトリを分ける案・submodule 案も検討したが、**モノレポを採用**した。

- **設定が複数マシンに跨って整合している必要がある。** SRT のパスフレーズ、
  チャンネル名、ポート番号は「配信サーバー・本部 OBS・現場」の 3 箇所で
  一致していないと映像が出ない。リポジトリを分けると、この整合を人間が
  目視で保つことになる。同一リポジトリなら `config.json` を単一の情報源にして、
  OBS 用 URL の生成（`srt-urls.sh`）と起動前チェック（`preflight.sh`）で
  機械的に突き合わせられる。実際 preflight は `mediamtx.yml` と
  `config.json` のずれを検出する。
- **submodule はポインタ更新の一手間が増える。** 実運用が 3 日、作業者 4 人、
  現地でその場で直す場面がある構成で、`git submodule update` の
  し忘れによる「古い設定で動いていた」は最も避けたい事故。
- **リポジトリが小さい。** 全部で数十ファイル。分割の利点（ビルド分離・権限分離）が
  効く規模ではない。
- **どのマシンにも `git clone` 1 回で全部入る。** 予備機へのコールドスタンバイ
  （`docs/checklist.md §H`）もディレクトリごとコピーするだけで済む。

将来 HP 部門と `web/` を本格的に共同編集する事態になれば、そこだけ切り出して
submodule 化する余地はある。現時点では上記の理由で単一リポジトリが優る。

---

## 3. はじめかた

```bash
git clone <このリポジトリ>
cd kosensai-broadcast

# 配信サーバーを立てる場合
cd hosts/server
cp .env.example .env && $EDITOR .env    # パスフレーズ 4 本
sudo ./scripts/get-cert.sh              # 証明書（前日までに）
./scripts/preflight.sh                  # 起動前チェック
docker compose up -d
./scripts/smoke-test.sh ch1             # 疎通確認
```

配信サイトの見た目だけ確認したい場合はサーバー不要:

```bash
python3 -m http.server 8080 --directory web
```

---

## 4. 仮値・未確定のまま残っている箇所

NW 班から構成が共有され次第、置換する。一覧と手順は
[docs/checklist.md §A](docs/checklist.md)。

| 項目 | 現状 |
| --- | --- |
| MediaMTX / Caddy マシンの IP | 未定（OBS と同一ホスト前提で `127.0.0.1`） |
| OBS マシンの IP | 未定（`srt-urls.sh` の `OBS_HOST` で指定する） |
| ビットレート | 4.5Mbps 前提。LAG が使えない場合は 3Mbps に落とす |
| TLS 終端 | Caddy 終端で確定見込み（2026/07/20 時点）。変わる場合は `Caddyfile` を見直す |
| Ch2 の有無 | 第二体育館の開催が未確定。無くなれば `config.json` と `mediamtx.yml` から削除 |
| 配信サイトの見た目 | `web/assets/theme.css` は**暫定値**。HP 部門とすり合わせて確定させる |

---

## 5. 検証済みの挙動

MediaMTX v1.19.3 + Caddy 2.11.4 + 本リポジトリの設定一式を実際に起動し、
ffmpeg のテストパターンを SRT で流して確認した内容。

- **SRT publish → HLS 再生まで疎通。** `streamid=publish:ch1` で送出し、
  Caddy 経由の `/hls/ch1/index.m3u8` からマスタープレイリスト →
  variant → 6 秒 MPEG-TS セグメント（`video/mp2t`）まで取得できた。
- **パスフレーズ不一致は拒否される。** `closed: invalid passphrase`。
- **`ch1`〜`ch4` 以外への publish は拒否される。** `path 'ch9' is not configured`。
  `all_others` を定義していないため。
- **publish が無い間 `/hls/chN/index.m3u8` は 404。**
  → 視聴ページはこれを「配信開始前」と解釈して 10 秒ごとにリトライする。
- **静的配信・ヘッダーは想定通り。** `/`・`/signage/`・`/config.json`・
  `/assets/*`・`/vendor/hls.min.js`・`/healthz` がすべて 200。
  vendor は `max-age=604800, immutable`、HTML は `no-cache`。

### ⚠️ この検証で見つかって直したもの

MediaMTX は最初のプレイリスト要求を、セッション Cookie を張るために
`Location: /ch1/index.m3u8?cookieCheck=1` へ 302 する。
Caddy 側は `handle_path /hls/*` で `/hls` を剥がしているため、この Location を
そのまま返すとクライアントは **`/hls` 抜きの URL** を叩き、静的ファイル配信側に
落ちて 404 になる。＝ **視聴ページで映像が永久に始まらない。**

`Caddyfile` の `reverse_proxy` に以下を入れて解決済み。

```
header_down Location "^/(.*)$" "/hls/$1"
```

同じ理由で、`curl` で HLS を叩くときは `-L` と Cookie jar が要る
（`smoke-test.sh` は対応済み）。

### まだ未検証（実機・現地でしか確認できない）

`docs/checklist.md` 参照。特に以下は当日まで残せない。

- 実ブラウザ 3 環境（Chrome Android / Safari iOS / Chromium RPi）での再生
- OBS 1 台での 4Ch 同時エンコード負荷
- 公式サイトに `X-Frame-Options` が付いていないか（iframe 合成の成立条件）

---

## 6. 関連ドキュメント（Notion）

- 高専祭ライブ配信（プロジェクト）
- 配信システム構成
- インフラ・ネットワーク連携要件
- ソフトウェア構成・設定例
- 映像機材・調達リスト
