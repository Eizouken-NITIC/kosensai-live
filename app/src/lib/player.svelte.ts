import type { PlayerState } from './types';

// hls.js は動的 import で読むため、型は dist/hls.d.ts から導出する。
type HlsConstructor = typeof import('hls.js').default;
type HlsInstance = InstanceType<HlsConstructor>;
type HlsErrorData = import('hls.js').ErrorData;

// hls.js の retryForHttpStatus() が 4xx を再試行しないため、未配信の 404 は
// ここで検出する。5xx とタイムアウトは hls.js が処理する。
const RETRY_MS = 5000;

let hlsJsPromise: Promise<HlsConstructor> | null = null;

function playlistUrl(ch: string): string {
  return `/hls/${ch}/index.m3u8`;
}

function loadHlsJs(): Promise<HlsConstructor> {
  if (!hlsJsPromise) {
    hlsJsPromise = import('hls.js').then((mod) => mod.default);
  }
  return hlsJsPromise;
}

export function createPlayer() {
  let state = $state<PlayerState>('connecting');
  let channel = $state<string | null>(null);
  // state から導出すると Ch 切替のたびに false を経由し、LIVE が明滅する
  let live = $state(false);

  let video: HTMLVideoElement | null = null;
  let hls: HlsInstance | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let resumeFn: (() => void) | null = null;

  function clearRetry() {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  }

  function fail(reason: 'idle' | 'waiting') {
    clearRetry();
    state = reason;
    live = false;
    retryTimer = setTimeout(() => load(channel, true), RETRY_MS);
  }

  /* 応答コードが手元に無い経路については、ここで判定する。<video> の error は理由を持たないため、
   * プレイリストを取り直して 404 かどうかを見る。 */
  async function failByProbe() {
    let reason: 'idle' | 'waiting' = 'waiting';
    if (channel) {
      try {
        const res = await fetch(playlistUrl(channel), { cache: 'no-store' });
        if (res.status === 404) reason = 'idle';
      } catch {
        /* 取りに行けない。端末の通信が切れている */
      }
    }
    fail(reason);
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
        // resumeFn は操作する人がいないサイネージのためにある
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
      state = 'connecting';
    }

    const url = playlistUrl(ch);
    const canNative = !!el.canPlayType('application/vnd.apple.mpegurl');

    let Hls: HlsConstructor | null = null;
    try {
      Hls = await loadHlsJs();
    } catch {
      /* 読めなかった場合は下のネイティブ HLS の分岐へ進む */
    }
    const canHlsJs = !!(Hls && Hls.isSupported());

    // Safari はここへ入る。hls.js を使わずネイティブの HLS で再生する。
    if (!canHlsJs && canNative) {
      el.src = url;
      el.addEventListener('error', failByProbe, { once: true });
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
      // media-chrome は duration が Infinity のときライブとして描画する
      liveDurationInfinity: true,
      // 末端から 10 秒手前で再生する（セグメント 2 秒 × 5 本）。
      // +page.svelte の liveedgeoffset はこの距離より大きくする。
      liveSyncDurationCount: 5,
      // mediamtx.yml の hlsSegmentCount × セグメント長と同一にする（180 × 2 秒）
      backBufferLength: 360,
    });

    hls = instance;
    instance.on(H.Events.MANIFEST_PARSED, attemptPlay);
    instance.on(H.Events.ERROR, (_evt: string, data: HlsErrorData) => {
      if (!data.fatal) return;
      if (data.type === H.ErrorTypes.MEDIA_ERROR) {
        instance.recoverMediaError();
        return;
      }
      // 404 は MediaMTX が応答しており、その Ch に publish が無いことを表す。
      // それ以外（5xx・タイムアウト・通信断）は届いていない側の問題になる。
      fail(data.response?.code === 404 ? 'idle' : 'waiting');
    });

    instance.loadSource(url);
    instance.attachMedia(el);
  }

  /** <video> を渡して初期化する。戻り値は後片付けに使う。 */
  function attach(el: HTMLVideoElement) {
    video = el;
    const v = el;

    const onPlaying = () => {
      clearRetry();
      state = 'playing';
      live = true;
    };

    v.addEventListener('playing', onPlaying);
    v.addEventListener('error', failByProbe);
    v.addEventListener('ended', failByProbe);

    return () => {
      v.removeEventListener('playing', onPlaying);
      v.removeEventListener('error', failByProbe);
      v.removeEventListener('ended', failByProbe);
      teardown();
      video = null;
    };
  }

  return {
    get state() {
      return state;
    },
    get isLive() {
      return live;
    },
    resume: () => resumeFn?.(),
    // load() より先に呼ぶと、media-chrome の読み込みと並行して取得できる
    prefetch: () => {
      loadHlsJs().catch(() => {
        /* ネイティブ HLS で再生できる可能性があるので、ここでは状態を変えない */
      });
    },
    attach,
    load,
  };
}
