# kosensai-broadcast

高専祭ライブ配信 — 映像研側担当のソフトウェア一式。

一関高専 映像研究部 × 電算部。責務分担のうち **調達マシン上のソフトウェア構築**
（MediaMTX / Caddy / OBS 環境 / 配信サイト / サイネージ）をこのリポジトリで管理する。
ハードウェア調達・拠点間接続・DNS・イントラ SSID は NW 班側。

- 視聴ページ: `https://live.kosensai.ichinoseki.ac.jp/`
- サイネージ: `https://live.kosensai.ichinoseki.ac.jp/signage/`
- HLS: `https://live.kosensai.ichinoseki.ac.jp/hls/<ch>/index.m3u8`

---

## 1. 構成

```
現場 (ATEM Mini Pro / iPhone+Moblin)      ← 機材設定は Notion
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
├─ config.json                ★ Ch 定義と公式サイト URL の単一の情報源
│                               app/ ・srt-urls.sh・preflight.sh が同じものを読む
├─ hosts/                     ★ マシンごと。ここがデプロイ単位
│  ├─ server/                 配信サーバー (Proxmox VM: MediaMTX + Caddy)
│  │  ├─ docker-compose.yml / mediamtx.yml / Caddyfile / .env.example
│  │  ├─ certs/               証明書置き場（git 管理外）
│  │  └─ scripts/             preflight / get-cert / smoke-test
│  ├─ obs/                    本部メイン PC
│  │  ├─ README.md            OBS の入力・出力・エンコード・録画
│  │  └─ srt-urls.sh          OBS に入れる SRT URL を生成（手打ち禁止）
│  └─ signage/                校内サイネージ端末 (Raspberry Pi)
│     ├─ setup.sh / signage.service
│     └─ README.md
├─ app/                       配信サイトのソース (SvelteKit + TypeScript)
│  ├─ src/routes/             視聴ページ (/) とサイネージページ (/signage/)
│  ├─ src/lib/                プレイヤーの状態機械・ワードマーク・設定の読み込み
│  └─ static/                 QR とライセンス全文。そのまま配信物へ入る
├─ web/                       app/ のビルド成果物。Caddy がこれを配信する
│                               pnpm build のたびに作り直されるので直接編集しない
├─ rehearsal/                 ★ ローカルリハーサル環境（PC 1台で全部立ち上がる）
│  ├─ docker-compose.yml      本番の設定をマウントして使う + テストパターン4本
│  ├─ scripts/                up / down / reload / load-test
│  └─ client/pull.sh          視聴クライアントのシミュレータ
├─ tools/make-qr.py           視聴ページの QR を生成する（URL 変更時のみ実行）
├─ LICENSE                    MIT
└─ THIRD-PARTY.md             同梱している第三者ソフトウェアの内訳
```

各ディレクトリの README がそのマシンの手順書。まずそこを読む。

| 担当するもの | 読むファイル |
| --- | --- |
| 配信サーバーを立てる | [hosts/server/README.md](hosts/server/README.md) |
| 本部 OBS を組む | [hosts/obs/README.md](hosts/obs/README.md) |
| サイネージ端末を置く | [hosts/signage/README.md](hosts/signage/README.md) |
| 手元で動かして確認する | [rehearsal/README.md](rehearsal/README.md) |

テストの進め方・本番前チェックリスト・設計上の決定と計測結果は Notion にある（§6）。

---

## 3. はじめかた

配信サイトを触る場合は、手元でリハーサル環境を立ち上げるのが早い。テストパターン
4 本から視聴ページまでが PC 1 台で揃う。

```bash
cd rehearsal
./scripts/up.sh          # 起動（http://localhost:8080/）
./scripts/reload.sh      # app/ をビルドして反映
./scripts/down.sh        # 停止
```

配信サイトのソースは `app/`（SvelteKit）にある。`pnpm build` の出力先が `web/` で、
Caddy はそこを配信する。`web/` を直接編集しても次のビルドで消える。

```bash
cd app
pnpm install
pnpm lint        # Prettier の確認と svelte-check
```

配信サーバーを立てる手順は [hosts/server/README.md](hosts/server/README.md) にある。

---

## 4. 仮値・未確定のまま残っている箇所

NW 班から構成が共有され次第、置換する。待っている情報の一覧は Notion の
「本番前チェックリスト」にある（§6）。

| 項目 | 現状 |
| --- | --- |
| MediaMTX / Caddy マシンの IP | 未定（OBS と同一ホスト前提で `127.0.0.1`） |
| OBS マシンの IP | 未定（`srt-urls.sh` の `OBS_HOST` で指定する） |
| ビットレート | 4.5Mbps 前提。LAG が使えない場合は 3Mbps に落とす |
| TLS 終端 | Caddy 終端で確定見込み（2026/07/20 時点）。変わる場合は `Caddyfile` を見直す |
| Ch2 の有無 | 第二体育館の開催が未確定。無くなれば `config.json` と `mediamtx.yml` から削除 |

---

## 5. 検証済みの挙動

MediaMTX v1.19.3 + Caddy 2.11.4 + 本リポジトリの設定一式を実際に起動し、
ffmpeg のテストパターンを SRT で流して確認した内容。

- **SRT publish → HLS 再生まで疎通。** `streamid=publish:ch1` で送出し、
  Caddy 経由の `/hls/ch1/index.m3u8` からマスタープレイリスト →
  variant → 2 秒 MPEG-TS セグメント（`video/mp2t`）まで取得できた。
- **パスフレーズ不一致は拒否される。** `closed: invalid passphrase`。
- **`ch1`〜`ch4` 以外への publish は拒否される。** `path 'ch9' is not configured`。
  `all_others` を定義していないため。
- **publish が無い間 `/hls/chN/index.m3u8` は 404。**
  → 視聴ページはこれを「配信開始前」と解釈して 5 秒ごとにリトライする。
- **静的配信・ヘッダーは想定通り。** `/`・`/signage/`・`/healthz` がすべて 200。
  `/_app/immutable/*`（SvelteKit のビルド成果物。hls.js を含む）は
  `max-age=604800, immutable`、HTML は `no-cache`。
- **シークできる幅は 360 秒で一定。** サーバーの `hlsSegmentCount: 180` ×
  セグメント 2 秒と、hls.js の `backBufferLength` を揃えてある。

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

網羅した一覧は Notion の「本番前チェックリスト」にある。特に以下は当日まで残せない。

- 実ブラウザ 3 環境（Chrome Android / Safari iOS / Chromium RPi）での再生
- OBS 1 台での 4Ch 同時エンコード負荷
- 公式サイトに `X-Frame-Options` が付いていないか（iframe 合成の成立条件）

---

## 6. 関連ドキュメント（Notion）

進行状況・段取り・チェックリストは Notion で管理している。このリポジトリには仕様と
手順書だけを置く。以下は一関高専 映像研究部の部内向け資料であり、部外からは開けない。

- 高専祭ライブ配信（プロジェクト）
- 配信システム構成
- インフラ・ネットワーク連携要件
- ソフトウェア構成・設定例
- 映像機材・調達リスト
- 本番前チェックリスト
- テスト手順
