# /// script
# requires-python = ">=3.11"
# dependencies = ["obsws-python==1.8.0"]
# ///
"""本部 OBS のシーンコレクションを、今年の構成(assets/scenes.json)から obs-websocket で作る。

起動中の OBS に接続し、無いシーンとソースだけを作る。既にあるシーンには手を加えない。
ソースの設定(SRT の URL とパスフレーズ、テロップのファイルの場所)と音声のトラックは毎回上書きする。

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
ASSETS = HOST_DIR / "assets"
W, H = 1920, 1080


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
    conf = json.loads((ASSETS / "scenes.json").read_text(encoding="utf-8"))

    def listen(cid: str) -> dict:
        key = f"OBS_{cid.upper()}_LISTEN_PASSPHRASE"
        if not env.get(key):
            sys.exit(f"{key} が .env にありません")
        c = channels[cid]
        return listener(c["obsListenPort"], env[key], c["srtLatencyUs"])

    # scenes.json の入力の種類 → (OBS の入力の種類, 設定)。
    def source(spec: dict) -> tuple[str, dict]:
        match spec["type"]:
            case "srt":
                return "ffmpeg_source", listen(spec["channel"])
            case "audio":
                return audio_input_kind(), {}
            case "page":
                return "browser_source", browser(spec["page"], spec.get("replay", False), spec.get("query", ""))
            case "media":
                # 動画のファイルは OBS で指定する。
                return "ffmpeg_source", {"is_local_file": True, "looping": True, "restart_on_activate": True}
        sys.exit(f"scenes.json の入力の種類 {spec['type']} は使用できません")

    inputs = {name: (*source(spec), spec.get("tracks", [])) for name, spec in conf["inputs"].items()}
    collection = conf["collection"]
    cl = obs.ReqClient(host="127.0.0.1", port=4455, password=websocket_password(), timeout=10)

    if collection not in cl.get_scene_collection_list().scene_collections:
        cl.create_scene_collection(collection)
        print(f"シーンコレクション {collection} を作成しました")
    elif cl.get_scene_collection_list().current_scene_collection_name != collection:
        cl.set_current_scene_collection(collection)

    existing_scenes = {s["sceneName"] for s in cl.get_scene_list().scenes}
    existing_inputs = {i["inputName"] for i in cl.get_input_list().inputs}

    # シーンの項目は下から順に並べる。hidden の項目(配信休止)は channels.lua が必要な時だけ表示する。
    for scene, items in conf["scenes"].items():
        if scene in existing_scenes:
            print(f"既存: {scene}")
            continue
        cl.create_scene(scene)
        for item in items:
            name = item["source"]
            kind, settings, _ = inputs[name]
            visible = not item.get("hidden", False)
            if name in existing_inputs:
                item_id = cl.create_scene_item(scene, name, visible).scene_item_id
            else:
                item_id = cl.create_input(scene, name, kind, settings, visible).scene_item_id
                existing_inputs.add(name)
            if "place" in item:
                p = conf["places"][item["place"]]
                cl.set_scene_item_transform(scene, item_id, {
                    "positionX": p["x"], "positionY": p["y"], "alignment": 5,
                    "boundsType": "OBS_BOUNDS_SCALE_INNER", "boundsAlignment": 0,
                    "boundsWidth": p["w"], "boundsHeight": p["h"],
                })
        print(f"作成: {scene}")

    # 設定は今の値に重ねて書く(overlay)ので、OBS で指定した CM の動画のファイルは消えない。
    for name, (kind, settings, tracks) in inputs.items():
        if settings:
            cl.set_input_settings(name, settings, True)
        cl.set_input_audio_tracks(name, {str(t): t in tracks for t in range(1, 7)})

    # OBS の初期のシーン(「シーン」)は使用しないので削除する。
    program = conf["program_scene"]
    if "シーン" in {s["sceneName"] for s in cl.get_scene_list().scenes}:
        cl.set_current_program_scene(program)
        cl.remove_scene("シーン")
    cl.set_current_program_scene(program)
    print("完了。channels.lua の追加、Ch1 の USB オーディオのデバイスと同期オフセットの設定は OBS で行ってください")


if __name__ == "__main__":
    main()
