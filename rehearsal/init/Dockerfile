# 前準備コンテナ。証明書の生成に openssl、config.json の読み出しに python3、
# tools/config.sh の読み込みに bash を使用する。
#
# init.sh はマウントしたリポジトリから実行するため、ここでは COPY しない。スクリプトを
# 編集するたびにイメージを再構築する必要をなくすためである。

FROM alpine:3.21

RUN apk add --no-cache bash openssl python3
