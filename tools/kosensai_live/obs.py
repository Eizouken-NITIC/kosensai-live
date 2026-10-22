"""本部 OBS を、シーンの構成(hosts/obs/scenes.json)、config.json・.env、その年の中身(kosensai-live-assets)から
obs-websocket で設定する。

    uv run kosensai-live obs build      # シーンコレクション・プロファイル・obs-multi-rtmp の出力を設定する
    uv run kosensai-live --assets <kosensai-live-assets の場所> obs build
    uv run kosensai-live obs devices    # 音声入力のデバイスの名前を表示する(scenes.json の device に書く)

起動中の OBS に接続する。scenes.json のシーンは項目(ソース)の有無・並び・配置を scenes.json に合わせる。
項目の表示・非表示は channels.lua が切り替えるため、新しく作る項目にだけ設定する。
scenes.json に無いシーンには手を加えない。ソースの設定(SRT の URL とパスフレーズ、ページのファイルの場所、音声のデバイス)、音声のトラック、
映像の形式、obs-multi-rtmp の出力は毎回上書きする。
obs-websocket のパスワードは同じ PC の OBS の設定ファイルから読む。
"""

import json
import os
import socket
import sys
import time
from pathlib import Path
from urllib.parse import parse_qsl, quote, urlencode

import obsws_python as obs
from obsws_python.error import OBSSDKRequestError

from . import config, urls

WEBSOCKET_HOST, WEBSOCKET_PORT = "127.0.0.1", 4455
HOST_DIR = config.REPO / "hosts/obs"
OVERLAYS = HOST_DIR / "overlays"
SCENES_JSON = HOST_DIR / "scenes.json"
# スライドショーに使う画像の拡張子
SLIDE_EXTENSIONS = {".png", ".jpg", ".jpeg"}
# obs-websocket の要求の結果のコード OutputRunning
OBS_OUTPUT_RUNNING = 500
SOURCE_RECORD_URL = "https://github.com/exeldro/obs-source-record/releases/tag/0.4.8"
# Source Record の record_mode の「録画」(OBS の録画の開始・停止に合わせる)
SOURCE_RECORD_MODE_RECORDING = 3
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
    return obs.ReqClient(host=WEBSOCKET_HOST, port=WEBSOCKET_PORT, password=password, timeout=10)


def platform_value(spec: dict, what: str):
    """scenes.json の OS ごとの値 {"win32": ..., "darwin": ...} から、この OS の値を選ぶ。"""
    if sys.platform not in spec:
        sys.exit(f"scenes.json の {what} に {sys.platform} の値がありません")
    return spec[sys.platform]


def audio_input_kind() -> str:
    return platform_value({"win32": "wasapi_input_capture", "darwin": "coreaudio_input_capture",
                           "linux": "pulse_input_capture"}, "音声入力の種類")


def absolute_path(path: Path) -> str:
    """OBS がローカルファイルに使用する http://absolute/<パス> の、<パス> の部分(先頭に / を付ける)。"""
    return "/" + path.as_posix().lstrip("/")


