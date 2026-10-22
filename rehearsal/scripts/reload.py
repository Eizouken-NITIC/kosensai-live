"""app/ をビルドし、リハーサル環境へ反映する。

    uv run rehearsal/scripts/reload.py
"""

import pathlib
import shutil
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.request

REH_DIR = pathlib.Path(__file__).resolve().parents[1]
APP_DIR = REH_DIR.parent / "app"
PREVIEW_URL = "https://localhost:8444/"
# Caddy の再作成後に応答が返るまで待つ秒数
WAIT_SEC = 10


def run(cmd, cwd):
    # Windows の pnpm は pnpm.cmd であり、shell を介さずに起動するにはフルパスが必要である。
    exe = shutil.which(cmd[0]) or sys.exit(f"{cmd[0]} が見つかりません")
    subprocess.run([exe, *cmd[1:]], cwd=cwd, check=True)


def status(url):
    # 自己署名の internal CA が発行するため、証明書を検証しない。
    ctx = ssl._create_unverified_context()
    try:
        return urllib.request.urlopen(url, context=ctx, timeout=3).status
    except urllib.error.HTTPError as e:
        return e.code
    except OSError:
        return None


print("== ビルド ==")
run(["pnpm", "run", "build"], APP_DIR)

print()
print("== マウントを再設定 ==")
# adapter-static はビルドのたびに web/ を削除して再作成するため、bind mount が削除済みの
# ディレクトリを参照したままとなり 404 を返す。Caddy を再作成して再マウントする。
#
# --no-deps を指定しない場合は mediamtx まで再作成され、ネットワーク名前空間を相乗りして
# いる publisher が名前空間を失って停止する。
run(["docker", "compose", "up", "-d", "--force-recreate", "--no-deps", "caddy-origin", "caddy-preview"], REH_DIR)

for _ in range(WAIT_SEC):
    code = status(PREVIEW_URL)
    if code == 200:
        break
    time.sleep(1)
if code != 200:
    sys.exit(f"  NG  {PREVIEW_URL} が {code or '応答なし'}")
print(f"  OK  {PREVIEW_URL}")
