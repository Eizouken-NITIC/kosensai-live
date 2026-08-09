import type { PlayerState } from './types';

// hls.js は動的 import で読むため、型は dist/hls.d.ts から導出する。
type HlsConstructor = typeof import('hls.js').default;
type HlsInstance = InstanceType<HlsConstructor>;
type HlsErrorData = import('hls.js').ErrorData;

// hls.js の retryForHttpStatus() が 4xx を再試行しないため、未配信の 404 は
// ここで拾う。5xx とタイムアウトは hls.js が受け持つ。
const RETRY_MS = 5000;

// 読み込み中に再度呼ばれても import を二重に発行しない
let hlsJsPromise: Promise<HlsConstructor> | null = null;

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

  function fail() {
    clearRetry();
    state = 'waiting';
    live = false;
    retryTimer = setTimeout(() => load(channel, true), RETRY_MS);
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
      // false だと duration がウィンドウ長になり、有限長の動画として扱われる
      liveDurationInfinity: true,
      // 既定は Infinity で、ページを開いてから取得した区間を一切破棄しない。
      // シークできる幅が際限なく伸びてシークバーの縮尺が変わり続けるうえ、
      // 無人で数時間動かすサイネージではメモリを消費し続ける。
      // mediamtx.yml の hlsSegmentCount: 180 × セグメント 2 秒に合わせる。
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
      state = 'playing';
      live = true;
    };

    v.addEventListener('playing', onPlaying);
    v.addEventListener('error', fail);
    v.addEventListener('ended', fail);

    return () => {
      v.removeEventListener('playing', onPlaying);
      v.removeEventListener('error', fail);
      v.removeEventListener('ended', fail);
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
    // config.json の取得を待たずに始める。直列にするとプレイリスト要求がその分遅れる
    prefetch: () => {
      loadHlsJs().catch(() => {
        /* ネイティブ HLS で再生できる可能性があるので、ここでは状態を変えない */
      });
    },
    attach,
    load,
  };
}
