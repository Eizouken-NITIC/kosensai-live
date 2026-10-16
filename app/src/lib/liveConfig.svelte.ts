/* Ch の一覧と表示名を、配信中に差し替えられるようにする。
 *
 * web/config.json を定期的に読み直す。読めない・形が崩れている・表示する Ch が無い場合は、
 * ビルド時に埋め込んだ config.json の値に戻す。どの端末も同じ 2 通りのどちらかを表示する。
 * MediaMTX 側は全 Ch を常に待ち受けており、ここでは何も変えない。
 *
 * 読み直しの要求には端末ごとのランダムな ID・ページ・見ている Ch を付ける。Caddy のアクセス
 * ログに残り、tools/analyze-access.py が同時視聴数や延べ端末数を数える。ID は個人を特定しない。 */

import { channels as bundled } from './config';
import type { Channel } from './types';

const POLL_MS = 30 * 1000;
const ID_KEY = 'viewerId';

/** 集計に使う、どの画面で何を見ているかの情報である。 */
export type Beacon = { page: 'viewer' | 'signage'; channel: () => string };

function newId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** 端末に保存した ID を返す。保存できない場合はページを開いている間だけ同じ ID を使う。 */
function viewerId(): string {
  try {
    const saved = localStorage.getItem(ID_KEY);
    if (saved) return saved;
    const id = newId();
    localStorage.setItem(ID_KEY, id);
    return id;
  } catch {
    return newId();
  }
}

function visibleOf(list: Channel[]): Channel[] {
  return list.filter((c) => c.visible !== false);
}

function isChannelList(v: unknown): v is Channel[] {
  return (
    Array.isArray(v) &&
    v.every(
      (c) =>
        typeof c === 'object' &&
        c !== null &&
        typeof (c as Channel).id === 'string' &&
        typeof (c as Channel).label === 'string',
    )
  );
}

let all = $state<Channel[]>(bundled);

export const liveConfig = {
  /** 来場者へ表示する Ch。visible: false の Ch を除き、config.json の順に並ぶ。 */
  get channels(): Channel[] {
    return visibleOf(all);
  },
  /** 非表示の Ch も含めて表示名を引く。サイネージは ?ch= で非表示の Ch も映せる。 */
  labelOf(id: string): string {
    return all.find((c) => c.id === id)?.label ?? id;
  },
};

async function fetchChannels(url: string): Promise<Channel[] | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const list = ((await res.json()) as { channels?: unknown })?.channels;
    return isChannelList(list) && visibleOf(list).length > 0 ? list : null;
  } catch {
    /* 通信断や書き換え途中の JSON である */
    return null;
  }
}

/** 定期的な読み直しを始める。戻り値で止める。 */
export function syncLiveConfig(beacon: Beacon): () => void {
  const id = viewerId();
  const refresh = async () => {
    const q = new URLSearchParams({ v: id, p: beacon.page, ch: beacon.channel() });
    all = (await fetchChannels(`/config.json?${q}`)) ?? bundled;
  };
  refresh();
  const timer = setInterval(refresh, POLL_MS);
  return () => clearInterval(timer);
}
