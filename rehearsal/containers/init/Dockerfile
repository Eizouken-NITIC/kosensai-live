# 前準備コンテナ。証明書の生成に openssl、tools/config.py の実行に python3、
# init.sh の実行に bash を使用する。
#
# init.sh はマウントしたリポジトリから実行するため、ここでは COPY しない。スクリプトを
# 編集するたびにイメージを再構築する必要をなくすためである。

FROM alpine:3.21

RUN apk add --no-cache bash openssl python3
