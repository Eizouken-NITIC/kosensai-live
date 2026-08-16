import type { PlayerState, PlayerSync } from './types';

// hls.jsは動的インポートするため、型はhls.jsから参照する
type HlsConstructor = typeof import('hls.js').default;
type HlsInstance = InstanceType<HlsConstructor>;
type HlsErrorData = import('hls.js').ErrorData;
type HlsConfig = import('hls.js').HlsConfig;

// 未配信（404）はここで検出する（5xxやタイムアウトはhls.jsが処理する）
const RETRY_MS = 5000;

/**
 * PlayerSync ごとの hls.js の設定。
 *
 * 各カウントは mediamtx.yml の hlsSegmentDuration（2 秒）の倍数として効く。
 *
 * live 側の maxLiveSyncPlaybackRate と liveMaxLatencyDurationCount が、遅れを詰め戻す
 * ための設定である。hls.js の既定はどちらも無効で、一度遅れるとその遅れを抱えたまま
 * 再生し続ける。小さな遅れは再生速度を 5% 上げて目立たないうちに詰め、シークが必要な
 * ほど開いた場合だけ先端へ飛ばす。再生速度を上げても音の高さは変わらない
 * （HTMLMediaElement の preservesPitch が既定で有効なため）。
 */
const SYNC_CONFIG: Record<PlayerSync, Partial<HlsConfig>> = {
  dvr: {
    // 先端から 10 秒後方に構える。回線が細っても数秒なら途切れない
    liveSyncDurationCount: 5,
    // mediamtx.yml の hlsSegmentCount と同一にする（180 × 2 秒）
    backBufferLength: 360,
  },
  live: {
    // 先端から 6 秒後方に構える。会場内の有線・近接 Wi-Fi を前提にできるので短く設定する
    liveSyncDurationCount: 3,
    // 20 秒以上開いたら先端へシークする（再生速度では現実的な時間で詰まらない）
    liveMaxLatencyDurationCount: 10,
    maxLiveSyncPlaybackRate: 1.05,
    // 巻き戻さないので過去は捨てる。Raspberry Pi で何時間も抱え込ませない
    backBufferLength: 30,
  },
};

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

export function createPlayer(sync: PlayerSync = 'dvr') {
  let state = $state<PlayerState>('connecting');
  let channel = $state<string | null>(null);
  // チャンネル切替時の明滅を防止するための独立したフラグである
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

  /* <video>のエラーは詳細を判別できないため、プレイリストの404を確認する */
  async function failByProbe() {
    let reason: 'idle' | 'waiting' = 'waiting';
    if (channel) {
      try {
        const res = await fetch(playlistUrl(channel), { cache: 'no-store' });
        if (res.status === 404) reason = 'idle';
      } catch {
        /* ネットワークがオフラインの場合はここで例外を捕捉し、reason は既定値の 'waiting' のままにする */
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
        // 自動再生がブロックされた場合に、サイネージなどで再生を再開するために使用する
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

    // Safari等のネイティブHLS環境用のフォールバックである
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
      // media-chromeがライブ配信と認識するための設定である
      liveDurationInfinity: true,
      ...SYNC_CONFIG[sync],
    });

    hls = instance;
    instance.on(H.Events.MANIFEST_PARSED, attemptPlay);
    instance.on(H.Events.ERROR, (_evt: string, data: HlsErrorData) => {
      if (!data.fatal) return;
      if (data.type === H.ErrorTypes.MEDIA_ERROR) {
        instance.recoverMediaError();
        return;
      }
      // 接続エラーまたは未配信状態をここで処理する
      fail(data.response?.code === 404 ? 'idle' : 'waiting');
    });

    instance.loadSource(url);
    instance.attachMedia(el);
  }

  /** video要素を接続する。戻り値はクリーンアップ関数である */
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
        /* ネイティブ再生の可能性があるため、プリフェッチ失敗時のエラー処理を遅延させる */
      });
    },
    attach,
    load,
  };
}
