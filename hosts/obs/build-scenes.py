# /// script
# requires-python = ">=3.11"
# dependencies = ["obsws-python==1.8.0"]
# ///
"""本部 OBS のシーンコレクション「KOSENSAI-LIVE」を obs-websocket で作る。

起動中の OBS に接続し、無いシーンとソースだけを作る。既にあるシーンには手を加えない。
ソースの設定(SRT の URL とパスフレーズ、テロップのファイルの場所)は毎回上書きする。

    uv run hosts/obs/build-scenes.py              # hosts/server/.env を読む
    ENV_FILE=/path/to/.env uv run hosts/obs/build-scenes.py

obs-websocket のパスワードは、同じ PC の OBS の設定ファイルから読む。
"""

import json
import os
import sys
from pathlib import Path

import obsws_python as obs

HOST_DIR = Path(__file__).resolve().parent
REPO_DIR = HOST_DIR.parents[1]
OVERLAYS = HOST_DIR / "overlays"
COLLECTION = "KOSENSAI-LIVE"
W, H = 1920, 1080

# 2 画面の映像の位置と大きさ。overlays/split.html の枠と一致させる。
PANE_W, PANE_H = 864, 486
PANE_L, PANE_R = (80, 200), (976, 200)

CH1_VIDEO = "Ch1 ATEM"
CH1_AUDIO = "Ch1 音声 (USB)"
CH2_VIDEO = "Ch2 iPhone"


def read_env(path: Path) -> dict[str, str]:
    env = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def obs_config_dir() -> Path:
    if sys.platform == "win32":
        return Path(os.environ["APPDATA"]) / "obs-studio"
    if sys.platform == "darwin":
        return Path.home() / "Library/Application Support/obs-studio"
    return Path.home() / ".config/obs-studio"


def websocket_password() -> str:
    if "OBS_WEBSOCKET_PASSWORD" in os.environ:
        return os.environ["OBS_WEBSOCKET_PASSWORD"]
    conf = json.loads((obs_config_dir() / "plugin_config/obs-websocket/config.json").read_text())
    if not conf.get("server_enabled"):
        sys.exit("OBS の「ツール → WebSocket サーバー設定」でサーバーを有効にしてください")
    return conf["server_password"]


def audio_input_kind() -> str:
    return {"win32": "wasapi_input_capture", "darwin": "coreaudio_input_capture"}.get(sys.platform, "pulse_input_capture")


def listener(port: int, passphrase: str, latency_us: int) -> dict:
    return {
        "is_local_file": False,
        "input": f"srt://0.0.0.0:{port}?mode=listener&passphrase={passphrase}&latency={latency_us}",
        "input_format": "mpegts",
        "hw_decode": True,
        "restart_on_activate": False,
        "close_when_inactive": False,
        "clear_on_media_end": False,
        "reconnect_delay_sec": 1,
        "buffering_mb": 1,
    }


def browser(page: str, replay: bool, query: str = "") -> dict:
    # replay=True の画面は、表示するたびに読み込み直して入りのアニメーションを再生する。
    # 引数付きで開く場合は、OBS がローカルファイルに使用する http://absolute/<パス> の URL で指定する。
    # TODO: Windows で http://absolute/C:/... の形で開けることを本番機で確認する(macOS では確認済み)。
    path = (OVERLAYS / page).as_posix().lstrip("/")
    source = {"is_local_file": False, "url": f"http://absolute/{path}?{query}"} if query else {
        "is_local_file": True,
        "local_file": str(OVERLAYS / page),
    }
    return {
        **source,
        "width": W,
        "height": H,
        "fps": 30,
        "reroute_audio": False,
        "shutdown": replay,
        "restart_when_active": replay,
    }


