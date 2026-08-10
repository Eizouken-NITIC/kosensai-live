# kosensai-broadcast

高専祭ライブ配信の配信基盤と配信サイト。SRT で受け取った映像を HLS へ変換して配信し、
視聴ページとサイネージページを同じサーバーから静的配信する。

- 視聴ページ: `https://<domain>/`
- サイネージ: `https://<domain>/signage/`
- HLS: `https://<domain>/hls/<ch>/index.m3u8`

`<domain>` はリポジトリ直下の `config.json` で決まる。

---

## 1. 構成

```
現場のカメラ・スイッチャー
   │  SRT Caller
   ▼
本部の PC (OBS)                             ← hosts/obs/
   │  Ch ごとにエンコードし、SRT Caller で送出
   │  streamid=publish:chN
   ▼
配信サーバー (MediaMTX + Caddy)             ← hosts/server/
   │  SRT 受信 → HLS 生成 → Caddy が TLS 終端して配信
   ├───────────────► 視聴者のブラウザ        ← app/ のビルド成果物
   └───────────────► サイネージ端末          ← hosts/signage/
```

伝送は全区間で SRT に統一している。MediaMTX が RIST に対応しないため。

MediaMTX はトランスコードも ABR も行わない。**エンコーダ側のビットレート × 同時視聴者数
がそのまま下り帯域になる。**

## 2. ディレクトリ構成

**マシン 1 台 = `hosts/` 下の 1 ディレクトリ。** どのファイルがどのマシンに乗るのかを、
ディレクトリだけで判断できるようにしてある。

```
kosensai-broadcast/
├─ config.json                ★ 複数のマシンに跨って一致が必要な値の唯一の情報源
├─ hosts/                     ★ マシンごと。ここがデプロイ単位
│  ├─ server/                 配信サーバー（MediaMTX + Caddy）
│  │  ├─ compose.yml / mediamtx.yml / Caddyfile / .env.example
│  │  ├─ certs/               証明書置き場（git 管理外）
│  │  └─ scripts/             preflight / get-cert / smoke-test
│  ├─ obs/                    本部の PC
│  │  └─ srt-urls.sh          OBS に入れる SRT URL を生成する
│  └─ signage/                サイネージ端末（Raspberry Pi + Chromium Kiosk）
│     └─ setup.sh / signage.service
├─ app/                       配信サイトのソース（SvelteKit + TypeScript）
│  ├─ src/routes/             視聴ページ (/) とサイネージページ (/signage/)
│  ├─ src/lib/                プレイヤーの状態機械・ロゴ・設定の読み込み
│  ├─ src/styles/             CSS。コンポーネントに <style> は置かない
│  └─ static/                 QR・ロゴ・ライセンス全文。そのまま配信物へ入る
├─ web/                       app/ のビルド成果物。Caddy がこれを配信する
│                               pnpm build のたびに作り直されるので直接編集しない
├─ rehearsal/                 ★ ローカル検証環境（PC 1 台で全部立ち上がる）
├─ tools/make-qr.py           視聴ページの QR を生成する（domain 変更時のみ実行）
├─ LICENSE                    MIT
└─ THIRD-PARTY.md             同梱している第三者ソフトウェアの内訳
```

各ディレクトリの README がそのマシンの手順書になっている。

| 触るもの | 読むファイル |
| --- | --- |
| 配信サーバー | [hosts/server/README.md](hosts/server/README.md) |
| 本部の OBS | [hosts/obs/README.md](hosts/obs/README.md) |
| サイネージ端末 | [hosts/signage/README.md](hosts/signage/README.md) |
| 手元で動かす | [rehearsal/README.md](rehearsal/README.md) |

## 3. はじめかた

配信サイトを触る場合は、手元で検証環境を立ち上げるのが早い。テストパターン 4 本から
視聴ページまでが PC 1 台で揃う。

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
pnpm build
```

## 4. 設定

複数のマシンに跨って一致している必要がある値は、すべてリポジトリ直下の `config.json`
にある。

| キー | 内容 |
| --- | --- |
| `site` | 配信サイトの名前とホスト名 |
| `channels` | Ch の id・表示名・OBS の待受ポート・SRT の latency・ビットレート |
| `externalSite` | 視聴ページとサイネージが iframe で埋め込む外部サイトの表示名と URL |
| `signage` | サイネージページの既定チャンネルと、QR の脇に出す文言 |

`app/` はビルド時に import し、`hosts/` のスクリプトと `tools/make-qr.py` は実行時に
読む。**`Caddyfile` だけは Caddy の設定であり JSON を読めないためホスト名を直接持って
いる。** ずれると証明書と site が一致せずページが出ないので、`preflight.sh` が
`config.json` と突き合わせる。

## 5. ドキュメント

設計上の決定と計測結果、検証の手順、本番前のチェックリストは Notion にある。部内向けの
資料であり、部外からは開けない。

- 高専祭ライブ配信（プロジェクト）
- 配信システム構成
- インフラ・ネットワーク連携要件
- ソフトウェア構成・設定例
- 映像機材・調達リスト
- 設計上の決定と計測
- テスト手順
- 本番前チェックリスト
