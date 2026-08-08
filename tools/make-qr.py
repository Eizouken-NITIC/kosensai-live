#!/usr/bin/env python3
"""視聴ページの QR コードを SVG で生成する。

生成物（app/static/assets/qr-viewer.svg）はリポジトリにコミットしてあるため、
普段は実行する必要がない。URL が変わったときだけ実行する。

学内限定配信で外部到達性に依存させたくないため、実行時に QR を生成する
JS ライブラリは使わず、静的な SVG を配置する方針を採っている。

このスクリプト自体は配信物に含めない。app/static/ へ置くとビルド成果物へ
複製され、視聴者へ配信されてしまう。

    python3 -m venv /tmp/qrenv && /tmp/qrenv/bin/pip install segno
    /tmp/qrenv/bin/python tools/make-qr.py
"""

import pathlib
import sys

try:
    import segno
except ImportError:
    sys.exit("segno が要る: pip install segno")

URL = "https://live.kosensai.ichinoseki.ac.jp/"
OUT = pathlib.Path(__file__).resolve().parent.parent / "app/static/assets/qr-viewer.svg"

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

# segno は currentColor を受け付けないため、生成後に差し替える。
# サイネージは <img> で読み込んでおり、その場合 SVG は独立した文書として扱われて
# 親の色を継承しないため黒で描画される。将来インライン展開する場合に色を制御できる。
svg = OUT.read_text(encoding="utf-8").replace('stroke="#000"', 'stroke="currentColor"')
OUT.write_text(svg, encoding="utf-8")

print(f"{OUT.name}: {URL}")
print(f"  version {qr.version} / error {qr.error} / {qr.symbol_size(scale=1, border=2)[0]}モジュール角 / {OUT.stat().st_size} バイト")
