import type { PlayerState } from './types';

/* HLS 再生の状態機械。
 *
 * 状態:
 *   'connecting'  接続を試している最中。まだ失敗していない
 *   'playing'     再生中
 *   'waiting'     実際に取得へ失敗した（＝その Ch はまだ配信されていない）
 *   'blocked'     ブラウザの自動再生ポリシーで止められた
 *   'unsupported' HLS を再生できないブラウザ
 *
 * connecting と waiting を分けているのは、Ch を切り替えた直後に
 * 「まだ配信が始まっていない」と断定してしまわないため。
 */

// 失敗のたびに間隔を延ばす。切替直後の一時的な失敗からは素早く復帰し、
// 放置される場合も 5 秒間隔までに留める。サイネージは無人でチャンネル切替も
// 起きないため、上限がそのまま「配信開始に気づくまでの待ち時間」になる。
const RETRY_MS = [1000, 2000, 3000, 5000];

// タブへ戻ってから、接続を張り直すかどうかを判断するまでの猶予
const RESUME_GRACE_MS = 1500;

/* hls.js は <script> で後から読むため、型は使うぶんだけ最小限に持つ。
   同梱している 1.6.15 の型定義パッケージは入れていない。 */
type HlsInstance = {
  on(event: string, cb: (evt: string, data: HlsErrorData) => void): void;
  loadSource(url: string): void;
  attachMedia(el: HTMLVideoElement): void;
  recoverMediaError(): void;
  destroy(): void;
};
type HlsErrorData = { fatal: boolean; type: string };
type HlsConstructor = {
  new (config: Record<string, unknown>): HlsInstance;
  isSupported(): boolean;
  Events: { MANIFEST_PARSED: string; ERROR: string };
  ErrorTypes: { MEDIA_ERROR: string };
};

declare global {
  interface Window {
    Hls?: HlsConstructor;
  }
}

/* hls.js は static/vendor から読む（学内完結のため CDN を使わない）。
   Promise を保持して、読み込み中に再度呼ばれても <script> を二重に挿入しない。 */
let hlsJsPromise: Promise<HlsConstructor> | null = null;

function loadHlsJs(): Promise<HlsConstructor> {
  if (window.Hls) return Promise.resolve(window.Hls);
  if (hlsJsPromise) return hlsJsPromise;
  hlsJsPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = '/vendor/hls.min.js';
    s.onload = () =>
      window.Hls ? resolve(window.Hls) : reject(new Error('hls.js が読めなかった'));
    s.onerror = () => reject(new Error('hls.js を読み込めなかった'));
    document.head.appendChild(s);
  });
  return hlsJsPromise;
}

