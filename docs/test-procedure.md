# テスト手順

**下の段から順に積む。** 段階1が通らないうちに段階3をやらない。
複数の未検証要素が同時に入ると、映らなかったときの切り分けができなくなる。

| 段階 | 何を試すか | 必要なもの | 今できるか |
| --- | --- | --- | --- |
| 1 | 配信ソフトと視聴ページ | PC 1 台だけ | **できる** |
| 2 | 実サーバー | NW 班のマシン・IP・DNS | 待ち |
| 3 | 実機材（OBS・ATEM・iPhone） | 機材の調達 | 一部できる |
| 4 | 実環境（学内 Wi-Fi・実ブラウザ・サイネージ端末） | 学内 NW | 待ち |
| 5 | 通し（全系統同時） | 全部 | 待ち |

網羅性の確認は [checklist.md](checklist.md) を見る。こちらは**順番**の話。

---

## 段階 1: 手元（PC 1 台・何も待たない）

`rehearsal/` を使う。本番と同じ `mediamtx.yml` / `Caddyfile` / `web/` を
マウントして動かすので、ここで通れば設定ファイル自体は正しい。

### 1-1. 起動と疎通

```bash
cd rehearsal
./scripts/up.sh
./scripts/check.sh
```

**合格条件:** `check.sh` が全て OK で終わる。

内訳は静的配信 9 項目・HLS 4Ch・本番設定の効き具合 2 項目。
特に後者の 2 つは壊れると当日詰むので毎回見る。

| 検証 | 壊れると何が起きるか |
| --- | --- |
| 302 Location に `/hls` が付いている | **映像が永久に始まらない**（静的配信側に落ちて 404） |
| MediaMTX の `Cache-Control` が素通し | Caddy が上書きしてキャッシュ制御が意図と変わる |

**落ちたとき:** `docker compose logs mediamtx`。publish 拒否ならパスフレーズ不一致が最有力。

### 1-2. 視聴ページの挙動（ブラウザ・手動）

**`http://localhost:8080/` を開く。** `/etc/hosts` の変更も証明書の警告も要らない
（Host ヘッダを付け替えるだけの入口を別に立ててある。`rehearsal/preview.Caddyfile`）。

| 確認項目 | 合格条件 |
| --- | --- |
| Ch タブ切替 | Ch1〜Ch4 が切り替わる。色と音程で判別（ch1 そのまま/A・ch2 緑/C・ch3 青/E・ch4 紫/G） |
| `?ch=ch3` | 直接その Ch が開く |
| 前回選択の復元 | タブを変えてリロードすると同じ Ch が開く |
| **配信前の表示** | `./scripts/up.sh --idle` で起動 → 「まだ配信が始まっていないようです」 |
| **自動再生開始** | 上の状態から `docker compose --profile publish up -d` → **リロードせずに**再生が始まる |
| **切断からの復帰** | `docker compose --profile publish stop pub-ch1` → 待機表示 → `start` で自動復帰 |
| 公式サイトの iframe | 右カラムに表示される。狭い枠での崩れ具合を目視 |
| モバイル表示 | 開発者ツールで幅 390px にして、タブが横スクロールで全部触れるか |

### 1-3. サイネージページ

`https://live.kosensai.ichinoseki.ac.jp:8443/signage/`

| 確認項目 | 合格条件 |
| --- | --- |
| 全画面レイアウト | 左に映像・右に公式サイト・右上に時計 |
| 待機画面 | 配信前は暗いまま「まもなく放送を開始します」（白く光らない） |
| 文字サイズ | 実際の設置解像度で開いて、離れて読めるか。狭ければ `web/assets/signage.css` の `--side` を調整 |

### 1-4. 負荷

```bash
./scripts/load-test.sh 20 ch1 30     # 20人 / ch1 / 30秒
./scripts/load-test.sh 10 all 60     # 10人ずつ全Ch同時
```

**合格条件:** エラー 0。セグメント数が視聴者数 × 5 前後あること。

**実測済み（2026-08-04）:** 40 セッション同時（10人 × 4Ch）でエラー 0、合計 59.4Mbps。

⚠️ **合計 Mbps を「学内で出る帯域」と読まない。** 当日の律速は Wi-Fi の AP
エアタイムで、同一ホスト内のループバックでは再現できない。ここで分かるのは
「MediaMTX が N セッションを捌けるか」までで、帯域の可否は段階 4 で見る。

1 人あたりが設定ビットレートより低く出るのは正常（`testsrc` は圧縮が効きすぎる）。

### 1-5. 片付け

```bash
./scripts/down.sh
```

---

## 段階 2: 実サーバー（NW 班のマシンが来たら）

[hosts/server/README.md](../hosts/server/README.md) の手順で構築してから。

### 2-1. 起動前チェック

```bash
cd hosts/server
./scripts/preflight.sh
```

**合格条件:** NG が 0。WARN は内容を見て判断する。

見ているもの: 設定ファイルの存在、パスフレーズ（未設定・サンプル値のまま・
長さ・Ch 間の使い回し）、証明書の有効期限、`net.core.rmem_max`、
**`mediamtx.yml` と `web/config.json` の Ch 定義のずれ**。

### 2-2. 起動と疎通

