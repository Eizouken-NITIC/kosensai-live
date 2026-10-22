// 今年の進行(../assets/program.json)から現在時刻の項目を求める処理と、操作パネル(control.html)との状態の受け渡し。
// ?now=2026-10-24T13:35 を付けると、その時刻から時計を進めて表示する(確認用)。
// file:// では ES モジュールが CORS で読み込めないため、通常のスクリプトにしている。
(() => {
  // 各ページはこのスクリプトの直後に window.PROGRAM を使うので、進行は同期の XHR で読む。
  // ローカルファイルは file:// では status 0、OBS のブラウザソース(http://absolute)では 200 になる。
  const xhr = new XMLHttpRequest();
  xhr.open('GET', new URL('../assets/program.json', document.currentScript.src), false);
  xhr.send();
  if (xhr.status !== 200 && xhr.status !== 0) throw new Error(`program.json を読めません(${xhr.status})`);
  const P = (window.PROGRAM = JSON.parse(xhr.responseText));
  const params = new URLSearchParams(location.search);
  const offset = params.has('now') ? new Date(params.get('now')) - Date.now() : 0;

  const now = () => new Date(Date.now() + offset);
  const pad = (n) => String(n).padStart(2, '0');
  const hhmm = (d) => `${d.getHours()}:${pad(d.getMinutes())}`;
  const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const at = (key, time) => new Date(`${key}T${time}:00`);
  const DAYS = ['日', '月', '火', '水', '木', '金', '土'];
  const date = (d) => `${d.getMonth() + 1}月${d.getDate()}日(${DAYS[d.getDay()]})`;

  // チャンネル(ch1 / ch2)の当日の項目を { start, end, title, kind, place, label } の配列で返す。
  function schedule(ch, d = now()) {
    const key = dayKey(d);
    const day = P[ch].days[key];
    if (!day) return [];
    return day.items.map((it, i) => {
      const kind = ch === 'ch1' ? it.kind : 'roam';
      return {
        start: at(key, it.at),
        end: at(key, day.items[i + 1]?.at ?? day.end),
        title: it.title,
        kind,
        place: ch === 'ch2' ? it.place : P.ch1.name,
        label: ch === 'ch1' ? P.ch1.kinds[kind] : it.place,
      };
    });
  }

  const current = (ch, d = now()) => schedule(ch, d).find((it) => it.start <= d && d < it.end) ?? null;

  // 次に配信する項目。休憩と配信しない時間は飛ばす。
  const next = (ch, d = now()) =>
    schedule(ch, d).find((it) => it.start > d && it.kind !== 'break' && it.kind !== 'ng') ?? null;

  // 項目の経過の割合(0〜1)。
  const progress = (it, d = now()) => Math.min(1, Math.max(0, (d - it.start) / (it.end - it.start)));

  // 公式のイベントスケジュールの当日分を { venue, start, end, title, ch } の配列で返す。
  function events(d = now()) {
    const key = dayKey(d);
    return (P.events[key] ?? []).map((e) => ({ ...e, start: at(key, e.start), end: at(key, e.end), ch: e.ch ?? null }));
  }

  // d より後で最初の第一体育館の出演(休憩と配信しない時間を除く)。日をまたいで探す。
  // 待機画面の「次の配信」に使用する。
  function nextShow(d = now()) {
    for (const key of Object.keys(P.ch1.days).sort()) {
      const it = schedule('ch1', at(key, '00:00')).find((x) => x.start > d && (x.kind === 'band' || x.kind === 'dance'));
      if (it) return it;
    }
    return null;
  }

  // ---- 操作パネルとの状態の受け渡し ----
  // ローカルファイルのブラウザソースとドックは同じ origin(http://absolute)になるため、
  // localStorage に状態を置き、変更を BroadcastChannel で知らせる。
  const KEY = 'kosensai-overlay';
  const bus = new BroadcastChannel(KEY);
  const state = () => JSON.parse(localStorage.getItem(KEY) ?? '{}');
  // BroadcastChannel は送ったページ自身には届かないため、同じページの受け手には直接知らせる。
  const listeners = [];
  function setState(patch) {
    const s = { ...state(), ...patch };
    localStorage.setItem(KEY, JSON.stringify(s));
    bus.postMessage(s);
    for (const fn of listeners) fn(s);
    return s;
  }
  function onState(fn) {
    listeners.push(fn);
    bus.addEventListener('message', (e) => fn(e.data));
    fn(state());
  }

  // 遊撃の現在地。操作パネルで選んでいればそれを、無ければ予定の項目を返す。
  function ch2Now(s = state(), d = now()) {
    if (s.ch2Place != null) {
      const { title, place } = P.ch2.places[s.ch2Place];
      return { title, place, label: place };
    }
    return current('ch2', d);
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

  // 文字を、字形の実際の形で揃える。
  // 左: 大きい文字ほど字形の左の余白が広がり、小さい文字より右にずれて見えるため、その分だけ左へ寄せる。
  // 上下: 行の高さの中心ではなく、字形の中心を箱の中心に合わせる。英字は g や y の下に伸びる部分を
  //       除いた大文字の高さで、日本語は字形の上端から下端で中心を求める。
  const canvas = document.createElement('canvas').getContext('2d');
  const CJK = /[\u3000-\u9fff\uff00-\uffef]/;
  async function alignInk(...nodes) {
    await document.fonts.ready;
    for (const node of nodes) {
      const text = node.textContent.trim();
      if (!text) continue;
      const cs = getComputedStyle(node);
      const size = parseFloat(cs.fontSize);
      canvas.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const all = canvas.measureText(text);
      const first = canvas.measureText(text[0]);
      // 行の高さ(line-height: 1)の中でのベースラインの位置
      const baseline = (size - (all.fontBoundingBoxAscent + all.fontBoundingBoxDescent)) / 2 + all.fontBoundingBoxAscent;
      const top = baseline - all.actualBoundingBoxAscent;
      const bottom = CJK.test(text) ? baseline + all.actualBoundingBoxDescent : baseline;
      // CSS の margin や transform と重ならないよう、補正は translate で行う。
      node.style.translate = `${first.actualBoundingBoxLeft}px ${size / 2 - (top + bottom) / 2}px`;
    }
  }

  // 計器(MIB2 のパフォーマンスモニターの形)を container に作り、値を更新する関数を返す。
  // 目盛は左下(-150°)から右下(+150°)までの 300°。update(value, digits, unit): value は min〜max、
  // digits は中央に出す文字列、unit はその右に出す単位。
  // 輪・目盛と針は assets/render/gauge.py が Blender で描いた画像を使う。針の画像は 5° ごとに 61 枚あり、
  // 角度に最も近い画像を選ぶ。画像ごとに光の当たり方が角度に合っているため、画像を回転させて使わない。
  // 切り替えの時だけ、前の角度から画像の角度まで 0.8 秒で回して見せる。
  const SVG = 'http://www.w3.org/2000/svg';
  const NEEDLE_STEP = 5;
  function gauge(container, { min = 0, max = 60 } = {}) {
    const box = el('div', { className: 'gauge' },
      el('img', { src: '../assets/gauge/static.png', alt: '' }),
    );
    const needle = el('img', { className: 'needle', alt: '' });
    box.append(needle);
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 400 400');
    const text = (cls, y) => {
      const e = document.createElementNS(SVG, 'text');
      e.setAttribute('class', cls);
      e.setAttribute('x', 200);
      e.setAttribute('y', y);
      svg.append(e);
      return e;
    };
    // 数字と単位は同じベースラインに並べ、2 つを合わせた幅で中央に揃える。
    const value = text('value', 226);
    const span = (cls) => {
      const e = document.createElementNS(SVG, 'tspan');
      e.setAttribute('class', cls);
      value.append(e);
      return e;
    };
    const digits = span('digits');
    const unit = span('unit');
    unit.setAttribute('dx', 10);
    box.append(svg);
    container.replaceChildren(box);

    const SPAN = 150;
    let shown = null;
    return (value, digitText, unitText = '') => {
      const v = Math.min(max, Math.max(min, value));
      const deg = -SPAN + (2 * SPAN * (v - min)) / (max - min);
      const n = Math.round((deg + SPAN) / NEEDLE_STEP);
      const frameDeg = -SPAN + n * NEEDLE_STEP;
      if (n !== shown) {
        const from = shown === null ? frameDeg : -SPAN + shown * NEEDLE_STEP;
        shown = n;
        needle.src = `../assets/gauge/needle-${String(n).padStart(2, '0')}.png`;
        needle.animate(
          [{ transform: `rotate(${from - frameDeg}deg)` }, { transform: 'none' }],
          { duration: 800, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
        );
      }
      digits.textContent = digitText;
      unit.textContent = unitText;
    };
  }

  // アナログ時計を container に作り、時刻を更新する関数を返す。
  // 部品は assets/render/clock.py が Blender で描いた画像(assets/clock-face/)を重ねる。長針は 6° ごと(1 分ごと)の画像、
  // 短針は 5° ごとの画像で、短針だけは画像の角度との差(2.5° 未満)を回転で補う。
  const HOUR_STEP = 5;
  function clockFace(container) {
    const img = (src) => el('img', { src: src ? `../assets/clock-face/${src}` : undefined, alt: '' });
    const hour = img();
    const minute = img();
    container.replaceChildren(el('div', { className: 'clock-face' }, img('dial.png'), hour, minute, img('cap.png')));
    return (d) => {
      const m = d.getMinutes();
      const deg = (d.getHours() % 12) * 30 + m * 0.5;
      const n = Math.round(deg / HOUR_STEP) % (360 / HOUR_STEP);
      hour.src = `../assets/clock-face/hour-${String(n).padStart(2, '0')}.png`;
      hour.style.transform = `rotate(${deg - n * HOUR_STEP}deg)`;
      minute.src = `../assets/clock-face/minute-${String(m).padStart(2, '0')}.png`;
    };
  }

  // 要素の .in を付け直し、入りのアニメーションを最初から再生する。
  function replay(node) {
    node.classList.remove('in', 'out');
    void node.offsetWidth;
    node.classList.add('in');
  }

  window.Overlay = {
    params, now, hhmm, date, schedule, current, next, progress, events, nextShow,
    state, setState, onState, ch2Now, every, el, alignInk, gauge, clockFace, replay,
  };
})();
