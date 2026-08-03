# hosts/hq-obs — 本部メイン PC（OBS）

**設置場所:** 本部・統合制御室
**担当:** 映像研（マシン調達は NW 班）
**役割:** Ch1〜Ch3 の SRT 受信・監視、Ch4 の合成、Ch1〜Ch4 の MediaMTX への送出

このマシンにはソフトウェアを直接入れるだけで、リポジトリからデプロイするものはない。
ただし **入力・出力の URL は手打ちしないこと**。パスフレーズの打ち間違いは
当日いちばん潰しにくい種類の事故なので、生成スクリプトを使う。

```bash
# 配信サーバー側の .env が読める場所で実行する
./hosts/hq-obs/srt-urls.sh                    # MediaMTX が同一ホスト
MTX_HOST=10.1.2.3 OBS_HOST=10.1.2.4 ./hosts/hq-obs/srt-urls.sh
```

チャンネル定義（ポート・latency・ビットレート）の出どころは
`web/channels.json` の 1 箇所だけ。Ch2 が無くなったらそこを削れば、
このスクリプトの出力も視聴ページも一緒に追従する。

---

OBS 1 台で以下を同時に行う。

1. Ch1〜Ch3 の SRT 受信（Listener・デコード・監視）
2. Ch4（サイネージ映像）の合成・生成
3. Ch1〜Ch4 の SRT 送出（エンコード → MediaMTX）

> ⚠️ 3 系統デコード + 4 系統エンコードを同時に回すため GPU 負荷は高い。
> リハーサルで GPU 使用率とフレームドロップの実測が必須。

---

## 1. 必要なもの

