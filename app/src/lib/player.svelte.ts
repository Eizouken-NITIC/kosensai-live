import type { PlayerState } from './types';

// hls.js は動的 import で読むため、型は dist/hls.d.ts から導出する。
type HlsConstructor = typeof import('hls.js').default;
type HlsInstance = InstanceType<HlsConstructor>;
type HlsErrorData = import('hls.js').ErrorData;

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

// hls.js の retryForHttpStatus() は HTTP 4xx を再試行の対象外にしているため、
// 未配信のチャンネルが返す 404 は hls.js 側では一度も再試行されない。この
// タイマーはそのための再試行であり、5xx とタイムアウトは hls.js が受け持つ。
// 未配信である旨の表示は最初のエラーの時点で行うため、この間隔は表示までの
// 時間には影響しない。
const RETRY_MS = 5000;

/* hls.js は動的 import で読む。学内 LAN 完結の要件はバンドルへ含まれることで
   満たされ、Vite が別チャンクへ分割するため初期バンドルは膨らまない。
   Promise を保持して、読み込み中に再度呼ばれても import を二重に発行しない。 */
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
  /* 配信を受信できているかどうか。state から導出せず別に持つのは、Ch 切替で
     接続を張り直す間も直前の値を保つため。導出すると切り替えるたびに一度
     false へ落ち、ワードマークの LIVE が明滅する。実際に受信できなくなったこと
     （fail / blocked / unsupported）が判明した時点でのみ false にする。 */
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
        // モバイル・Kiosk の自動再生ブロック。resumeFn は、操作する人がいない
        // サイネージが自動で再試行するためにある。視聴ページは
        // <media-play-button> の操作がそのまま video.play() になる。
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
      // ライブ先頭に追従しつつ、Wi-Fi の揺れに耐えるバッファ設定。
      // 遡れる幅を制限しないため、許容遅延の上限（liveMaxLatencyDurationCount）は
      // 既定の Infinity のままにする。値を与えると、それを超えて巻き戻した時点で
      // hls.js が再生位置をライブ点へ戻す。
      lowLatencyMode: false,
      liveSyncDurationCount: 3,
      maxBufferLength: 20,
      // ライブとして再生させる。false（既定）だと duration がスライディング
      // ウィンドウの長さになり、プレイヤーが有限長の動画として扱ってしまう。
      // Infinity にすると media-chrome は seekable の範囲でシークバーを描く。
      liveDurationInfinity: true,
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
    /* hls.js のチャンクの取得を先に始める。load() の中で取りに行くと、
       config.json の取得完了を待ってからダウンロードとパースが始まり、
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
