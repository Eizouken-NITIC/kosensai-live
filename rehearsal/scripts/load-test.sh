#!/usr/bin/env bash
# 視聴クライアントを N 本立てて負荷をかける。
#
#   ./scripts/load-test.sh              # 10人 / ch1 / 30秒
#   ./scripts/load-test.sh 50 ch1 60    # 50人 / ch1 / 60秒
#   ./scripts/load-test.sh 30 all 60    # 30人ずつ全Ch同時（= 帯域見積の再現）
#
# 出るもの: 合計スループット、1人あたりの実効ビットレート、エラー数。
#
# ⚠️ ここで測れるのは「MediaMTX が N セッションを処理できるか」と
#    「1人あたり何 Mbps 流れるか」まで。無線区間の律速は Wi-Fi の AP エアタイムであり、
#    同一ホスト内のループバックでは再現できない。

set -euo pipefail

REH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REH_DIR}"

CLIENTS="${1:-10}"
CH="${2:-ch1}"
DURATION="${3:-30}"
DOMAIN="${DOMAIN:-$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["site"]["domain"])' ../config.json)}"

docker inspect rehearsal-mediamtx >/dev/null 2>&1 \
  || { echo "リハーサル環境が起動していません。先に ./scripts/up.sh を実行してください" >&2; exit 1; }

if [[ "${CH}" == "all" ]]; then
  CHANNELS=$(python3 -c "
import json;print(' '.join(c['id'] for c in json.load(open('../config.json'))['channels']))")
else
  CHANNELS="${CH}"
fi

NCH=$(wc -w <<<"${CHANNELS}" | tr -d ' ')
echo "== 負荷テスト =="
echo "  対象 Ch    : ${CHANNELS}"
echo "  同時視聴者 : ${CLIENTS} 人 × ${NCH} Ch = $((CLIENTS * NCH)) セッション"
echo "  実行時間   : ${DURATION} 秒"
echo

rm -rf out
for ch in ${CHANNELS}; do
  mkdir -p "out/${ch}"
done

for ch in ${CHANNELS}; do
  docker rm -f "rehearsal-client-${ch}" >/dev/null 2>&1 || true
  docker run --rm -d \
    --name "rehearsal-client-${ch}" \
    --network "container:rehearsal-mediamtx" \
    -e CLIENTS="${CLIENTS}" -e CH="${ch}" -e DURATION="${DURATION}" -e DOMAIN="${DOMAIN}" \
    -v "${REH_DIR}/client/pull.sh:/pull.sh:ro" \
    -v "${REH_DIR}/out/${ch}:/out" \
    --entrypoint /bin/sh \
    curlimages/curl:latest /pull.sh >/dev/null
done

echo "  実行中… (${DURATION}秒 + 集計)"
for ch in ${CHANNELS}; do
  docker wait "rehearsal-client-${ch}" >/dev/null 2>&1 || true
done
sleep 1

echo
echo "== 結果 =="
python3 - "${DURATION}" "${CLIENTS}" ${CHANNELS} <<'PY'
import sys, pathlib
dur = int(sys.argv[1]); nclients = int(sys.argv[2]); chans = sys.argv[3:]
out = pathlib.Path("out")
tot_bytes = tot_segs = tot_errs = 0
print(f"  {'Ch':<6} {'視聴者':>6} {'受信':>10} {'合計':>11} {'1人あたり':>12} {'セグ':>6} {'エラー':>6}")
print("  " + "-" * 66)
for ch in chans:
    b = s = e = 0; n = 0
    d = out / ch
    for f in sorted(d.glob("c*")) if d.exists() else []:
        try:
            bb, ss, ee = f.read_text().split()
        except Exception:
            continue
        b += int(bb); s += int(ss); e += int(ee); n += 1
    mbps = b * 8 / dur / 1e6 if dur else 0
    per = mbps / n if n else 0
    print(f"  {ch:<6} {n:>6} {b/1e6:>9.1f}MB {mbps:>9.1f}Mbps {per:>10.2f}Mbps {s:>6} {e:>6}")
    tot_bytes += b; tot_segs += s; tot_errs += e
print("  " + "-" * 66)
tm = tot_bytes * 8 / dur / 1e6 if dur else 0
print(f"  {'合計':<6} {'':>6} {tot_bytes/1e6:>9.1f}MB {tm:>9.1f}Mbps {'':>12} {tot_segs:>6} {tot_errs:>6}")
print()
if tot_errs:
    print(f"  ⚠️ エラーが {tot_errs} 件あります。docker compose logs mediamtx で確認してください")
if tot_segs == 0:
    print("  ⚠️ セグメントを1つも取得できていません。publisher が動いているか確認してください")
    print("     docker compose --profile publish ps")
PY

echo
echo "  ※ 無線区間の律速は Wi-Fi の AP エアタイムです。ここでは再現できません。"
echo "     本番のビットレート判断は、実際に使う無線 AP の収容能力と合わせて行ってください。"
