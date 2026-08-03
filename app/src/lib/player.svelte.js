/* HLS 再生の状態機械。
 *
 * 素の JS 版（旧 web/assets/player.js）から移植したもの。
 * 挙動はリハーサル環境で実機確認済みなので、ロジックは変えていない。
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
// 配信開始前に放置される場合は 10 秒間隔に落ち着かせる。
const RETRY_MS = [1000, 2000, 4000, 8000, 10000];

/** hls.js は static/vendor から読む（学内完結のため CDN を使わない） */
function loadHlsJs() {
  if (window.Hls) return Promise.resolve(window.Hls);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = '/vendor/hls.min.js';
    s.onload = () => resolve(window.Hls);
    s.onerror = () => reject(new Error('hls.js を読み込めなかった'));
    document.head.appendChild(s);
  });
}

export function createPlayer() {
  let state = $state('connecting');
  let channel = $state(null);

  let video = null;
  let hls = null;
  let retryTimer = null;
  let failures = 0;
  let resumeFn = null;

  function clearRetry() {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  }

  /** 取得に失敗したときの共通処理。待ち時間を延ばしつつ再試行する。 */
  function fail() {
    clearRetry();
    const wait = RETRY_MS[Math.min(failures, RETRY_MS.length - 1)];
    failures += 1;
    state = 'waiting';
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
      });
    }
  }

  /**
   * @param {string} ch
   * @param {boolean} [isRetry] 内部からの再試行か。
   *   外から呼ぶとき（初回・Ch 切替）は省略する。バックオフが初期化される。
   */
  async function load(ch, isRetry = false) {
    if (!ch || !video) return;
    teardown();
    channel = ch;
    if (!isRetry) {
      failures = 0;
      state = 'connecting';
    }

    const url = `/hls/${ch}/index.m3u8`;
    const canNative = !!video.canPlayType('application/vnd.apple.mpegurl');

    let Hls = null;
    try {
      Hls = await loadHlsJs();
    } catch {
      /* 読めなければネイティブ側に賭ける */
    }
    const canHlsJs = !!(Hls && Hls.isSupported());

    // Safari(iOS/macOS) はネイティブ HLS の方が安定かつ省電力なので優先する
    if (!canHlsJs && canNative) {
      video.src = url;
      video.addEventListener('error', fail, { once: true });
      attemptPlay();
      return;
    }
    if (!canHlsJs) {
      state = 'unsupported';
      return;
    }

    hls = new Hls({
      // ライブ先頭に追従しつつ、Wi-Fi の揺れに耐えるバッファ設定
      lowLatencyMode: false,
      liveSyncDurationCount: 3,
      liveMaxLatencyDurationCount: 10,
      maxBufferLength: 20,
      manifestLoadingMaxRetry: 2,
      levelLoadingMaxRetry: 4,
      fragLoadingMaxRetry: 4
    });

    hls.on(Hls.Events.MANIFEST_PARSED, attemptPlay);
    hls.on(Hls.Events.ERROR, (_evt, data) => {
      if (!data.fatal) return;
      if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        hls.recoverMediaError();
        return;
      }
      // NETWORK_ERROR の 404 = MediaMTX にまだ publish されていない = 配信開始前
      fail();
    });

    hls.loadSource(url);
    hls.attachMedia(video);
  }

  /** <video> を渡して初期化する。Svelte の use: から呼ぶ。 */
  function attach(el) {
    video = el;

    const onPlaying = () => {
      clearRetry();
      failures = 0;
      state = 'playing';
    };
    const onVisibility = () => {
      if (document.hidden) {
        clearRetry();
      } else if (channel && (video.paused || video.readyState < 3)) {
        // 復帰は「新しい接続」扱いにして、待たされずにすぐ試す
        load(channel);
      }
    };

    video.addEventListener('playing', onPlaying);
    video.addEventListener('error', fail);
    video.addEventListener('ended', fail);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('error', fail);
      video.removeEventListener('ended', fail);
      document.removeEventListener('visibilitychange', onVisibility);
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
      return state === 'playing';
    },
    resume: () => resumeFn?.(),
    attach,
    load
  };
}