export function createPlayer() {
  let state = $state<PlayerState>('connecting');
  let channel = $state<string | null>(null);
  /* 配信を受信できているかどうか。state から導出せず別に持つのは、Ch 切替や
     タブ復帰で接続を張り直す間も直前の値を保つため。導出すると張り直しのたびに
     一度 false へ落ち、ワードマークの LIVE が明滅する。実際に受信できなく
     なったこと（fail / blocked / unsupported）が判明した時点でのみ false にする。 */
  let live = $state(false);

  let video: HTMLVideoElement | null = null;
  let hls: HlsInstance | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let resumeCheck: ReturnType<typeof setTimeout> | undefined;
  let failures = 0;
  let resumeFn: (() => void) | null = null;

  function clearRetry() {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  }

  function fail() {
    clearRetry();
    const wait = RETRY_MS[Math.min(failures, RETRY_MS.length - 1)];
    failures += 1;
    state = 'waiting';
    live = false;
    retryTimer = setTimeout(() => load(channel, true), wait);
  }

  function teardown() {
    clearRetry();
    if (hls) {
      hls.destroy();
      hls = null;
    }
    if (video) {
      video.removeAttribute('src');
      try {
        video.load();
      } catch {
        /* noop */
      }
    }
  }

  function attemptPlay() {
    const p = video?.play();
    if (p && p.catch) {
      p.catch(() => {
        // モバイル・Kiosk の自動再生ブロック。ユーザー操作を 1 回もらう。
        resumeFn = () => video?.play().catch(() => {});
        state = 'blocked';
        live = false;
      });
    }
  }

  async function load(ch: string | null, isRetry = false) {
    if (!ch || !video) return;
    const el = video;
    teardown();
    channel = ch;
    if (!isRetry) {
      failures = 0;
      state = 'connecting';
    }

    const url = `/hls/${ch}/index.m3u8`;
    const canNative = !!el.canPlayType('application/vnd.apple.mpegurl');

    let Hls: HlsConstructor | null = null;
    try {
      Hls = await loadHlsJs();
    } catch {
      /* 読めなければネイティブ側に賭ける */
    }
    const canHlsJs = !!(Hls && Hls.isSupported());

    // Safari(iOS/macOS) はネイティブ HLS の方が安定かつ省電力なので優先する
    if (!canHlsJs && canNative) {
      el.src = url;
      el.addEventListener('error', fail, { once: true });
      attemptPlay();
      return;
    }
    if (!canHlsJs || !Hls) {
      state = 'unsupported';
      live = false;
      return;
    }

    const H = Hls;
    const instance = new H({
      // ライブ先頭に追従しつつ、Wi-Fi の揺れに耐えるバッファ設定
      lowLatencyMode: false,
      liveSyncDurationCount: 3,
      liveMaxLatencyDurationCount: 10,
      maxBufferLength: 20,
      // ライブとして再生させる。false（既定）だと duration がスライディング
      // ウィンドウの長さになり、プレイヤーが有限長の動画として扱ってしまう。
      // Infinity にすると media-chrome は seekable の範囲でシークバーを描く。
      liveDurationInfinity: true,
      manifestLoadingMaxRetry: 2,
      levelLoadingMaxRetry: 4,
      fragLoadingMaxRetry: 4,
    });

    hls = instance;
    instance.on(H.Events.MANIFEST_PARSED, attemptPlay);
    instance.on(H.Events.ERROR, (_evt: string, data: HlsErrorData) => {
      if (!data.fatal) return;
      if (data.type === H.ErrorTypes.MEDIA_ERROR) {
        instance.recoverMediaError();
        return;
      }
      // NETWORK_ERROR の 404 = MediaMTX にまだ publish されていない = 配信開始前
      fail();
    });

    instance.loadSource(url);
    instance.attachMedia(el);
  }

  /** <video> を渡して初期化する。戻り値は後片付け用。 */
  function attach(el: HTMLVideoElement) {
    video = el;
    const v = el;

    const onPlaying = () => {
      clearRetry();
      failures = 0;
      state = 'playing';
      live = true;
    };
    /* タブへ戻った直後は、デコードが中断されていて readyState が下がっている
       ことがある。その時点で接続を張り直すと、再生できる状態だった場合でも
       バッファを捨てて数秒の空白を作る。まず再生を促し、それでも進まなかった
       ものだけを張り直す。 */
    const onVisibility = () => {
      if (document.hidden) {
        clearRetry();
        return;
      }
      if (!channel) return;
      v.play().catch(() => {});
      clearTimeout(resumeCheck);
      resumeCheck = setTimeout(() => {
        if (v.paused || v.readyState < 3) load(channel);
      }, RESUME_GRACE_MS);
    };

    v.addEventListener('playing', onPlaying);
    v.addEventListener('error', fail);
    v.addEventListener('ended', fail);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      v.removeEventListener('playing', onPlaying);
      v.removeEventListener('error', fail);
      v.removeEventListener('ended', fail);
      document.removeEventListener('visibilitychange', onVisibility);
      clearTimeout(resumeCheck);
      teardown();
      video = null;
    };
  }

  return {
    get state() {
      return state;
    },
    get channel() {
      return channel;
    },
    get isLive() {
      return live;
    },
    resume: () => resumeFn?.(),
    /* hls.js（gzip 後 172KB）の取得を先に始める。load() の中で取りに行くと、
       config.json の取得完了を待ってから 172KB のダウンロードとパースが始まり、
       その分だけプレイリストの要求が後ろへずれる。 */
    prefetch: () => {
      loadHlsJs().catch(() => {
        /* ネイティブ HLS で再生できる可能性があるので、ここでは状態を変えない */
      });
    },
    attach,
    load,
  };
}
