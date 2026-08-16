#!/bin/sh
# テストパターンを 1 チャンネル分 SRT で送出する。
#
#   publish.sh <チャンネル名> <パスフレーズ>
#
# 映像のカラーバーと音声の 1kHz は全チャンネルで共通であるため、チャンネルの識別は
# 映像へ焼き込んだテキストで行う。

set -eu

CH="$1"
PASS="$2"

SIZE="${REH_SIZE:-640x360}"
FPS="${REH_FPS:-15}"
BITRATE="${REH_BITRATE:-1200k}"
PRESET="${REH_PRESET:-ultrafast}"

FONT=/usr/share/fonts/dejavu/DejaVuSansMono-Bold.ttf
LABEL="$(echo "${CH}" | tr 'a-z' 'A-Z')"

# 上段にチャンネル名、下段に経過時刻を描画する。経過時刻は遅延を目視で確認するために使用する。
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
