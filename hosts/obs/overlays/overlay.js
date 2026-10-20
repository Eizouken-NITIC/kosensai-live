// program.js の進行から、現在時刻に対応する項目を求める。
// ?now=2026-10-24T13:35 を付けると、その時刻から時計を進めて表示する(確認用)。
// file:// では ES モジュールが CORS で読み込めないため、通常のスクリプトにしている。
(() => {
  const params = new URLSearchParams(location.search);
  const offset = params.has('now') ? new Date(params.get('now')) - Date.now() : 0;

  const now = () => new Date(Date.now() + offset);
  const pad = (n) => String(n).padStart(2, '0');
  const hhmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const at = (key, time) => new Date(`${key}T${time}:00`);

  // 当日の項目を { start, end, title, kind, label } の配列で返す。当日の進行が無ければ空。
  function schedule(d = now()) {
    const key = dayKey(d);
    const day = window.PROGRAM.days[key];
    if (!day) return [];
    return day.items.map(([time, title, kind = 'band'], i) => ({
      start: at(key, time),
      end: at(key, day.items[i + 1]?.[0] ?? day.end),
      title,
      kind,
      label: window.PROGRAM.kinds[kind],
    }));
  }

  const current = (d = now()) => schedule(d).find((it) => it.start <= d && d < it.end) ?? null;

  // 次に配信する項目。休憩と配信 NG は飛ばす。
  const next = (d = now()) =>
    schedule(d).find((it) => it.start > d && it.kind !== 'break' && it.kind !== 'ng') ?? null;

  // 今日以降で最初の配信の開始。待機画面の「次の配信」に使用する。
  function nextStart(d = now()) {
    for (const [key, day] of Object.entries(window.PROGRAM.days).sort()) {
      const start = at(key, day.items[0][0]);
      if (start > d) return start;
    }
    return null;
  }

  // 項目の経過の割合(0〜1)。
  const progress = (it, d = now()) => Math.min(1, Math.max(0, (d - it.start) / (it.end - it.start)));

  // 残り時間を「あと 12 分」の形にする。1 時間以上は「あと 1 時間 5 分」。
  function remain(to, d = now()) {
    const min = Math.max(0, Math.ceil((to - d) / 60000));
    return min >= 60 ? `あと ${Math.floor(min / 60)} 時間 ${min % 60} 分` : `あと ${min} 分`;
  }

  // 要素の .in を付け直し、入りのアニメーションを最初から再生する。
  function replay(el) {
    el.classList.remove('in', 'out');
    void el.offsetWidth;
    el.classList.add('in');
  }

  function every(ms, fn) {
    fn();
    setInterval(fn, ms);
  }

  // el('li', { className: 'x' }, child, ...) で要素を作る。文字列の子はテキストになる。
  function el(tag, props = {}, ...children) {
    const e = Object.assign(document.createElement(tag), props);
    e.append(...children);
    return e;
  }

  window.Overlay = { params, now, hhmm, schedule, current, next, nextStart, progress, remain, replay, every, el };
})();
