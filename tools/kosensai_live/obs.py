"""本部 OBS を、今年の構成(hosts/obs/assets/scenes.json)と config.json・.env から obs-websocket で設定する。

    uv run kosensai-live obs build      # シーンコレクション・プロファイル・obs-multi-rtmp の出力を設定する
    uv run kosensai-live obs devices    # 音声入力のデバイスの名前を表示する(scenes.json の device に書く)

起動中の OBS に接続する。シーンは無いものだけを作り、既にあるシーンには手を加えない。
ソースの設定(SRT の URL とパスフレーズ、ページのファイルの場所、音声のデバイス)、音声のトラック、
映像の形式、obs-multi-rtmp の出力は毎回上書きする。
obs-websocket のパスワードは、同じ PC の OBS の設定ファイルから読む。
"""

import json
import os
import sys
import time
from pathlib import Path

import obsws_python as obs

from . import config, urls

HOST_DIR = config.REPO / "hosts/obs"
OVERLAYS = HOST_DIR / "overlays"
SCENES_JSON = HOST_DIR / "assets/scenes.json"
# obs build がプロファイルを切り替える時に一時的に作るプロファイル
TEMP_PROFILE = "kosensai-live-build"
# 作成したプロファイルの basic.ini が書き出されるまで待つ秒数
PROFILE_WAIT_SEC = 5


def obs_config_dir() -> Path:
    if sys.platform == "win32":
        return Path(os.environ["APPDATA"]) / "obs-studio"
    if sys.platform == "darwin":
        return Path.home() / "Library/Application Support/obs-studio"
    return Path.home() / ".config/obs-studio"


def connect() -> obs.ReqClient:
    password = os.environ.get("OBS_WEBSOCKET_PASSWORD")
    if password is None:
        conf = json.loads((obs_config_dir() / "plugin_config/obs-websocket/config.json").read_text())
        if not conf.get("server_enabled"):
            sys.exit("OBS の「ツール → WebSocket サーバー設定」でサーバーを有効にしてください")
        password = conf["server_password"]
    return obs.ReqClient(host="127.0.0.1", port=4455, password=password, timeout=10)


def platform_value(spec: dict, what: str):
    """scenes.json の OS ごとの値 {"win32": ..., "darwin": ...} から、この OS の値を選ぶ。"""
    if sys.platform not in spec:
        sys.exit(f"scenes.json の {what} に {sys.platform} の値がありません")
    return spec[sys.platform]


def audio_input_kind() -> str:
    return platform_value({"win32": "wasapi_input_capture", "darwin": "coreaudio_input_capture",
                           "linux": "pulse_input_capture"}, "音声入力の種類")


def browser(page: str, replay: bool, query: str = "") -> dict:
    # replay=True の画面は、表示するたびに読み込み直して入りのアニメーションを再生する。
    # 引数付きで開く場合は、OBS がローカルファイルに使用する http://absolute/<パス> の URL で指定する。
    # TODO: Windows で http://absolute/C:/... の形で開けることを本番機で確認する(macOS では確認済み)。
    # フレームレートは指定しない(fps_custom が無効なら OBS の映像のフレームレートで描画する)。
    path = (OVERLAYS / page).as_posix().lstrip("/")
    source = {"is_local_file": False, "url": f"http://absolute/{path}?{query}"} if query else {
        "is_local_file": True,
        "local_file": str(OVERLAYS / page),
    }
    return {
        **source,
        "width": 1920,
        "height": 1080,
        "reroute_audio": False,
        "shutdown": replay,
        "restart_when_active": replay,
    }


def audio_device_id(cl: obs.ReqClient, input_name: str, device: str | None) -> str | None:
    """scenes.json の device(デバイスの名前の一部)に一致するデバイスの ID。device が無ければ None。"""
    if device is None:
        print(f"WARN  {input_name} の device が scenes.json にありません。OS の既定の入力を使用します")
        return None
    items = cl.get_input_properties_list_property_items(input_name, "device_id").property_items
    found = [i for i in items if device in i["itemName"]]
    if len(found) != 1:
        names = "\n  ".join(i["itemName"] for i in items)
        sys.exit(f"{input_name} の device {device!r} に一致するデバイスが {len(found)} 件あります。候補:\n  {names}")
    return found[0]["itemValue"]


