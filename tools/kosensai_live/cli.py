"""kosensai-live の CLI。本部 PC と開発用の PC で、OS によらず uv run で実行する。

  uv run kosensai-live check               .env と config.json を検証する
  uv run kosensai-live obs build           OBS のシーン・プロファイル・obs-multi-rtmp の出力を設定する
  uv run kosensai-live obs devices         音声入力のデバイスの名前を表示する
  uv run kosensai-live atem apply|check|get|start|stop|watch
                                           ATEM の映像の形式と配信を設定・確認する
  uv run kosensai-live relay [--ffmpeg]    ATEM・スマートフォンの SRT を受け、OBS へ UDP で渡す(本部 PC で常駐させる)
  uv run kosensai-live urls                SRT の URL と視聴の URL を表示する
  uv run kosensai-live qr                  視聴ページの QR コードを生成する
  uv run kosensai-live render gauge|clock  計器と時計の画像を Blender で描画する
  uv run kosensai-live rehearsal reload|load-test
                                           ローカル検証環境を操作する

.env は既定で hosts/server/.env を読む。check・obs・atem・relay・urls の後に --env で別のファイルを指定できる。
obs build は、その年の中身(kosensai-live-assets)を既定で同じ階層の kosensai-live-assets から読む。
obs build --assets か環境変数 KOSENSAI_LIVE_ASSETS で別の場所を指定できる。
"""

import argparse
import os
from pathlib import Path

from . import config

# その年の中身(kosensai-live-assets)の既定の場所。kosensai-live のチェックアウトと同じ階層。
ASSETS_DIR = Path(os.environ.get("KOSENSAI_LIVE_ASSETS") or config.REPO.parent / "kosensai-live-assets")


def main():
    ap = argparse.ArgumentParser(prog="kosensai-live", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    # オプションはサブコマンドの後に書く(uv run kosensai-live obs build --assets ...)。
    env = argparse.ArgumentParser(add_help=False)
    env.add_argument("--env", default=config.ENV_FILE, help=".env のパス")

    sub.add_parser("check", parents=[env], help=".env と config.json を検証する")

    p = sub.add_parser("obs", parents=[env], help="本部 OBS")
    p.add_argument("action", choices=["build", "devices"])
    p.add_argument("--assets", type=Path, default=ASSETS_DIR,
                   help=f"build: kosensai-live-assets の場所(既定: 環境変数 KOSENSAI_LIVE_ASSETS、無ければ {ASSETS_DIR})")

    p = sub.add_parser("atem", parents=[env], help="ATEM の映像の形式と配信を設定・確認する")
    p.add_argument("action", choices=["apply", "check", "get", "start", "stop", "watch"])
    p.add_argument("arg", nargs="?", help="apply・check は Ch の id(既定: ch1)、watch は秒数(既定: 10)")

    p = sub.add_parser("relay", parents=[env], help="ATEM・スマートフォンの SRT を受け、OBS へ UDP で渡す")
    p.add_argument("--ffmpeg", help="ffmpeg の場所(既定: PATH の ffmpeg)")
    sub.add_parser("urls", parents=[env], help="SRT の URL と視聴の URL を表示する")
    sub.add_parser("qr", help="視聴ページの QR コードを生成する")

    p = sub.add_parser("render", help="計器と時計の画像を Blender で描画する")
    p.add_argument("target", choices=["gauge", "clock"])
    p.add_argument("args", nargs=argparse.REMAINDER, help="Blender のスクリプトに渡す引数(確認用の 1 枚の指定等)")

    p = sub.add_parser("rehearsal", help="ローカル検証環境を操作する")
    p.add_argument("action", choices=["reload", "load-test"])
    p.add_argument("clients", nargs="?", type=int, default=10, help="load-test: Ch あたりの同時視聴者数")
    p.add_argument("ch", nargs="?", default="ch1", help="load-test: Ch の id、または all")
    p.add_argument("duration", nargs="?", type=int, default=30, help="load-test: 実行秒数")

    args = ap.parse_args()
    # サブコマンドの依存(obsws-python 等)は使用する時だけ import する。
    if args.cmd == "check":
        config.cmd_check(argparse.Namespace(env=args.env, server=False, certs=None, write_site_env=None))
    elif args.cmd == "obs":
        from . import obs
        if args.action == "build":
            obs.build(args.env, args.assets)
        else:
            obs.devices()
    elif args.cmd == "atem":
        from . import atem
        ch = args.arg if args.action in ("apply", "check") and args.arg else "ch1"
        seconds = int(args.arg) if args.action == "watch" and args.arg else 10
        atem.main(args.env, args.action, ch, seconds)
    elif args.cmd == "relay":
        from . import relay
        relay.main(args.env, args.ffmpeg)
    elif args.cmd == "urls":
        from . import urls
        urls.main(args.env)
    elif args.cmd == "qr":
        from . import qr
        qr.main()
    elif args.cmd == "rehearsal":
        from . import rehearsal
        if args.action == "reload":
            rehearsal.reload()
        else:
            rehearsal.load_test(args.clients, args.ch, args.duration)
    elif args.cmd == "render":
        from . import render
        render.main(args.target, args.args)
