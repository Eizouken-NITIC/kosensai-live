#!/bin/sh
# テストパターンを 1 チャンネル分 SRT で送出する。
#
#   publish.sh <チャンネル名> <パスフレーズ>
#
# 全チャンネルで映像はカラーバー、音声は 1kHz の基準音に揃える。チャンネルの
# 識別は映像へ焼き込んだテキストで行う。生成パターンや音程を振り分けて見分ける
# 方式は、コンテナにフォントが無かった時期の回避策であり、実機の信号とも異なる。
#
# 音声はチャンネル間で同じであるため、音だけで切替を判別することはできない。
# 判別は画面のテキストで行う。

set -eu

CH="$1"
PASS="$2"

SIZE="${REH_SIZE:-640x360}"
FPS="${REH_FPS:-15}"
BITRATE="${REH_BITRATE:-1200k}"
PRESET="${REH_PRESET:-ultrafast}"

FONT=/usr/share/fonts/dejavu/DejaVuSansMono-Bold.ttf
LABEL="$(echo "${CH}" | tr 'a-z' 'A-Z')"

# 上段にチャンネル名、下段に経過時刻を描く。経過時刻は遅延を目視するために使う。
DRAW="drawtext=fontfile=${FONT}:text='${LABEL}'"
DRAW="${DRAW}:x=(w-tw)/2:y=h*0.16:fontsize=h/7:fontcolor=white"
DRAW="${DRAW}:box=1:boxcolor=black@0.6:boxborderw=12"
DRAW="${DRAW},drawtext=fontfile=${FONT}:text='%{pts\\:hms}'"
DRAW="${DRAW}:x=(w-tw)/2:y=h*0.60:fontsize=h/11:fontcolor=white"
DRAW="${DRAW}:box=1:boxcolor=black@0.6:boxborderw=10"

exec ffmpeg -hide_banner -loglevel warning \
  -re \
  -f lavfi -i "smptebars=size=${SIZE}:rate=${FPS}" \
  -f lavfi -i "sine=frequency=1000:sample_rate=48000" \
  -vf "${DRAW}" \
  -af "volume=-18dB" \
  -c:v libx264 -preset "${PRESET}" -tune zerolatency -b:v "${BITRATE}" \
  -force_key_frames "expr:gte(t,n_forced*2)" \
  -pix_fmt yuv420p \
  -c:a aac -b:a 64k -ar 48000 \
  -f mpegts \
  "srt://127.0.0.1:8890?streamid=publish:${CH}&passphrase=${PASS}&latency=120000"
