"""SRT の URL と視聴の URL を表示する。

Ch の定義は config.json から、パスフレーズと IP は .env（既定: hosts/server/.env）から読み込む。
本部 PC の中継（relay）の SRT Listener、OBS の入力、obs-multi-rtmp の出力は relay と obs build が
同じ関数で設定するため、ここでの表示は確認用である。スマートフォン（Moblin）には 1. の URL を入力する。

  uv run kosensai-live urls
  uv run kosensai-live urls --env path/to/.env
"""

from . import config

# 配信サーバーの SRT の待受ポート（hosts/server/mediamtx.yml の srtAddress）
MTX_PORT = 8890
# 本部 OBS → 配信サーバーの SRT の latency（マイクロ秒）
OUT_LATENCY_US = 120000


def listen_url(conf, env, cid):
    """本部 PC の中継（relay の ffmpeg）の SRT Listener の URL。FFmpeg の SRT の latency はマイクロ秒。"""
    c = config.channel(conf, cid)
    passphrase = config.require(env, config.listen_var(cid))
    return f"srt://0.0.0.0:{c['obsListenPort']}?mode=listener&passphrase={passphrase}&latency={c['srtLatencyUs']}"


def relay_url(conf, cid):
    """中継（relay）が待ち受け、OBS のメディアソースが接続する TCP の URL。"""
    return f"tcp://127.0.0.1:{config.channel(conf, cid)['relayPort']}"


def caller_url(conf, env, cid):
    """ATEM・スマートフォンの送信先。ATEM は URL のクエリを無視するため、パスフレーズは別に設定する。"""
    c = config.channel(conf, cid)
    return f"srt://{config.require_ipv4(env, 'HQ_IP')}:{c['obsListenPort']}"


def publish_url(conf, env, cid):
    """本部 OBS（obs-multi-rtmp）→ 配信サーバーの URL。"""
    passphrase = config.require(env, config.publish_var(cid))
    return (f"srt://{config.require_ipv4(env, 'SERVER_IP')}:{MTX_PORT}?streamid=publish:{cid}"
            f"&passphrase={passphrase}&latency={OUT_LATENCY_US}")


def main(env_path):
    env = config.load_env(env_path)
    conf = config.load_config()
    domain = conf["site"]["domain"]

    print("=" * 72)
    print(" 1. ATEM・スマートフォン → 本部 PC の中継（SRT Listener）→ 本部 OBS（TCP）")
    print("=" * 72)
    for c in conf["channels"]:
        if not c.get("obsListenPort"):
            print(f"\n[{c['label']}] OBS 内で合成するため入力はない")
            continue
        passphrase = config.require(env, config.listen_var(c["id"]))
        print(f"\n[{c['label']}]")
        print(f"  中継         {listen_url(conf, env, c['id'])}")
        print(f"  OBS          {relay_url(conf, c['id'])}")
        print(f"  送信先       {caller_url(conf, env, c['id'])}")
        print(f"  パスフレーズ {passphrase}")
        # Moblin（libsrt の URL）の latency はミリ秒
        print(f"  Moblin       {caller_url(conf, env, c['id'])}"
              f"?passphrase={passphrase}&latency={c['srtLatencyUs'] // 1000}")

    print()
    print("=" * 72)
    print(" 2. 本部 OBS（obs-multi-rtmp）→ 配信サーバー")
    print("=" * 72)
    for c in conf["channels"]:
        print(f"\n[{c['label']}] CBR {c['bitrateKbps']} kbps")
        print(f"  {publish_url(conf, env, c['id'])}")

    print()
    print("=" * 72)
    print(" 3. 視聴 URL")
    print("=" * 72)
    for c in conf["channels"]:
        print(f"  {c['label']:<18} https://{domain}/?ch={c['id']}")
    print(f"  {'サイネージ':<16} https://{domain}/signage/")
