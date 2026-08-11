# hosts/signage — サイネージ端末セットアップ手順書（Raspberry Pi + Chromium Kiosk）

本ディレクトリは、ライブ配信を会場内のディスプレイなどで常時全画面表示し続ける「サイネージ端末」の初期設定および導入手順を管理しています。

サイネージ表示サイトのURLは `https://<domain>/signage/` であり、そのソースコードは `app/src/routes/signage/+page.svelte` に実装されています。表示するチャンネルのデフォルト設定値は、リポジトリ直下の `config.json` 内にある `signage.defaultChannel` に定義されています。

---

## 1. 自動一括セットアップ

サイネージ端末（Raspberry Pi）の実機上で本リポジトリをクローンし、以下のセットアップスクリプトを実行することで、OSの基本設定および自動起動設定（§2および§3の内容）をすべて自動的に適用できます。

```bash
# デフォルトで定義されたチャンネルを表示する場合
./hosts/signage/setup.sh

# 特定のチャンネル（例: ch1）を指定する場合
SIGNAGE_CH=ch1 ./hosts/signage/setup.sh
```

---

## 2. Raspberry Pi 端末本体の手動設定

手動でRaspberry Piの設定を行う場合は、以下の通り設定を適用してください。

### ディスプレイ表示とGPUメモリの設定
`/boot/config.txt`（Bookworm以降では `/boot/firmware/config.txt`）を編集し、以下のパラメーターを設定・確認します。

```ini
gpu_mem=256
hdmi_force_hotplug=1
disable_overscan=1
```

### スクリーンセーバーおよび省電力スリープの無効化

```bash
sudo apt install -y unclutter x11-xserver-utils
xset s off
xset -dpms
xset s noblank
```

---

## 3. Chromiumブラウザの起動設定

Chromiumをキオスクモードで起動するための詳細なフラグオプションおよび初期表示URLは、[signage.service](signage.service) に定義されています。

一括セットアップスクリプト `setup.sh` を実行すると、テンプレート内の `@@SIGNAGE_URL@@` を書き換えた状態でサービスに適用します。

### 代表的なChromium起動フラグ
- `--autoplay-policy=no-user-gesture-required`: 音声付き自動再生を許可します。
- `--check-for-update-interval=...`: アップデート通知ダイアログの表示を抑制します。

### systemdによる自動起動設定

```bash
# テンプレートからサービス定義ファイルを生成し、表示URLを反映させます
sed "s|@@SIGNAGE_URL@@|https://<domain>/signage/|" signage.service \
  > ~/.config/systemd/user/signage.service

# ユーザー用systemdデーモンをリロードして有効化
systemctl --user daemon-reload
systemctl --user enable --now signage

# ユーザーがログアウトした後もサービスを持続稼働させる設定
sudo loginctl enable-linger "$USER"
```

---

## 4. サイネージ用Webページ側の制御機能

サイネージ用のWebアプリケーションには、自動復旧のための各種ロジックが実装されています。

| 状態・現象 | ページの自律挙動 |
| --- | --- |
| **対象チャンネルが配信されていない場合** | 「このチャンネルは配信されていません」という案内を表示し、5秒周期で自動再試行します。 |
| **配信サーバーとの通信が一時切断された場合** | 「接続できません」という案内を表示し、疎通が回復した段階で、自動的に再生を再開します。 |
| **再生位置がライブの先端から遅れた場合** | 常に先端へ追従します。遅れが小さいうちは再生速度を5%上げて詰め、20秒以上開いた場合は先端へシークします。視聴ページと違い巻き戻す操作が無いため、遅れをそのまま抱え続けない設定にしています。 |
| **音声出力** | 常に音声を有効にした状態で起動します。 |
| **埋め込みエリア（iframe）** | 5分ごとに埋め込み用iframeパーツの自動リロードを行います。 |
| **長時間の連続稼働対策** | 6時間周期で、配信されていないタイミングに限りページ自体を自動リロード（メモリ解放）します。 |
| **時計表示** | 画面の右上に、現在のシステム時刻をベースにした時計をオーバーレイ表示します。 |

---

## 5. カスタマイズ・調整項目

- **表示チャンネルの個別変更**:
  特定のチャンネル専用のサイネージとして固定表示させたい場合は、URLの末尾にクエリパラメータ `?ch=ch1` などを追加します（例: `/signage/?ch=ch1`）。
- **レイアウトサイズおよび文字サイズの微調整**:
  全体の余白バランスは、`app/src/styles/signage.css` の中にある `.signage { font-size: ... }` の1行で定義されています。この値を変更することで全体が比例拡大・縮小します。
- **スピーカー音量の調整**:
  音量の調節は端末（Raspberry Pi）側（`alsamixer` 等）で行ってください。