def main() -> None:
    env = read_env(Path(os.environ.get("ENV_FILE", REPO_DIR / "hosts/server/.env")))
    channels = {c["id"]: c for c in json.loads((REPO_DIR / "config.json").read_text(encoding="utf-8"))["channels"]}

    def listen(cid: str) -> dict:
        key = f"OBS_{cid.upper()}_LISTEN_PASSPHRASE"
        if not env.get(key):
            sys.exit(f"{key} が .env にありません")
        c = channels[cid]
        return listener(c["obsListenPort"], env[key], c["srtLatencyUs"])

    # 入力の名前 → (種類, 設定, 音声のトラック)。トラックは 1〜6 のうち使用する番号。
    # Ch1 の音声は USB オーディオだけを使用し、ATEM の埋め込み音声はどのトラックにも入れない。
    # Ch3(トラック 1)への出し入れは ch3-audio.lua が表示中のシーンに合わせて行う。
    # CM はトラック 1 だけに入れる。CM のシーンをプログラムに出した時だけミキサーに入る。
    inputs = {
        CH1_VIDEO: ("ffmpeg_source", listen("ch1"), []),
        CH1_AUDIO: (audio_input_kind(), {}, [2]),
        CH2_VIDEO: ("ffmpeg_source", listen("ch2"), [3]),
        "テロップ 第一体育館": ("browser_source", browser("lower-third.html", False), []),
        "テロップ 遊撃": ("browser_source", browser("lower-third.html", False, "ch=ch2"), []),
        "時計": ("browser_source", browser("clock.html", False), []),
        "お知らせ": ("browser_source", browser("notice.html", False), []),
        "ウォーターマーク": ("browser_source", browser("watermark.html", False), []),
        "操作パネル": ("browser_source", browser("control.html", False), []),
        "待機画面": ("browser_source", browser("standby.html", True), []),
        "UP NEXT": ("browser_source", browser("upnext.html", True), []),
        "タイムテーブル": ("browser_source", browser("timetable.html", True), []),
        "2 画面 背景": ("browser_source", browser("split.html", True), []),
        # TODO: CM の動画が揃ったら、OBS でファイルを指定する(プレイリストにする場合は VLC ソース)。
        "CM": ("ffmpeg_source", {"is_local_file": True, "local_file": "", "looping": True, "restart_on_activate": True}, [1]),
    }

    full = {"bounds": (W, H), "pos": (0, 0)}
    # 画面の外。「[音声] 常時」の映像を置き、プログラムに映らないようにする。
    offscreen = {"bounds": (16, 9), "pos": (W + 100, 0)}
    # シーンの名前 → 下から順に並べる (入力の名前, 配置)。
    scenes = {
        # ch3-audio.lua が出力チャンネルにつなぎ、どのシーンを出していても音声をミキサーに入れる。
        "[音声] 常時": [(CH1_AUDIO, None), (CH2_VIDEO, offscreen)],
        # 操作パネル。OBS でソースを右クリックし「対話」で開いて操作する。出力には使用しない。
        "[操作] パネル": [("操作パネル", full)],
        "[出力] Ch1 第一体育館": [(CH1_VIDEO, full), ("テロップ 第一体育館", full), ("お知らせ", full), ("ウォーターマーク", full)],
        "[出力] Ch2 遊撃": [(CH2_VIDEO, full), ("テロップ 遊撃", full), ("お知らせ", full), ("ウォーターマーク", full)],
        "Ch3 待機": [("待機画面", full)],
        "Ch3 第一体育館": [(CH1_VIDEO, full), ("テロップ 第一体育館", full), ("時計", full), ("お知らせ", full), ("ウォーターマーク", full)],
        "Ch3 遊撃": [(CH2_VIDEO, full), ("テロップ 遊撃", full), ("時計", full), ("お知らせ", full), ("ウォーターマーク", full)],
        "Ch3 2 画面": [
            ("2 画面 背景", full),
            (CH1_VIDEO, {"bounds": (PANE_W, PANE_H), "pos": PANE_L}),
            (CH2_VIDEO, {"bounds": (PANE_W, PANE_H), "pos": PANE_R}),
            ("お知らせ", full),
        ],
        "Ch3 UP NEXT": [("UP NEXT", full)],
        "Ch3 タイムテーブル": [("タイムテーブル", full)],
        "Ch3 CM": [("CM", full)],
    }

    cl = obs.ReqClient(host="127.0.0.1", port=4455, password=websocket_password(), timeout=10)

    if COLLECTION not in cl.get_scene_collection_list().scene_collections:
        cl.create_scene_collection(COLLECTION)
        print(f"シーンコレクション {COLLECTION} を作成しました")
    elif cl.get_scene_collection_list().current_scene_collection_name != COLLECTION:
        cl.set_current_scene_collection(COLLECTION)

    existing_scenes = {s["sceneName"] for s in cl.get_scene_list().scenes}
    existing_inputs = {i["inputName"] for i in cl.get_input_list().inputs}

    for scene, items in scenes.items():
        if scene in existing_scenes:
            print(f"既存: {scene}")
            continue
        cl.create_scene(scene)
        for name, place in items:
            kind, settings, _ = inputs[name]
            if name in existing_inputs:
                item_id = cl.create_scene_item(scene, name, True).scene_item_id
            else:
                item_id = cl.create_input(scene, name, kind, settings, True).scene_item_id
                existing_inputs.add(name)
            if place:
                bw, bh = place["bounds"]
                x, y = place["pos"]
                cl.set_scene_item_transform(scene, item_id, {
                    "positionX": x, "positionY": y, "alignment": 5,
                    "boundsType": "OBS_BOUNDS_SCALE_INNER", "boundsAlignment": 0,
                    "boundsWidth": bw, "boundsHeight": bh,
                })
        print(f"作成: {scene}")

    for name, (kind, settings, tracks) in inputs.items():
        if settings:
            cl.set_input_settings(name, settings, True)
        cl.set_input_audio_tracks(name, {str(t): t in tracks for t in range(1, 7)})

    # OBS の初期のシーン(「シーン」)は使用しないので削除する。
    if "シーン" in {s["sceneName"] for s in cl.get_scene_list().scenes}:
        cl.set_current_program_scene("Ch3 待機")
        cl.remove_scene("シーン")
    cl.set_current_program_scene("Ch3 待機")
    print("完了。ch3-audio.lua の追加、Ch1 の USB オーディオのデバイスと同期オフセットの設定は OBS で行ってください")


if __name__ == "__main__":
    main()