def profile_dir(name: str) -> Path:
    # プロファイルのフォルダ名は名前と一致するとは限らない(記号を除く)ため、basic.ini の Name で探す。
    # 作成した直後のプロファイルは、OBS が basic.ini を書き出すまで待つ。
    for _ in range(PROFILE_WAIT_SEC * 10):
        for ini in (obs_config_dir() / "basic/profiles").glob("*/basic.ini"):
            if f"\nName={name}\n" in "\n" + ini.read_text(encoding="utf-8-sig"):
                return ini.parent
        time.sleep(0.1)
    sys.exit(f"プロファイル {name} のフォルダが見つかりません")


def multi_rtmp_config(conf: dict, env: dict, scenes: dict) -> dict:
    """obs-multi-rtmp(0.7.4)の設定ファイル(プロファイルの obs-multi-rtmp.json)の内容。"""
    out = scenes["outputs"]
    encoder = platform_value(out["video_encoder"], "outputs.video_encoder")
    targets, videos, audios = [], [], []
    for o in out["channels"]:
        cid = o["channel"]
        c = config.channel(conf, cid)
        video = {
            "id": f"v-{cid}",
            "encoder": encoder["id"],
            "fps-denumerator": 1,
            "param": {**encoder["param"], "bitrate": c["bitrateKbps"]},
        }
        # scene が無い出力は、プログラム(OBS のシーンの切り替え)をそのまま送出する。
        if "scene" in o:
            video["scene"] = o["scene"]
        videos.append(video)
        # mixerId は 0 から数えるトラックの番号
        audios.append({"id": f"a-{cid}", "encoder": "ffmpeg_aac", "param": {"bitrate": out["audio_bitrate"]},
                       "mixerId": o["track"] - 1, "audioTracks": []})
        targets.append({
            "id": f"t-{cid}",
            "name": f"{cid.upper()} {c['label']}",
            "protocol": "SRT_RIST",
            "service-param": {"server": urls.publish_url(conf, env, cid), "key": ""},
            "output-param": {},
            "sync-start": False,
            "sync-stop": False,
            "video-config": f"v-{cid}",
            "audio-config": f"a-{cid}",
        })
    return {"targets": targets, "video_configs": videos, "audio_configs": audios}


def apply_profile(cl: obs.ReqClient, conf: dict, env: dict, scenes: dict) -> None:
    """プロファイルの映像の形式と、obs-multi-rtmp の出力を設定する。"""
    active = [o["outputName"] for o in cl.get_output_list().outputs if o["outputActive"]]
    if active:
        sys.exit(f"出力中のため設定できません(停止してから実行してください): {', '.join(active)}")

    name = scenes["profile"]
    if name not in cl.get_profile_list().profiles:
        cl.create_profile(name)
        print(f"プロファイル {name} を作成しました")

    # obs-multi-rtmp は設定ファイルをプロファイルの切り替えの時に読み、OBS の終了時に書き戻す。
    # 書き込んだ後に読ませないと、終了時に古い設定で上書きされるため、別のプロファイルを経由して切り替え直す。
    if TEMP_PROFILE in cl.get_profile_list().profiles:
        cl.set_current_profile(TEMP_PROFILE)
    else:
        cl.create_profile(TEMP_PROFILE)
    (profile_dir(name) / "obs-multi-rtmp.json").write_text(
        json.dumps(multi_rtmp_config(conf, env, scenes), ensure_ascii=False, indent=1), encoding="utf-8")
    cl.set_current_profile(name)
    cl.remove_profile(TEMP_PROFILE)

    w, h, num, den, _ = config.video_mode(conf)
    cl.set_video_settings(num, den, w, h, w, h)
    print(f"プロファイル {name}: {conf['video']['mode']}、obs-multi-rtmp の出力 {len(scenes['outputs']['channels'])} 件")


