# テストパターン送出用の ffmpeg イメージ。
#
# mediamtx の ffmpeg 同梱イメージは libfreetype 付きでビルドされているため drawtext を
# 使用できるが、Alpine ベースでありフォントを 1 つも含まない。フォントを追加することで
# チャンネル名と経過時刻を映像へ焼き込める。font-dejavu は ASCII のみを収録するため、
# 焼き込む文字列も ASCII に限られる。

FROM bluenviron/mediamtx:1.19.3-ffmpeg

RUN apk add --no-cache font-dejavu

COPY publish.sh /publish.sh
RUN chmod +x /publish.sh

ENTRYPOINT ["/publish.sh"]
