#!/usr/bin/env python3
"""Caddy のアクセスログから視聴数を集計する。

視聴ページとサイネージは 30 秒ごとに /config.json?v=<端末ID>&p=<ページ>&ch=<Ch> を取得する
（app/src/lib/liveConfig.svelte.ts）。この要求だけを数える。

  python3 tools/analyze-access.py hosts/server/logs/access*.log*            # 日ごとの要約
  python3 tools/analyze-access.py --csv minutes.csv hosts/server/logs/*      # 1 分ごとの同時視聴数も書き出す

同時視聴数は、その 1 分間に要求を送った端末の数である。読み直しは 30 秒ごとのため、
開いている端末は 1 分に必ず 1 回以上数えられる。延べ端末数は、その日に現れた ID の数である。
"""

import argparse, csv, gzip, json, sys
from collections import defaultdict
from datetime import datetime
from urllib.parse import urlsplit, parse_qs


def open_log(path):
    return gzip.open(path, "rt", encoding="utf-8") if path.endswith(".gz") else open(path, encoding="utf-8")


def beacons(paths):
    """(時刻, 端末ID, ページ, Ch) を返す。"""
    for path in paths:
        with open_log(path) as f:
            for line in f:
                try:
                    e = json.loads(line)
                    uri = e["request"]["uri"]
                except (ValueError, KeyError):
                    continue
                u = urlsplit(uri)
                if u.path != "/config.json":
                    continue
                q = parse_qs(u.query)
                if "v" not in q:
                    continue
                t = datetime.fromtimestamp(e["ts"])
                yield t, q["v"][0], q.get("p", ["?"])[0], q.get("ch", ["?"])[0]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("logs", nargs="+")
    ap.add_argument("--csv", help="1 分ごとの同時視聴数を書き出す CSV のパス")
    args = ap.parse_args()

    # minute -> {id: (page, ch)}。同じ分に複数回来た端末は最後の Ch を採る。
    minutes = defaultdict(dict)
    days = defaultdict(lambda: defaultdict(set))  # day -> page -> ids
    for t, vid, page, ch in beacons(args.logs):
        minutes[t.replace(second=0, microsecond=0)][vid] = (page, ch)
        days[t.date()][page].add(vid)

    if not minutes:
        sys.exit("集計対象の要求がありません（/config.json?v=... が見つかりません）")

    chans = sorted({ch for m in minutes.values() for p, ch in m.values() if p == "viewer"})

    print("== 日ごと（延べ端末数） ==")
    for day in sorted(days):
        pages = days[day]
        print(f"  {day}  視聴ページ {len(pages.get('viewer', ()))} 台 / サイネージ {len(pages.get('signage', ()))} 台")

    print("\n== 日ごと（視聴ページの同時視聴数の最大） ==")
    for day in sorted(days):
        peak = max(
            ((sum(1 for p, _ in m.values() if p == "viewer"), t) for t, m in minutes.items() if t.date() == day),
            default=(0, None),
        )
        if peak[1]:
            print(f"  {day}  {peak[0]} 台（{peak[1]:%H:%M}）")

    if args.csv:
        with open(args.csv, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["minute", "viewer", *chans, "signage"])
            for t in sorted(minutes):
                m = minutes[t]
                viewer = [ch for p, ch in m.values() if p == "viewer"]
                w.writerow([f"{t:%Y-%m-%d %H:%M}", len(viewer), *(viewer.count(c) for c in chans),
                            sum(1 for p, _ in m.values() if p == "signage")])
        print(f"\n1 分ごとの同時視聴数を {args.csv} に書き出しました（列: 視聴ページ合計・Ch ごと・サイネージ）")


if __name__ == "__main__":
    main()
