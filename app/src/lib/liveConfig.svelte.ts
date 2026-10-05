/* Ch の一覧と表示名を、配信中に差し替えられるようにする。
 *
 * ビルド時に埋め込んだ config.json を初期値とし、web/config.json を定期的に読み直す。
 * 読めない・形が崩れている場合は直前の値を使い続けるため、表示が消えることはない。
 * MediaMTX 側は全 Ch を常に待ち受けており、ここでは何も変えない。 */

import { channels as bundled } from './config';
import type { Channel } from './types';

const POLL_MS = 30 * 1000;

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

async function refresh() {
  try {
    const res = await fetch('/config.json', { cache: 'no-store' });
    if (!res.ok) return;
    const json: unknown = await res.json();
    const list = (json as { channels?: unknown })?.channels;
    if (!isChannelList(list) || visibleOf(list).length === 0) return;
    if (JSON.stringify(list) !== JSON.stringify(all)) all = list;
  } catch {
    /* 通信断や書き換え途中の JSON は無視し、直前の値を使い続ける */
  }
}

/** 定期的な読み直しを始める。戻り値で止める。 */
export function syncLiveConfig(): () => void {
  refresh();
  const timer = setInterval(refresh, POLL_MS);
  return () => clearInterval(timer);
}