```bash
docker compose up -d
./scripts/smoke-test.sh ch1
./scripts/smoke-test.sh ch2
./scripts/smoke-test.sh ch3
./scripts/smoke-test.sh ch4
```

**合格条件:** 各 Ch で MediaMTX 直・Caddy 経由の両方が 200。

### 2-3. 名前解決と証明書

```bash
dig live.kosensai.ichinoseki.ac.jp +short      # 10.x.x.x が返る
curl -I https://live.kosensai.ichinoseki.ac.jp/healthz   # 証明書エラーなし
```

**合格条件:** ブラウザで警告なくページが開く。

段階 1 と違い、ここは `/etc/hosts` も `-k` も使わない。使ったら意味がない。

---

## 段階 3: 実機材

機材が揃ったものから個別に。**まとめて繋がない。**

### 3-1. OBS の SRT 入力（1 Ch ずつ）

[hosts/obs/README.md](../hosts/obs/README.md) の設定。URL は手打ちせず生成する。

```bash
MTX_HOST=<実IP> OBS_HOST=<実IP> ./hosts/obs/srt-urls.sh
```

**合格条件:** ffmpeg のテストパターンを Caller で送って OBS に映る。

```bash
ffmpeg -re -f lavfi -i testsrc=size=1280x720:rate=30 \
  -c:v libx264 -preset veryfast -tune zerolatency -b:v 2500k -f mpegts \
  "srt://<OBSマシンのIP>:9001?passphrase=<ch1用>&latency=200000"
```

### 3-2. OBS の 4Ch 同時送出と GPU 負荷

**合格条件:** 4 本同時に送出して、OBS の統計でフレームドロップが出ないこと。
GPU 使用率を実測して記録する。

⚠️ ここが本番のボトルネック候補。**リハーサルで必ず実測する。**
GPU 律速ならビットレートを 3Mbps に落とすプロファイルへ切り替える。

### 3-3. ATEM → OBS

**合格条件:** ATEM の SRT 送出が OBS に届き、ケーブルを抜き差ししても自動復帰する。

事前に ATEM Software Control でファームウェアを最新にしておく（SRT は 9.5〜9.6 以降）。

### 3-4. Moblin → OBS

[hosts/field/moblin.md](../hosts/field/moblin.md)

**合格条件:** **充電しながら 1 時間 SRT 配信して、音切れも発熱による停止も起きない。**

これは機材を買った直後にやる。当日まで残さない。

### 3-5. 録画

**合格条件:** Source Record × 3 + メイン録画を同時に回して、保存先の空き容量が足りる。

---

## 段階 4: 実環境（学内 Wi-Fi）

NW 班と合同。段階 2・3 が通ってから。

| 確認項目 | 方法 | 合格条件 |
| --- | --- | --- |
| 3 ブラウザ再生 | Chrome(Android) / Safari(iOS) / Chromium(RPi) | 全部で再生できる |
| Chrome LNA | Android 実機で公式サイト → 視聴ページへ遷移 | 許可プロンプトが出ない |
| iCloud プライベートリレー | iPhone で ON のまま視聴ページ | ドメインブロック後に正常表示 |
| DNS リバインド | 学内 Wi-Fi から `dig live...` | `10.x.x.x` が返る |
| キャプティブポータル | QR から視聴ページへ直行 | ポータル画面に食われない |
| AP ローミング | Moblin で校内を歩く | 切断時間を計測。長ければ latency を 800ms へ |
| **帯域** | 複数端末で同時視聴 | 実機で何人まで耐えるか。ここで初めて分かる |

`X-Frame-Options` の有無は 2026-08-04 に確認済みだが、公式サイトが本番版に
差し替わったら**もう一度見る**（付いていたら iframe を諦めてリンクに切り替え）。

```bash
curl -sI https://kosensai.ichinoseki.ac.jp/ | grep -iE 'x-frame|frame-ancestors'
```

---

## 段階 5: 通し

全系統を同時に動かす。**本番と同じ構成・同じ人数で。**

現場 ATEM → 本部 OBS → MediaMTX → 視聴ページ / サイネージ、を最低 1 時間。

| 確認項目 | 合格条件 |
| --- | --- |
| 全 Ch 同時配信 | 4Ch が同時に視聴ページで見られる |
| PTZ ハンドオフ | 本部 ↔ 現場でインカム越しに操作を受け渡せる |
| 音声 | PA 卓 → ミキサー → ATEM の系統でノイズが乗らない |
| 遅延 | 現場の実物と視聴ページの映像のズレを実測 |
| 復旧手順 | わざと 1 系統落として、復旧までの手順と時間を確認 |
| 予備機 | コールドスタンバイ機で `docker compose up -d` が通る |

ここで出た問題の対処法を、当日そのまま使えるようメモに残す。

---

## 段階ごとに何が分かるか

| | 設定ファイル | 視聴ページ | サーバー | 機材 | 帯域 | 運用 |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| 段階 1 | ✓ | ✓ | | | | |
| 段階 2 | ✓ | ✓ | ✓ | | | |
| 段階 3 | | | | ✓ | | |
| 段階 4 | | ✓ | | | ✓ | |
| 段階 5 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

段階 1 は自動化してあるので、`web/` や `hosts/server/` を触ったら毎回流す。
回帰チェックとして使える。
