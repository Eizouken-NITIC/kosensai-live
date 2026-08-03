# 本番前チェックリスト

Notion「ソフトウェア構成・設定例 §5」「インフラ・ネットワーク連携要件 §本番前の要検証」を
このリポジトリの実作業に落としたもの。**チェックを付けたらこのファイルをコミットする。**

---

## A. NW 班からの情報待ち（これが揃わないと仮値のまま）

- [ ] MediaMTX / Caddy マシンの IP
- [ ] OBS マシンの IP（現場 ATEM・Moblin の Caller 宛先になる）
- [ ] `live.kosensai.ichinoseki.ac.jp` の A レコード登録完了
- [ ] LAG（実効 2Gbps）が使えるか＝ビットレート 4.5M / 3M どちらで行くか
- [ ] 遊撃中継用イントラ SSID の SSID / パスフレーズ / 802.11r 対応可否
- [ ] TLS 終端が最終的にどちらの担当になったか（Caddy 終端で確定か）
  → 変わる場合は `Caddyfile` の `tls` 行と `:80` ブロックを見直す

情報が来たら反映する箇所:

| 箇所 | 内容 |
| --- | --- |
| `hosts/hq-obs/srt-urls.sh` の環境変数 | `MTX_HOST` / `OBS_HOST` を実 IP にして実行 |
| `hosts/stream-server/scripts/smoke-test.sh` | 別ホスト構成なら `SRT_HOST=` を指定 |
| `hosts/stream-server/Caddyfile` | ドメイン名（既に確定値）。TLS 終端が変わる場合のみ要修正 |
| `web/channels.json` | Ch2 が無くなる場合は 1 要素削除（`mediamtx.yml` も同時に） |

---

## B. サーバー構築

- [ ] Proxmox に LXC(Ubuntu 22.04, nesting=1) または VM を作成（CPU 2 コア+ / RAM 2GB+ / Disk 20GB）
- [ ] Docker + docker compose plugin をインストール
- [ ] `sysctl -w net.core.rmem_max=26214400` を設定し `/etc/sysctl.d/` にも永続化
- [ ] `git clone` → `cp .env.example .env` → パスフレーズを 4 本生成して記入
      （`openssl rand -base64 24`）
- [ ] `sudo hosts/stream-server/scripts/get-cert.sh` で証明書取得（TXT レコード登録依頼を含むので**前日までに**）
- [ ] `hosts/stream-server/scripts/preflight.sh` が全部 OK
- [ ] `docker compose up -d` → `docker compose ps` で両コンテナ Up

## C. ソフト面の疎通

- [ ] `hosts/stream-server/scripts/smoke-test.sh ch1` が MediaMTX 直 / Caddy 経由の両方 OK
- [ ] ch2 / ch3 / ch4 も同様に通る
- [ ] `https://live.kosensai.ichinoseki.ac.jp/hls/ch1/index.m3u8` がブラウザで落ちてくる
- [ ] 視聴ページ `https://live.kosensai.ichinoseki.ac.jp/` が証明書エラーなく開く
- [ ] タブ切替で Ch1〜Ch4 が切り替わる
- [ ] `?ch=ch3` で直接その Ch が開く
- [ ] 配信していない Ch を開くと「まだ配信が始まっていないようです」が出て、
      配信を開始すると**自動で**再生が始まる（リロード不要）

## D. OBS / 現場（hosts/hq-obs/README.md）

- [ ] obs-multi-rtmp / Source Record プラグイン導入済み
- [ ] Ch1〜Ch3 の SRT Listener で受信できる
- [ ] Ch1〜Ch4 の 4 系統同時 SRT 送出が安定する（**GPU 使用率・フレームドロップを実測**）
- [ ] ATEM Mini Pro のファームウェアが SRT 対応版（9.5〜9.6 以降）であることを実機確認
- [ ] 現場 ATEM → 本部 OBS の接続をリハーサルで確認（パケロス率・切断からの再接続挙動）
- [ ] 録画（Source Record × 3 + メイン録画）を回して保存先の空き容量を確認

## E. Moblin / 遊撃（hosts/field/moblin.md）

- [ ] Nextorage ハブ調達
- [ ] **Moblin + DJI Mic + ハブで「充電しながら 1 時間 SRT 配信」テスト**（音切れ・発熱）
- [ ] 校内を実際に歩いて AP ローミング時の切断時間を計測
- [ ] 切断からの復帰が自動で行われることを確認

## F. サイネージ（hosts/signage/README.md）

- [ ] `/signage/` が Kiosk で全画面表示される
- [ ] 電源断 → 再投入で自動復帰する
- [ ] Chromium（サイネージ RPi）で hls.js 再生 OK

## G. ブラウザ・ネットワーク検証（NW 班と合同）

- [ ] hls.js の再生確認 3 環境: **Chrome(Android) / Safari(iOS) / Chromium(RPi)**
- [ ] Chrome 142+ 実機（Android）で public→private のトップレベル遷移が無警告で通る
- [ ] `kosensai.ichinoseki.ac.jp` のレスポンスヘッダに `X-Frame-Options` /
      `CSP frame-ancestors` が**無い**ことを確認（iframe 合成の成立条件）
      → `curl -sI https://kosensai.ichinoseki.ac.jp/ | grep -iE 'x-frame|frame-ancestors'`
      → もし付いていたら iframe を諦め、タイムテーブルへのリンクに切り替える
- [ ] 高専祭 Wi-Fi から `live`（学内 10.x）と `kosensai`（インターネット）へ同時到達できる
- [ ] 学内 Wi-Fi から `live.kosensai.ichinoseki.ac.jp` → `10.x.x.x` が引ける
- [ ] iPhone + iCloud プライベートリレー ON で、ドメインブロック後に視聴ページが正常表示される
- [ ] ローカル DNS フォワーダに `rebind-domain-ok=/live.kosensai.ichinoseki.ac.jp/` 相当を投入
- [ ] ゲスト Wi-Fi のキャプティブポータル有無（QR → 視聴ページ直行がポータルに食われないか）

## H. 当日運用の備え

- [ ] コールドスタンバイ: `mediamtx.yml` / `Caddyfile` / `.env` / 証明書一式を予備機にコピー
- [ ] 予備機で `docker compose up -d` が通ることを一度確認しておく
- [ ] 公式サイトに「▶ ライブ配信を見る（学内Wi-Fi限定）」リンク／バナー設置を依頼（電算部 HP 部門）
- [ ] 会場・掲示用の QR コード（`https://live.kosensai.ichinoseki.ac.jp/`）を印刷
- [ ] トラブル時の連絡経路（インカム・本部 ↔ 現場 ↔ サーバー担当）を確認
