#!/usr/bin/env python3
"""ATEM の配信設定を config.json と .env から設定・確認する。

ATEM の IP は .env の ATEM_IP、送信先は HQ_IP と config.json の obsListenPort、
パスフレーズは OBS_<Ch>_LISTEN_PASSPHRASE から決める。SDK の呼び出しは
同じディレクトリの atem-stream（build.sh でビルドする）が行う。

  ./tools/atem-stream/atem.py apply [ch]    # サービス名・URL・キー・パスフレーズを設定する
  ./tools/atem-stream/atem.py check [ch]    # 設定値が期待値と一致するかを確認する
  ./tools/atem-stream/atem.py get | start | stop | watch [秒]
"""

import argparse
import pathlib
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import config  # noqa: E402

BIN = HERE / "atem-stream"
# ATEM Software Control の「配信サービス」の項目名。SRT はこのサービスで送出する。
SERVICE = "Custom URL H.264"


def run(atem_ip, *args, capture=False):
    if not BIN.is_file():
        raise SystemExit(f"{BIN} がありません（{HERE / 'build.sh'} を実行してください）")
    proc = subprocess.run([str(BIN), atem_ip, *args], text=True, capture_output=capture)
    if proc.returncode != 0:
        if capture:
            sys.stderr.write(proc.stderr)
        raise SystemExit(proc.returncode)
    return proc.stdout


def expected(conf, env, cid):
    c = config.channel(conf, cid)
    if not c.get("obsListenPort"):
        raise SystemExit(f"Ch {cid} は本部 OBS が SRT で受信しない Ch です")
    return {
        "service": SERVICE,
        "url": f"srt://{config.require_ipv4(env, 'HQ_IP')}:{c['obsListenPort']}",
        "key": "",
        "passphrase": config.require(env, config.listen_var(cid)),
    }


def current(atem_ip):
    """atem-stream get の出力（"名前 : 値" の行）を辞書にする。"""
    values = {}
    for line in run(atem_ip, "get", capture=True).splitlines():
        name, _, value = line.partition(":")
        # 値の前後の空白は削除しない。user が空の auth は " / <password>" になる。
        values[name.strip()] = value.removeprefix(" ")
    _, _, password = values["auth"].partition(" / ")
    values["passphrase"] = password
    return values


def cmd_check(atem_ip, want):
    have = current(atem_ip)
    results = []
    for name in ["service", "url", "key"]:
        if have[name] == want[name]:
            results.append(("OK", f"{name}: {have[name]!r}"))
        else:
            results.append(("NG", f"{name}: {have[name]!r}（期待値: {want[name]!r}）"))
    # パスフレーズは画面に出さない
    results.append(("OK", "passphrase: 一致") if have["passphrase"] == want["passphrase"]
                   else ("NG", "passphrase: 不一致"))
    results.append(("OK", f"status: {have['status']}"))
    if not config.print_section(f"ATEM ({atem_ip})", results):
        sys.exit(1)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--env", default=config.ENV_FILE, help=".env のパス")
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ["apply", "check"]:
        p = sub.add_parser(name)
        p.add_argument("ch", nargs="?", default="ch1", help="Ch の id（既定: ch1）")
    for name in ["get", "start", "stop"]:
        sub.add_parser(name)
    p = sub.add_parser("watch")
    p.add_argument("sec", nargs="?", default="10")
    args = ap.parse_args()

    env = config.load_env(args.env)
    atem_ip = config.require_ipv4(env, "ATEM_IP")

    if args.cmd in ("apply", "check"):
        want = expected(config.load_config(), env, args.ch)
        if args.cmd == "apply":
            # 配信中（connecting を含む）は ATEM が変更を受け付けない（E_FAIL）
            run(atem_ip, "set", want["service"], want["url"], want["key"], capture=True)
            run(atem_ip, "passphrase", want["passphrase"], capture=True)
        cmd_check(atem_ip, want)
    elif args.cmd == "watch":
        run(atem_ip, "watch", args.sec)
    else:
        run(atem_ip, args.cmd)


if __name__ == "__main__":
    main()
