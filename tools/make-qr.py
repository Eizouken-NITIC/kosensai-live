# /// script
# requires-python = ">=3.11"
# dependencies = ["segno==1.6.6"]
# ///
"""視聴ページの QR コードを SVG で生成する。

生成物（app/static/assets/qr-viewer.svg）はリポジトリにコミットしてあるため、
普段は実行する必要がない。URL が変わったときだけ実行する。

視聴者の端末が外部へ到達できるとは限らないため、実行時に QR を生成する JS ライブラリは
使用せず、静的な SVG を配置する。

このスクリプト自体は配信物に含めない。app/static/ へ配置するとビルド成果物へ
複製され、視聴者へ配信されてしまう。

    uv run tools/make-qr.py
"""

import pathlib

import config

import segno

REPO = pathlib.Path(__file__).resolve().parent.parent
URL = "https://" + config.load_config()["site"]["domain"] + "/"
OUT = REPO / "app/static/assets/qr-viewer.svg"

# error='m' … 15% の誤り訂正。サイネージは離れて読むので少し余裕を持たせる。
# border=2   … 静音域。規格の推奨は 4 だが、画面表示なら 2 で十分読める。
qr = segno.make(URL, error="m")
qr.save(
    OUT,
    kind="svg",
    scale=1,        # サイズは CSS 側で決めるので等倍で出力する
    border=2,       # 静音域。規格の推奨は 4 だが画面表示なら 2 で読める
    dark="#000000",
    light=None,     # 背景は透明にする
    svgclass=None,
    lineclass=None,
    omitsize=True,  # width/height を出力せず viewBox だけにする
)

print(f"{OUT.name}: {URL}")
print(f"  version {qr.version} / error {qr.error} / {qr.symbol_size(scale=1, border=2)[0]}モジュール角 / {OUT.stat().st_size} バイト")
