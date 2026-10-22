"""計器と時計の画像を Blender で描画する。

    uv run kosensai-live render gauge
    uv run kosensai-live render clock

Blender は環境変数 BLENDER、PATH の blender、OS の既定のインストール先の順に探す。
"""

import glob
import os
import shutil
import subprocess
import sys

from . import config

DESIGN = config.REPO / "hosts/obs/design"
# 描画するもの → (Blender のスクリプト, 出力先)
TARGETS = {
    "gauge": (DESIGN / "render/gauge.py", DESIGN / "gauge"),
    "clock": (DESIGN / "render/clock.py", DESIGN / "clock-face"),
}


def blender():
    if os.environ.get("BLENDER"):
        return os.environ["BLENDER"]
    if found := shutil.which("blender"):
        return found
    if sys.platform == "darwin":
        candidates = ["/Applications/Blender.app/Contents/MacOS/Blender"]
    elif sys.platform == "win32":
        # バージョンごとのフォルダ(Blender 4.4 等)のうち、最も新しいもの
        candidates = sorted(glob.glob(r"C:\Program Files\Blender Foundation\Blender *\blender.exe"), reverse=True)
    else:
        candidates = []
    for c in candidates:
        if os.path.isfile(c):
            return c
    sys.exit("Blender が見つかりません。環境変数 BLENDER に実行ファイルのパスを指定してください")


def main(target, args):
    script, out = TARGETS[target]
    cmd = [blender(), "-b", "--factory-startup", "-P", str(script), "--", str(out), *args]
    sys.exit(subprocess.run(cmd).returncode)