| 項目 | 内容 |
| --- | --- |
| OBS Studio | 32 以降 |
| GPU | Turing 世代以降（GTX 1650 Ti / 1660 Super / RTX 2080 など） |
| ドライバ | GeForce 591.44 WHQL 以降（NVENC 同時セッション上限が 12 に緩和済み。4Ch は問題なし） |
| プラグイン | [obs-multi-rtmp](https://github.com/sorayuki/obs-multi-rtmp)（複数系統 SRT 送出用） |
| プラグイン | [Source Record](https://obsproject.com/forum/threads/source-record.143697/)（Ch ごとの素材録画用） |

OBS ネイティブの配信出力は 1 系統のみのため、4 本同時送出には obs-multi-rtmp が必要。
メインエンコーダを共有できるので NVENC セッションの節約にもなる。

---

## 2. SRT 入力（メディアソース / Listener）

各会場からは Caller で入ってくるので、OBS 側は Listener で待ち受ける。
「メディアソース」を作り、**ローカルファイル のチェックを外して** 入力欄に URL を書く。

| Ch | ソース | ポート | latency | URL |
| --- | --- | --- | --- | --- |
| Ch1 | 第一体育館 ATEM Mini Pro | UDP 9001 | 200000 (200ms・有線) | `srt://0.0.0.0:9001?mode=listener&passphrase=<ch1用>&latency=200000` |
| Ch2 | 第二体育館 ATEM Mini Pro | UDP 9002 | 200000 | `srt://0.0.0.0:9002?mode=listener&passphrase=<ch2用>&latency=200000` |
| Ch3 | iPhone 遊撃（Moblin） | UDP 9003 | 500000 (500ms・Wi-Fi 移動) | `srt://0.0.0.0:9003?mode=listener&passphrase=<ch3用>&latency=500000` |

メディアソースの推奨設定:

- 「ソースが非アクティブ時に再生を終了する」→ **オフ**（切断時の自動復帰のため）
- 「ネットワークバッファリング」→ 小さめ（2MB 程度）
- 「再接続の遅延」→ 2 秒

送出側（現場）は Caller で本部 OBS に向ける:

```
# ATEM Mini Pro（第一体育館）
srt://<OBSマシンのIP>:9001?passphrase=<ch1用>&latency=200000

# Moblin（iPhone 遊撃）
srt://<OBSマシンのIP>:9003?passphrase=<ch3用>&latency=500000
```

> ATEM Mini Pro のファームウェアが SRT 送出対応版（9.5〜9.6 以降）であることを
> **実機で** 確認すること。

---

## 3. SRT 出力（obs-multi-rtmp で 4 系統）

宛先は MediaMTX。同一ホストなら `127.0.0.1`、別ホストなら NW 班から共有された IP。

```
srt://127.0.0.1:8890?streamid=publish:<ch>&passphrase=<ch用>&latency=120000
```

| Ch | streamid | passphrase | latency | ビットレート |
| --- | --- | --- | --- | --- |
| Ch1 | `publish:ch1` | `MTX_PATHS_CH1_SRTPUBLISHPASSPHRASE` の値 | 120000 | CBR 4500 kbps |
| Ch2 | `publish:ch2` | `MTX_PATHS_CH2_...` | 120000 | CBR 4500 kbps |
| Ch3 | `publish:ch3` | `MTX_PATHS_CH3_...` | 120000 | CBR 4500 kbps |
| Ch4 | `publish:ch4` | `MTX_PATHS_CH4_...` | 120000 | CBR 5000 kbps |

パスフレーズは `hosts/stream-server/.env` と**必ず一致させる**。
実値入りの URL は `./srt-urls.sh` が出力する。

### エンコード設定

```
エンコーダ        : NVENC H.264
解像度            : 1920x1080
レート制御        : CBR
ビットレート      : Ch1-3 = 4500 kbps / Ch4 = 5000 kbps
キーフレーム間隔  : 2 秒
プロファイル      : Main
プリセット        : Quality
```

### 帯域見積もり

```
1080p 4.5Mbps x 100人 x 3ch = 1.35 Gbps
```

LAG（実効 2Gbps）が前提。**LAG が使えないと NW 班から回答が来た場合は
Ch1〜3 を 3 Mbps に落とす**（= 900 Mbps）。当日朝の判断でも間に合うよう、
プロファイルを 4.5M / 3M の 2 種類作っておくとよい。

---

## 4. 録画

| 対象 | 方法 |
| --- | --- |
| Ch1〜Ch3 | 各 SRT ソースに **Source Record** フィルタを適用し、オーバーレイなしの素材を個別ファイルへ |
| Ch4 | OBS メインの録画出力（サイネージ合成・オーバーレイ付き） |
| 体育館の各カメラ | ATEM ISO で生素材を個別収録（素材提供用） |

- コンテナは **MKV** で録画 → 後から `ファイル > 録画の再多重化` で MP4 化（クラッシュ耐性）
- 詳細出力モードにすれば 配信 = NVENC / 録画 = x264 と役割分担できる
- 保存先は映像研の SSD。空き容量を事前に確認すること

---

## 5. Ch4（サイネージ）シーン構成の目安

- ベース: 各 Ch のダイジェスト（Ch1/Ch2/Ch3 のソースを切り替え）
- 上レイヤー: Next 演目テロップ、タイムテーブル、屋台紹介 CM（茶道部等の事前制作物）
- サイネージ端末は 16:9 全画面 + 右カラムに公式サイトの iframe が乗るため、
  **映像の左右端に重要な情報を置かない**（右カラムに隠れることはないが、
  端末によっては映像がレターボックスされる）

---

## 6. 当日のトラブル対応

| 症状 | 対応 |
| --- | --- |
| 特定 Ch だけ映らない | まず現場の ATEM/iPhone の SRT 接続状態を確認。OBS メディアソースを右クリック → 「再起動」 |
| 全 Ch が MediaMTX に届かない | サーバー側 `docker compose logs -f mediamtx`。passphrase 不一致が最有力 |
| フレームドロップ | OBS の統計を確認。GPU 律速ならビットレートを 3M に落とす |
| Ch3 が数秒切れる | AP ローミング。latency を 800ms まで上げて様子を見る |