def build(env_path) -> None:
    conf = config.load_config()
    env = config.load_env(env_path)
    scenes = json.loads(SCENES_JSON.read_text(encoding="utf-8"))
    cl = connect()

    # scenes.json の入力の種類 → (OBS の入力の種類, 設定)。
    def source(spec: dict) -> tuple[str, dict]:
        match spec["type"]:
            case "srt":
                return "ffmpeg_source", {
                    "is_local_file": False,
                    "input": urls.listen_url(conf, env, spec["channel"]),
                    "input_format": "mpegts",
                    "hw_decode": True,
                    "restart_on_activate": False,
                    "close_when_inactive": False,
                    "clear_on_media_end": False,
                    "reconnect_delay_sec": 1,
                    "buffering_mb": 1,
                }
            case "audio":
                # デバイスは作成後に、OBS が出すデバイスの一覧から選ぶ(audio_device_id)。
                return audio_input_kind(), {}
            case "page":
                return "browser_source", browser(spec["page"], spec.get("replay", False), spec.get("query", ""))
            case "media":
                # 動画のファイルは OBS で指定する。
                return "ffmpeg_source", {"is_local_file": True, "looping": True, "restart_on_activate": True}
        sys.exit(f"scenes.json の入力の種類 {spec['type']} は使用できません")

    inputs = {name: source(spec) for name, spec in scenes["inputs"].items()}
    collection = scenes["collection"]

    apply_profile(cl, conf, env, scenes)

    if collection not in cl.get_scene_collection_list().scene_collections:
        cl.create_scene_collection(collection)
        print(f"シーンコレクション {collection} を作成しました")
    elif cl.get_scene_collection_list().current_scene_collection_name != collection:
        cl.set_current_scene_collection(collection)

    existing_scenes = {s["sceneName"] for s in cl.get_scene_list().scenes}
    existing_inputs = {i["inputName"] for i in cl.get_input_list().inputs}

    # シーンの項目は下から順に並べる。hidden の項目(配信休止)は channels.lua が必要な時だけ表示する。
    for scene, items in scenes["scenes"].items():
        if scene in existing_scenes:
            print(f"既存: {scene}")
            continue
        cl.create_scene(scene)
        for item in items:
            name = item["source"]
            kind, settings = inputs[name]
            visible = not item.get("hidden", False)
            if name in existing_inputs:
                item_id = cl.create_scene_item(scene, name, visible).scene_item_id
            else:
                item_id = cl.create_input(scene, name, kind, settings, visible).scene_item_id
                existing_inputs.add(name)
            if "place" in item:
                p = scenes["places"][item["place"]]
                cl.set_scene_item_transform(scene, item_id, {
                    "positionX": p["x"], "positionY": p["y"], "alignment": 5,
                    "boundsType": "OBS_BOUNDS_SCALE_INNER", "boundsAlignment": 0,
                    "boundsWidth": p["w"], "boundsHeight": p["h"],
                })
        print(f"作成: {scene}")

    # 設定は今の値に重ねて書く(overlay)ので、OBS で指定した CM の動画のファイルは消えない。
    for name, spec in scenes["inputs"].items():
        _, settings = inputs[name]
        if spec["type"] == "audio":
            device_id = audio_device_id(cl, name, spec.get("device"))
            if device_id is not None:
                settings = {"device_id": device_id}
        if settings:
            cl.set_input_settings(name, settings, True)
        tracks = spec.get("tracks", [])
        cl.set_input_audio_tracks(name, {str(t): t in tracks for t in range(1, 7)})
        # 会場の音声のモニターは channels.lua が Ch3 に合わせて切り替える。ここでは固定のものだけを設定する。
        if spec.get("monitor"):
            cl.set_input_audio_monitor_type(name, "OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT")

    # OBS の初期のシーン(「シーン」)は使用しないので削除する。
    program = scenes["program_scene"]
    if "シーン" in {s["sceneName"] for s in cl.get_scene_list().scenes}:
        cl.set_current_program_scene(program)
        cl.remove_scene("シーン")
    cl.set_current_program_scene(program)
    print("完了")


def devices() -> None:
    scenes = json.loads(SCENES_JSON.read_text(encoding="utf-8"))
    cl = connect()
    for name, spec in scenes["inputs"].items():
        if spec["type"] != "audio":
            continue
        print(f"{name}(scenes.json の device: {spec.get('device')!r})")
        for i in cl.get_input_properties_list_property_items(name, "device_id").property_items:
            print(f"  {i['itemName']}")