def browser(page: str, replay: bool, assets: Path, query: str = "") -> dict:
    # replay=True の画面は表示するたびに読み込み直して入りのアニメーションを再生する。
    # 画面は進行を ?assets= の場所から読む(overlays/overlay.js)。引数を付けるため、全ての画面を
    # OBS がローカルファイルに使用する http://absolute/<パス> の URL で開く。
    # TODO: Windows で http://absolute/C:/... の形で開けることを本番機で確認する(macOS では確認済み)。
    # フレームレートは指定しない(fps_custom が無効なら OBS の映像のフレームレートで描画する)。
    params = urlencode({"assets": absolute_path(assets), **dict(parse_qsl(query))})
    return {
        "is_local_file": False,
        "url": f"http://absolute{quote(absolute_path(OVERLAYS / page))}?{params}",
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
    # 作成した直後のプロファイルは OBS が basic.ini を書き出すまで待つ。
    for _ in range(PROFILE_WAIT_SEC * 10):
        for ini in (obs_config_dir() / "basic/profiles").glob("*/basic.ini"):
            if f"\nName={name}\n" in "\n" + ini.read_text(encoding="utf-8-sig"):
                return ini.parent
        time.sleep(0.1)
    sys.exit(f"プロファイル {name} のフォルダが見つかりません")


def multi_rtmp_config(conf: dict, env: dict, scenes: dict) -> dict:
    """obs-multi-rtmp(0.7.4)の設定ファイル(プロファイルの obs-multi-rtmp.json)の内容。"""
    out = scenes["outputs"]
    encoder = platform_value(scenes["video_encoder"], "video_encoder")
    targets, videos, audios = [], [], []
    for o in out["channels"]:
        cid = o["channel"]
        c = config.channel(conf, cid)
        video = {
            "id": f"v-{cid}",
            "encoder": encoder,
            "fps-denumerator": 1,
            "param": {**out["video_param"], "bitrate": c["bitrateKbps"]},
        }
        # scene が無い出力はプログラム(OBS のシーンの切り替え)をそのまま送出する。
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
    """プロファイルと映像の形式を設定する。"""
    name = scenes["profile"]
    # プロファイルの作成と切り替えは必要な時だけ行う(OBS 32.1.2 の macOS で、obs-websocket からの
    # 作成・切り替え・削除を続けて行うと OBS が落ちることがあった)。
    profiles = cl.get_profile_list()
    if name not in profiles.profiles:
        cl.create_profile(name)
        print(f"プロファイル {name} を作成しました")
    elif profiles.current_profile_name != name:
        cl.set_current_profile(name)

    # 出力中は obs-websocket が映像の設定の変更を拒否する(OutputRunning)。出力中かどうかを GetOutputList で
    # 調べないのは Source Record を入れた OBS 32.1.2 で GetOutputList の出力の列挙の中で OBS が落ちたため。
    w, h, num, den, _ = config.video_mode(conf)
    try:
        cl.set_video_settings(num, den, w, h, w, h)
    except OBSSDKRequestError as e:
        if e.code != OBS_OUTPUT_RUNNING:
            raise
        sys.exit("出力中(配信・録画)のため設定できません。停止してから実行してください")
    print(f"プロファイル {name}: {conf['video']['mode']}")


def profile_parameters(scenes: dict) -> list[tuple[str, str, str]]:
    """プロファイル(basic.ini)に書く (セクション, キー, 値)。

    プログラム(Ch3)の録画は OBS の通常の録画で、出力の「シンプル」の配信のエンコーダーの設定を使う
    (録画の品質「配信と同じ」)。配信は obs-multi-rtmp が行うため、この設定は録画だけに使われる。
    """
    rec = scenes["recordings"]
    return [
        ("Output", "Mode", "Simple"),
        ("SimpleOutput", "StreamEncoder", platform_value(rec["program_encoder"], "recordings.program_encoder")),
        ("SimpleOutput", "VBitrate", str(rec["video_param"]["bitrate"])),
        ("SimpleOutput", "ABitrate", str(rec["audio_bitrate"])),
        ("SimpleOutput", "RecQuality", "Stream"),
        ("SimpleOutput", "RecFormat2", rec["format"]),
    ]


def set_ini(path: Path, values: list[tuple[str, str, str]]) -> None:
    """INI ファイルの値を、他の行の並びと書式を変えずに書き換える。"""
    lines = path.read_text(encoding="utf-8-sig").splitlines()
    for section, key, value in values:
        if f"[{section}]" not in lines:
            lines += ["", f"[{section}]", f"{key}={value}"]
            continue
        start = lines.index(f"[{section}]")
        end = next((i for i in range(start + 1, len(lines)) if lines[i].startswith("[")), len(lines))
        for i in range(start + 1, end):
            if lines[i].startswith(f"{key}="):
                lines[i] = f"{key}={value}"
                break
        else:
            lines.insert(start + 1, f"{key}={value}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_while_closed(cl: obs.ReqClient, conf: dict, env: dict, scenes: dict, filters_changed: bool) -> None:
    """プロファイルと obs-multi-rtmp の設定を、OBS の終了後に書き込む。

    obs-multi-rtmp は設定ファイルを OBS の起動時(とプロファイルの切り替え時)に読み、終了時に書き戻す。
    プロファイルの出力の設定は、起動中に obs-websocket で変えると録画の出力と食い違う(拡張子だけが
    変わり、エンコーダーは変わらなかった)。どちらも OBS の終了後に書き込み、起動し直して読ませる。
    録画のフィルターの設定を変えた場合も、起動中に録画を始めると OBS が落ちたため、起動し直す。
    """
    profile = profile_dir(scenes["profile"])
    rtmp_path = profile / "obs-multi-rtmp.json"
    rtmp = json.dumps(multi_rtmp_config(conf, env, scenes), ensure_ascii=False, indent=1)
    rtmp_changed = not rtmp_path.is_file() or json.loads(rtmp_path.read_text(encoding="utf-8-sig")) != json.loads(rtmp)
    params = [(c, k, v) for c, k, v in profile_parameters(scenes) if cl.get_profile_parameter(c, k).parameter_value != v]
    reasons = (["obs-multi-rtmp の出力"] if rtmp_changed else []) + (["Ch3 の録画の設定"] if params else []) \
        + (["Ch1・Ch2 の録画のフィルター"] if filters_changed else [])
    if not reasons:
        print("OBS の再起動: 不要")
        return
    print(f"{'・'.join(reasons)}を反映するため、OBS を終了してください(終了を待っています)")
    # obs-multi-rtmp は OBS の終了の始めに設定を書き戻し、obs-websocket はその後に止まる。
    # WebSocket のポートに接続できなくなったら、書き戻しは終わっている。
    cl.disconnect()
    while True:
        try:
            socket.create_connection((WEBSOCKET_HOST, WEBSOCKET_PORT), timeout=1).close()
        except OSError:
            break
        time.sleep(1)
    if rtmp_changed:
        rtmp_path.write_text(rtmp, encoding="utf-8")
    if params:
        set_ini(profile / "basic.ini", params)
    print("書き込みました。OBS を起動してください")


def apply_recordings(cl: obs.ReqClient, scenes: dict) -> bool:
    """録画のシーンに Source Record のフィルターを付ける。OBS の「録画開始」で、プログラムの録画と一緒に始まる。

    フィルターを作成・変更したら True を返す。
    """
    rec = scenes["recordings"]
    changed = False
    for r in rec["scenes"]:
        settings = {
            **rec["video_param"],
            "encoder": platform_value(scenes["video_encoder"], "video_encoder"),
            "record_mode": SOURCE_RECORD_MODE_RECORDING,
            "rec_format": rec["format"],
            # 同時に始まる録画のファイル名が重ならないよう、名前を付ける。保存先は OBS の録画の設定に従う。
            "filename_formatting": f"%CCYY-%MM-%DD %hh-%mm-%ss {r['name']}",
            # シーンの音声ではなく、会場の音声のトラック(配信休止のミュートも反映される)を録る。
            "different_audio": True,
            "audio_track": r["track"],
            "audio_encoder": "ffmpeg_aac",
            "audio_bitrate": rec["audio_bitrate"],
        }
        # Source Record は出力にフィルターの名前を付けるため、フィルターごとに別の名前にする
        # (同じ名前の出力があると、一方しか録画されない)。
        name = f"録画 {r['name']}"
        current = {f["filterName"]: f["filterSettings"] for f in cl.get_source_filter_list(r["scene"]).filters}
        if name not in current:
            cl.create_source_filter(r["scene"], name, "source_record_filter", settings)
            changed = True
        elif any(current[name].get(k) != v for k, v in settings.items()):
            cl.set_source_filter_settings(r["scene"], name, settings, True)
            changed = True
    print(f"録画: {', '.join(r['scene'] for r in rec['scenes'])}{'(変更あり)' if changed else ''}")
    return changed


def slides(assets: Path, scenes: dict, behavior: str) -> dict:
    """CM のスライドショー。assets の cm.folder の画像をファイル名の順に表示する。

    スライドショーにフォルダを渡すと、ファイルシステムが返す順(名前の順とは限らない)になるため、
    名前の順に並べた画像の一覧を渡す。画像を足した後は obs build を実行し直す。
    """
    cm = scenes["cm"]
    folder = assets / cm["folder"]
    if not folder.is_dir():
        sys.exit(f"CM のスライドのフォルダ {folder} がありません")
    files = sorted(p for p in folder.iterdir() if p.suffix.lower() in SLIDE_EXTENSIONS)
    return {
        "files": [{"value": str(f), "selected": False, "hidden": False} for f in files],
        "slide_time": int(cm["slide_sec"] * 1000),
        "transition": "fade",
        "loop": True,
        "slide_mode": "mode_auto",
        "playback_behavior": behavior,
        "use_custom_size": "1920x1080",
    }


def build(env_path, assets: Path) -> None:
    conf = config.load_config()
    env = config.load_env(env_path)
    scenes = json.loads(SCENES_JSON.read_text(encoding="utf-8"))
    assets = Path(os.path.abspath(assets))
    if not (assets / "program.json").is_file():
        sys.exit(f"{assets} に program.json がありません。--assets で kosensai-live-assets の場所を指定してください")
    print(f"assets: {assets}")
    cl = connect()
    if "source_record_filter" not in cl.get_source_filter_kind_list().source_filter_kinds:
        sys.exit(f"Source Record のプラグインがありません。{SOURCE_RECORD_URL} からインストールしてください")

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
                # デバイスは作成後に OBS が返すデバイスの一覧から選ぶ(audio_device_id)。
                return audio_input_kind(), {}
            case "page":
                return "browser_source", browser(spec["page"], spec.get("replay", False), assets, spec.get("query", ""))
            case "slides":
                # always_play: 表示していない間も進む(全画面の CM)。pause_unpause: 隠すと止まり、
                # 次に表示すると続きから進む(自動の CM。毎回、前回の続きのスライドから出す)。
                return "slideshow_v2", slides(assets, scenes, spec["behavior"])
            case "media":
                # 動画・音楽のファイルは OBS で指定する。ファイルが無ければ何も出ない(BGM の既定は無音)。
                # restart が false の入力(BGM)は、同じ入力を持つシーンの間で切り替えても続きから再生する。
                return "ffmpeg_source", {"is_local_file": True, "looping": spec.get("loop", True),
                                         "restart_on_activate": spec.get("restart", True)}
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
        created = scene not in existing_scenes
        if created:
            cl.create_scene(scene)
        current = sorted(cl.get_scene_item_list(scene).scene_items, key=lambda i: i["sceneItemIndex"])
        before = [i["sourceName"] for i in current]
        ids = []
        for item in items:
            name = item["source"]
            # 同じソースの既存の項目があれば使い、表示・非表示はそのままにする。
            match = next((i for i in current if i["sourceName"] == name), None)
            if match:
                current.remove(match)
                item_id = match["sceneItemId"]
            elif name in existing_inputs:
                item_id = cl.create_scene_item(scene, name, not item.get("hidden", False)).scene_item_id
            else:
                kind, settings = inputs[name]
                item_id = cl.create_input(scene, name, kind, settings, not item.get("hidden", False)).scene_item_id
                existing_inputs.add(name)
            ids.append(item_id)
            if "place" in item:
                p = scenes["places"][item["place"]]
                cl.set_scene_item_transform(scene, item_id, {
                    "positionX": p["x"], "positionY": p["y"], "alignment": 5,
                    "boundsType": "OBS_BOUNDS_SCALE_INNER", "boundsAlignment": 0,
                    "boundsWidth": p["w"], "boundsHeight": p["h"],
                })
        # scenes.json に無い項目は削除する。
        for extra in current:
            cl.remove_scene_item(scene, extra["sceneItemId"])
        for index, item_id in enumerate(ids):
            cl.set_scene_item_index(scene, item_id, index)
        after = [i["source"] for i in items]
        print(f"{'作成' if created else '更新' if before != after else '変更なし'}: {scene}")

    # 設定は今の値に重ねて書く(overlay)ので、OBS で指定した BGM の音楽のファイルは消えない。
    for name, spec in scenes["inputs"].items():
        _, settings = inputs[name]
        if spec["type"] == "audio":
            device_id = audio_device_id(cl, name, spec.get("device"))
            if device_id is not None:
                settings = {"device_id": device_id}
        if settings:
            cl.set_input_settings(name, settings, True)
        # URL が変わらない場合、ブラウザソースは読み込み直さない。program.json の変更を反映するため読み込み直す。
        if spec["type"] == "page":
            cl.press_input_properties_button(name, "refreshnocache")
        # スライドショーには音声が無い(obs-websocket が音声のトラックの設定を断る)。
        if spec["type"] != "slides":
            tracks = spec.get("tracks", [])
            cl.set_input_audio_tracks(name, {str(t): t in tracks for t in range(1, 7)})
        # 会場の音声のモニターは channels.lua が Ch3 に合わせて切り替える。ここでは固定のものだけを設定する。
        if spec.get("monitor"):
            cl.set_input_audio_monitor_type(name, "OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT")

    filters_changed = apply_recordings(cl, scenes)

    # OBS の初期のシーン(「シーン」)は使用しないので削除する。
    program = scenes["program_scene"]
    if "シーン" in {s["sceneName"] for s in cl.get_scene_list().scenes}:
        cl.set_current_program_scene(program)
        cl.remove_scene("シーン")
    cl.set_current_program_scene(program)

    write_while_closed(cl, conf, env, scenes, filters_changed)
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
