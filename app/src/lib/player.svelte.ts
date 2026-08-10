import type { PlayerState } from './types';

// hls.jsは動的インポートするため、型はhls.jsから参照
type HlsConstructor = typeof import('hls.js').default;
type HlsInstance = InstanceType<HlsConstructor>;
type HlsErrorData = import('hls.js').ErrorData;

// 未配信（404）はここで検出する（5xxやタイムアウトはhls.jsが処理）
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
  // 切替時の明滅防止用の独立フラグ
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

  /* <video>のエラーは詳細を判別できないため、プレイリストの404を確認 */
  async function failByProbe() {
    let reason: 'idle' | 'waiting' = 'waiting';
    if (channel) {
      try {
        const res = await fetch(playlistUrl(channel), { cache: 'no-store' });
        if (res.status === 404) reason = 'idle';
      } catch {
        /* ネットワークオフライン */
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
        // サイネージなどの自動再生ブロックからの回復用
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
      /* インポート失敗時はネイティブ再生を試行 */
    }
    const canHlsJs = !!(Hls && Hls.isSupported());

    // Safari等のネイティブHLS環境用のフォールバック
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
      // media-chrome用のライブ配信認識設定
      liveDurationInfinity: true,
      // バッファ基準設定
      liveSyncDurationCount: 5,
      // MediaMTXの設定値に合わせたバッファ長（180 * 2秒）
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
      // 接続エラーまたは未配信状態のハンドリング
      fail(data.response?.code === 404 ? 'idle' : 'waiting');
    });

    instance.loadSource(url);
    instance.attachMedia(el);
  }

  /** video要素を接続する。戻り値はクリーンアップ関数 */
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
    // 事前にプリフェッチする
    prefetch: () => {
      loadHlsJs().catch(() => {
        /* ネイティブ再生の可能性があるため、プリフェッチ失敗時はエラー処理を遅延 */
      });
    },
    attach,
    load,
  };
}
