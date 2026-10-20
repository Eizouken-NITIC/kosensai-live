# tools/atem-stream

ATEM の配信（ライブストリーム）設定を、Blackmagic ATEM Switchers SDK 経由で読み書きする CLI。ATEM Software Control の GUI と同じ設定を、`config.json` と `hosts/server/.env` の値から投入・確認する。

| ファイル | 役割 |
| --- | --- |
| `atem.py` | `config.json` と `.env` から設定値を決め、`atem-stream` を呼び出す |
| `main.cpp` | SDK を呼び出す `atem-stream` のソース。値は引数で受け取る |
| `build.sh` | `atem-stream` をビルドする |

## 前提

- macOS
- [Blackmagic ATEM Switchers SDK](https://www.blackmagicdesign.com/developer/products/atem/sdk-and-software) のインストール。SDK はライセンス上リポジトリに含めない
- `hosts/server/.env` の `ATEM_IP`、`HQ_IP`、`OBS_<Ch>_LISTEN_PASSPHRASE`
- ATEM Mini Pro ISO（ファームウェア 10.3）で動作を確認している

## ビルド

```bash
./tools/atem-stream/build.sh
```

SDK の `include` ディレクトリが既定の場所（`/Applications/Blackmagic ATEM Switchers/Developer SDK/Mac OS X/include`）に無い場合は `ATEM_SDK_INCLUDE` で指定する。

## 使用方法

```bash
./tools/atem-stream/atem.py apply      # ch1 の設定を投入し、check と同じ確認を行う
./tools/atem-stream/atem.py check      # 設定値が期待値と一致するかを確認する
./tools/atem-stream/atem.py start
./tools/atem-stream/atem.py watch 30
./tools/atem-stream/atem.py stop
```

| コマンド | 内容 |
| --- | --- |
| `apply [ch]` | サービス名・URL・キー・パスフレーズを設定する。Ch の既定は `ch1` |
| `check [ch]` | 設定値と期待値を比較し、不一致があれば終了コード 1 で終了する。パスフレーズは一致・不一致だけを表示する |
| `get` | サービス名・URL・キー・authentication・SRT 拡張・状態を表示する（パスフレーズも表示する） |
| `start` / `stop` | 配信を開始・停止する |
| `watch [秒]` | 状態とビットレートを 1 秒ごとに表示する |

期待値は次のとおり。

| 項目 | 値 |
| --- | --- |
| サービス名 | `Custom URL H.264` |
| URL | `srt://<HQ_IP>:<config.json の obsListenPort>` |
| キー | 空 |
| パスフレーズ | `OBS_<Ch>_LISTEN_PASSPHRASE` |

`atem-stream` は単体でも使用できる（`./tools/atem-stream/atem-stream` を引数なしで実行すると usage を表示する）。

## ATEM の仕様

- SRT のパスフレーズは `SetAuthentication` の password に対応する。URL の `?passphrase=` と `SetSRTExtensions` は反映されない
- 配信中（`connecting` を含む）は `SetUrl` / `SetKey` / `SetAuthentication` が `E_FAIL`（`0x80000008`）を返す。`stop` してから設定する
