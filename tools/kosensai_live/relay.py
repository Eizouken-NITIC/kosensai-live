"""ATEM・スマートフォンの SRT を本部 PC で受け、OBS へ TCP で渡す。

    uv run kosensai-live relay [--ffmpeg <ffmpeg の場所>]

config.json の obsListenPort を持つ Ch ごとに ffmpeg を 1 つ起動し、SRT Listener で受けた MPEG-TS を
tcp://127.0.0.1:<relayPort> で待ち受けて、接続した OBS へそのまま送る。

OBS のメディアソースは、入力が切断した後も待ち受けのソケットを閉じずに持ち続け、同じポートで
待ち受け直せなくなる(SRT・UDP のどちらでも起きた)。待ち受けは中継が行い、OBS は接続する側にする。
送信元が切断すると ffmpeg は終了して TCP も切れ、OBS は映像が消えたことを検出する。relay は ffmpeg を
すぐに起動し直す。

OBS のホットキーの「<会場> SRT を受け直す」は、RESTART_DIR に restart-<Ch> のファイルを作る。
このファイルを見つけたら、その Ch の ffmpeg を終了させて起動し直す。
"""

import shutil
import subprocess
import sys
import threading
import time

from . import config, urls

# ffmpeg が終了してから起動し直すまでの秒数
RESTART_DELAY_SEC = 1
# 受け直しのファイルを確かめる間隔(秒)
POLL_SEC = 0.5
# channels.lua と同じ場所(hosts/obs/.relay)
RESTART_DIR = config.REPO / "hosts/obs/.relay"


def log(cid, message):
    print(f"{time.strftime('%m-%d %H:%M:%S')} [{cid}] {message}", flush=True)


def find_ffmpeg(path) -> str:
    ffmpeg = shutil.which(path or "ffmpeg")
    if ffmpeg is None:
        sys.exit(f"ffmpeg ({path or 'PATH'}) がありません。--ffmpeg で場所を指定してください")
    protocols = subprocess.run([ffmpeg, "-hide_banner", "-protocols"], capture_output=True, text=True,
                               check=True).stdout.split()
    if "srt" not in protocols:
        sys.exit(f"{ffmpeg} は SRT に対応していません")
    return ffmpeg


def command(ffmpeg, conf, env, cid):
    # -muxdelay 0: MPEG-TS の muxer の既定の 0.7 秒の遅延を無くす。
    # TCP の待ち受けは SRT の送信元が接続した後に始まり、OBS が接続するまで待つ。
    return [ffmpeg, "-hide_banner", "-nostdin", "-nostats", "-loglevel", "warning",
            "-i", urls.listen_url(conf, env, cid),
            "-map", "0", "-c", "copy", "-muxdelay", "0", "-flush_packets", "1",
            "-f", "mpegts", urls.relay_url(conf, cid) + "?listen=1"]


def run_channel(conf, cmd, cid, procs):
    flag = RESTART_DIR / f"restart-{cid}"
    while True:
        flag.unlink(missing_ok=True)
        log(cid, f"待ち受けを開始する(SRT :{config.channel(conf, cid)['obsListenPort']} → {urls.relay_url(conf, cid)})")
        proc = subprocess.Popen(cmd)
        procs[cid] = proc
        while proc.poll() is None:
            if flag.exists():
                log(cid, "受け直しの要求で ffmpeg を終了する")
                proc.terminate()
                proc.wait()
                break
            time.sleep(POLL_SEC)
        log(cid, f"ffmpeg が終了した(終了コード {proc.returncode})")
        time.sleep(RESTART_DELAY_SEC)


def main(env_path, ffmpeg_path):
    conf = config.load_config()
    env = config.load_env(env_path)
    ffmpeg = find_ffmpeg(ffmpeg_path)
    log("relay", f"ffmpeg: {ffmpeg}")
    RESTART_DIR.mkdir(exist_ok=True)
    procs = {}
    threads = [threading.Thread(target=run_channel, args=(conf, command(ffmpeg, conf, env, cid), cid, procs), daemon=True)
               for cid in config.channel_ids(conf, listen=True)]
    try:
        for t in threads:
            t.start()
        for t in threads:
            t.join()
    finally:
        # 残った ffmpeg が待ち受けのポートを持ち続けないように、終了させる。
        for proc in procs.values():
            if proc.poll() is None:
                proc.terminate()
