"""ATEM・スマートフォンの SRT を本部 PC で受け、OBS へ TCP で渡す。

    uv run kosensai-live relay [--ffmpeg <ffmpeg の場所>]

config.json の obsListenPort を持つ Ch ごとに、tcp://127.0.0.1:<relayPort> で OBS の接続を待つ。
OBS が接続したら ffmpeg を起動し、SRT Listener で受けた MPEG-TS を標準出力から OBS へそのまま送る。

OBS のメディアソースは、入力が切断した後も待ち受けのソケットを閉じずに持ち続け、同じポートで
待ち受け直せなくなる(SRT・UDP のどちらでも起きた)。待ち受けは中継が行い、OBS は接続する側にする。

OBS は受け取った最初のデータから実時間で再生するため、OBS に渡す前に溜まったデータは、そのまま
遅れとして残る。OBS が接続してから SRT の受信を始め、ffmpeg の入力の解析も最小限にして、溜めない。
送信元が切断すると ffmpeg が終了し、OBS への接続を閉じる(OBS は映像が消えたことを検出し、
接続し直す)。OBS が切断した場合は ffmpeg を終了させる。

OBS のホットキーの「<会場> SRT を受け直す」は、RESTART_DIR に restart-<Ch> のファイルを作る。
このファイルを見つけたら、その Ch の ffmpeg を終了させる。
"""

import os
import shutil
import socket
import subprocess
import sys
import threading
import time

from . import config, urls

# 受け直しのファイルを確かめる間隔(秒)
POLL_SEC = 0.5
# ffmpeg の標準出力から一度に読む大きさ
CHUNK = 64 * 1024
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
    # MPEG-TS は PMT からコーデックが分かるため、入力の解析は最小限にする(既定では最大 5 秒分を読んでから出力する)。
    # 映像と音声だけを渡し、-max_interleave_delta 0 で出力の並べ直しの待ちを無くす(既定では、間隔の空いた
    # ストリームのパケットを最大 10 秒待つ)。-muxdelay 0 は MPEG-TS の muxer の既定の 0.7 秒の遅延を無くす。
    return [ffmpeg, "-hide_banner", "-nostdin", "-nostats", "-loglevel", "warning",
            "-fflags", "nobuffer", "-probesize", "32768", "-analyzeduration", "0",
            "-i", urls.listen_url(conf, env, cid),
            "-map", "0:v", "-map", "0:a", "-c", "copy", "-max_interleave_delta", "0", "-muxdelay", "0",
            "-flush_packets", "1", "-f", "mpegts", "pipe:1"]


def pump(proc, conn):
    """ffmpeg の標準出力を OBS へ送る。どちらかが終わったら戻る。"""
    fd = proc.stdout.fileno()
    try:
        while data := os.read(fd, CHUNK):
            conn.sendall(data)
    except OSError:
        pass


def serve(conn, cmd, cid, flag):
    flag.unlink(missing_ok=True)
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    t = threading.Thread(target=pump, args=(proc, conn), daemon=True)
    t.start()
    while t.is_alive():
        if flag.exists():
            log(cid, "受け直しの要求で ffmpeg を終了する")
            flag.unlink(missing_ok=True)
            break
        t.join(POLL_SEC)
    proc.terminate()
    proc.wait()
    conn.close()
    log(cid, f"ffmpeg が終了した(終了コード {proc.returncode})。OBS への接続を閉じた")


def run_channel(conf, cmd, cid):
    port = config.channel(conf, cid)["relayPort"]
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.bind(("127.0.0.1", port))
    server.listen(1)
    flag = RESTART_DIR / f"restart-{cid}"
    log(cid, f"OBS の接続を待つ({urls.relay_url(conf, cid)})")
    while True:
        conn, _ = server.accept()
        conn.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        log(cid, f"OBS が接続した。SRT の待ち受けを開始する(:{config.channel(conf, cid)['obsListenPort']})")
        serve(conn, cmd, cid, flag)


def main(env_path, ffmpeg_path):
    conf = config.load_config()
    env = config.load_env(env_path)
    ffmpeg = find_ffmpeg(ffmpeg_path)
    log("relay", f"ffmpeg: {ffmpeg}")
    RESTART_DIR.mkdir(exist_ok=True)
    threads = [threading.Thread(target=run_channel, args=(conf, command(ffmpeg, conf, env, cid), cid), daemon=True)
               for cid in config.channel_ids(conf, listen=True)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
