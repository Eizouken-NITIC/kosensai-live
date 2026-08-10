# テストパターンの送出に使う ffmpeg のイメージを作る。
#
# mediamtx の ffmpeg 同梱イメージは libfreetype 付きでビルドされており drawtext を
# 使えるが、Alpine ベースでフォントが 1 つも入っていない。フォントを足すだけで
# チャンネル名と経過時刻を映像へ焼き込める。
#
# 描画は ASCII で行う。CJK フォントは数十 MB あり、CH1〜CH4 の識別には不要である。
# 会場名との対応はリポジトリ直下の config.json にある。

FROM bluenviron/mediamtx:1.19.3-ffmpeg

RUN apk add --no-cache font-dejavu

COPY publish.sh /publish.sh
RUN chmod +x /publish.sh

ENTRYPOINT ["/publish.sh"]
