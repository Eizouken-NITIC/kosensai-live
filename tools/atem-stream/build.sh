#!/usr/bin/env bash
# ATEM Switchers SDK (macOS) で atem-stream をビルドする。
# SDK はライセンス上リポジトリに含めないため、Blackmagic のサイトから取得してインストールする。
#   ATEM_SDK_INCLUDE=<SDK の include ディレクトリ> ./tools/atem-stream/build.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SDK_INCLUDE="${ATEM_SDK_INCLUDE:-/Applications/Blackmagic ATEM Switchers/Developer SDK/Mac OS X/include}"

[[ -f "${SDK_INCLUDE}/BMDSwitcherAPI.h" ]] \
  || { echo "SDK が見つかりません: ${SDK_INCLUDE} (ATEM_SDK_INCLUDE で指定してください)" >&2; exit 1; }

clang++ -std=c++17 -I"${SDK_INCLUDE}" \
  "${HERE}/main.cpp" "${SDK_INCLUDE}/BMDSwitcherAPIDispatch.cpp" \
  -framework CoreFoundation -o "${HERE}/atem-stream"
echo "built: ${HERE}/atem-stream"
