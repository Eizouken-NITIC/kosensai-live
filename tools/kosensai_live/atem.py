"""ATEM の映像の形式と配信の設定を、config.json と .env から設定・確認する。

    uv run kosensai-live atem apply [ch]   映像の形式・サービス名・URL・キー・パスフレーズを設定し、check を行う
    uv run kosensai-live atem check [ch]   設定値が期待値と一致するかを確認する
    uv run kosensai-live atem get          現在の設定を表示する(パスフレーズも表示する)
    uv run kosensai-live atem start|stop   配信を開始・停止する
    uv run kosensai-live atem watch [秒]   配信の状態とビットレートを 1 秒ごとに表示する

ATEM の IP は .env の ATEM_IP、送信先は HQ_IP と config.json の obsListenPort、パスフレーズは
OBS_<Ch>_LISTEN_PASSPHRASE、映像の形式は config.json の video.mode から決める。
ATEM のプロトコルは pyatem で扱う。SRT のパスフレーズは配信の認証(SAth)の password に対応する。
pyatem は SAth の送信のコマンドを持たないため、ここで組み立てる。
"""

import struct
import sys
import threading
import time

from pyatem.command import Command, StreamingServiceSetCommand, StreamingStatusSetCommand, VideoModeCommand
from pyatem.protocol import AtemProtocol

from . import config, urls

# ATEM Software Control の「配信サービス」の項目名。SRT はこのサービスで送出する。
SERVICE = "Custom URL H.264"
CONNECT_TIMEOUT_SEC = 5
# 設定を送ってから、ATEM が新しい値を返すまで待つ秒数
APPLY_TIMEOUT_SEC = 3
# 配信の状態(StRS)のビット
STATUS_BITS = {1: "idle", 2: "connecting", 4: "streaming", 32: "stopping"}


class AuthenticationCommand(Command):
    """SAth: 配信の認証の user と password(SRT のパスフレーズ)。どちらも 64 バイトの null 終端の文字列。"""

    def __init__(self, user, password):
        self.user = user
        self.password = password

    def get_command(self):
        return self._make_command("SAth", struct.pack(">64s64s", self.user.encode(), self.password.encode()))


class Atem:
    def __init__(self, ip):
        self.ip = ip
        self.proto = AtemProtocol(ip=ip)
        ready = threading.Event()
        self.proto.on("connected", ready.set)
        self.proto.connect()
        # pyatem の受信は応答が無いと戻らないため、別のスレッドで回し、接続の完了をタイムアウト付きで待つ。
        threading.Thread(target=self._loop, daemon=True).start()
        if not ready.wait(CONNECT_TIMEOUT_SEC):
            sys.exit(f"ATEM ({ip}) に {CONNECT_TIMEOUT_SEC} 秒以内に接続できません")

    def _loop(self):
        while True:
            self.proto.loop()

    def send(self, *commands):
        self.proto.send_commands(list(commands))

    def field(self, key):
        if key not in self.proto.mixerstate:
            sys.exit(f"ATEM が {key} を送っていません")
        return self.proto.mixerstate[key]

    def values(self):
        service = self.field("streaming-service")
        status = self.field("streaming-status").status
        auth = self.proto.mixerstate.get("SAth")
        user, password = (None, None) if auth is None else (
            s.split(b"\0", 1)[0].decode() for s in struct.unpack_from(">64s64s", auth))
        return {
            "product": self.field("product-name").name,
            "firmware": self.field("firmware-version").version,
            "video_mode": self.field("video-mode").mode,
            "service": service.name,
            "url": service.url,
            "key": service.key,
            "user": user,
            "passphrase": password,
            "status": status,
        }


def status_text(status):
    names = [name for bit, name in STATUS_BITS.items() if status & bit]
    return f"{status} ({', '.join(names) or '不明'})"


def expected(conf, env, cid):
    c = config.channel(conf, cid)
    if not c.get("obsListenPort"):
        sys.exit(f"Ch {cid} は本部 OBS が SRT で受信しない Ch です")
    return {
        "video_mode": config.video_mode(conf)[4],
        "service": SERVICE,
        "url": urls.caller_url(conf, env, cid),
        "key": "",
        "passphrase": config.require(env, config.listen_var(cid)),
    }


def compare(have, want):
    """(OK か NG, 説明) の一覧。パスフレーズは値を表示しない。"""
    results = []
    for name in ["video_mode", "service", "url", "key"]:
        if have[name] == want[name]:
            results.append(("OK", f"{name}: {have[name]!r}"))
        else:
            results.append(("NG", f"{name}: {have[name]!r}（期待値: {want[name]!r}）"))
    if have["passphrase"] is None:
        results.append(("NG", "passphrase: ATEM から読み返せません"))
    elif have["passphrase"] == want["passphrase"]:
        results.append(("OK", "passphrase: 一致"))
    else:
        results.append(("NG", "passphrase: 不一致"))
    return results


def apply(atem, want):
    have = atem.values()
    # 配信中(connecting を含む)は、ATEM が設定を受け付けない。
    if have["status"] & ~1:
        sys.exit(f"配信中（{status_text(have['status'])}）のため設定できません。stop してから実行してください")
    if have["video_mode"] != want["video_mode"]:
        atem.send(VideoModeCommand(want["video_mode"]))
    atem.send(StreamingServiceSetCommand(name=want["service"], url=want["url"], key=want["key"]),
              AuthenticationCommand("", want["passphrase"]))
    deadline = time.monotonic() + APPLY_TIMEOUT_SEC
    while time.monotonic() < deadline:
        if all(status == "OK" for status, _ in compare(atem.values(), want)):
            return
        time.sleep(0.1)


def main(env_path, action, ch, seconds):
    conf = config.load_config()
    env = config.load_env(env_path)
    atem = Atem(config.require_ipv4(env, "ATEM_IP"))

    if action in ("apply", "check"):
        want = expected(conf, env, ch)
        if action == "apply":
            apply(atem, want)
        have = atem.values()
        results = compare(have, want)
        results.append(("OK", f"status: {status_text(have['status'])}"))
        title = f"ATEM {have['product']} fw {have['firmware']} ({atem.ip})"
        if not config.print_section(title, results):
            sys.exit(1)
    elif action == "get":
        for name, value in atem.values().items():
            print(f"{name:<10} : {status_text(value) if name == 'status' else value}")
    elif action in ("start", "stop"):
        atem.send(StreamingStatusSetCommand(action == "start"))
        time.sleep(1)
        print(f"status : {status_text(atem.values()['status'])}")
    elif action == "watch":
        for _ in range(seconds):
            stats = atem.proto.mixerstate.get("streaming-stats")
            line = f"status={status_text(atem.values()['status'])}"
            if stats is not None:
                line += f" bitrate={stats.bitrate / 1000:.0f}kbps cache={stats.cache}%"
            print(line)
            time.sleep(1)
