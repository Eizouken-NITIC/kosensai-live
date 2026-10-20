# tools/atem-stream

ATEM の配信（ライブストリーム）設定を、Blackmagic ATEM Switchers SDK 経由で読み書きする CLI。ATEM Software Control の GUI と同じ設定を、コマンドで確認・投入できる。

## 前提

- macOS
- [Blackmagic ATEM Switchers SDK](https://www.blackmagicdesign.com/developer/products/atem/sdk-and-software) のインストール。SDK はライセンス上リポジトリに含めない
- ATEM Mini Pro ISO（ファームウェア 10.3）で動作を確認している

## ビルド

```bash
./tools/atem-stream/build.sh
```

SDK の `include` ディレクトリが既定の場所（`/Applications/Blackmagic ATEM Switchers/Developer SDK/Mac OS X/include`）に無い場合は `ATEM_SDK_INCLUDE` で指定する。

## 使用方法

```bash
ATEM=192.168.x.x
./tools/atem-stream/atem-stream $ATEM get
./tools/atem-stream/atem-stream $ATEM set "Custom URL H.264" "srt://<本部 PC の IP>:9001"
./tools/atem-stream/atem-stream $ATEM passphrase "$(grep ^OBS_CH1_LISTEN_PASSPHRASE= hosts/server/.env | cut -d= -f2-)"
./tools/atem-stream/atem-stream $ATEM start
./tools/atem-stream/atem-stream $ATEM watch 30
./tools/atem-stream/atem-stream $ATEM stop
```

| コマンド | 内容 |
| --- | --- |
| `get` | サービス名・URL・キー・authentication・SRT 拡張・状態を表示する |
| `set <service> <url>` | サービス名と URL を設定する |
| `passphrase <値>` | SRT のパスフレーズを設定する |
| `start` / `stop` | 配信を開始・停止する |
| `watch <秒>` | 状態とビットレートを 1 秒ごとに表示する |

## ATEM の仕様

- SRT のパスフレーズは `SetAuthentication` の password に対応する。URL の `?passphrase=` と `SetSRTExtensions` は反映されない
- 配信中（`connecting` を含む）は `SetUrl` / `SetKey` / `SetAuthentication` が `E_FAIL`（`0x80000008`）を返す。`stop` してから設定する
