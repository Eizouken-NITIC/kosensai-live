#!/usr/bin/env python3
"""視聴ページの QR コードを SVG で生成する。

生成物（qr-viewer.svg）はリポジトリにコミットしてあるので、普段は実行しなくてよい。
URL が変わったときだけ流し直す。

学内限定配信で外部到達性に依存させたくないため、実行時に QR を生成する
JS ライブラリは使わず、静的な SVG を置く方針にしている。

    python3 -m venv /tmp/qrenv && /tmp/qrenv/bin/pip install segno
    /tmp/qrenv/bin/python web/assets/make-qr.py
"""

import pathlib
import sys

try:
    import segno
except ImportError:
    sys.exit("segno が要る: pip install segno")

URL = "https://live.kosensai.ichinoseki.ac.jp/"
OUT = pathlib.Path(__file__).with_name("qr-viewer.svg")

# error='m' … 15% の誤り訂正。サイネージは離れて読むので少し余裕を持たせる。
# border=2   … 静音域。規格の推奨は 4 だが、画面表示なら 2 で十分読める。
qr = segno.make(URL, error="m")
qr.save(
    OUT,
    kind="svg",
    scale=1,        # サイズは CSS 側で決めるので等倍で出す
    border=2,       # 静音域。規格の推奨は 4 だが画面表示なら 2 で読める
    dark="#000000",
    light=None,     # 背景は透明
    svgclass=None,
    lineclass=None,
    omitsize=True,  # width/height を出さず viewBox だけにする
)

# 前景色を CSS から制御できるようにする。segno は currentColor を受け付けないので
# 生成後に差し替える。これで theme.css の色に追従できる。
svg = OUT.read_text(encoding="utf-8").replace('stroke="#000"', 'stroke="currentColor"')
OUT.write_text(svg, encoding="utf-8")

print(f"{OUT.name}: {URL}")
print(f"  version {qr.version} / error {qr.error} / {qr.symbol_size(scale=1, border=2)[0]}モジュール角 / {OUT.stat().st_size} バイト")
