/* player.js — 視聴ページ・サイネージページ共通の HLS 再生ロジック。
 *
 * DOM も見た目も触らない。状態を onState で呼び出し側に投げるだけにして、
 * 見せ方（文言・レイアウト）は各ページ側の責務にしてある。
 *
 * 状態:
 *   'connecting'  接続を試している最中。まだ失敗していない
 *   'playing'     再生中
 *   'waiting'     実際に取得に失敗した（＝その Ch はまだ配信されていない）
 *   'blocked'     ブラウザの自動再生ポリシーで止められた（ユーザー操作が必要）
 *   'unsupported' HLS を再生できないブラウザ
 *
 * connecting と waiting を分けているのは、Ch を切り替えた直後に
 * 「まだ配信が始まっていない」と断定してしまわないため。
 */
(function (global) {
  'use strict';

  // 失敗のたびに間隔を延ばす。切り替え直後の一時的な失敗からは素早く復帰し、
  // 配信開始前に放置される場合は 10 秒間隔に落ち着かせる。
  var RETRY_MS = [1000, 2000, 4000, 8000, 10000];

  // config.json が読めなかったときの保険。中身は config.json と揃えること。
  var FALLBACK_CONFIG = {
    officialSite: {
      homeUrl: 'https://kosensai.ichinoseki.ac.jp/',
      embedUrl: 'https://kosensai.ichinoseki.ac.jp/',
      label: 'タイムテーブル・お知らせ'
    },
    channels: [
      { id: 'ch1', label: 'Ch1 第一体育館', title: '第一体育館 メインステージ', desc: 'ステージ企画の中継' },
      { id: 'ch2', label: 'Ch2 第二体育館', title: '第二体育館 サブステージ', desc: '屋内展示・吹奏楽など' },
      { id: 'ch3', label: 'Ch3 屋外遊撃', title: '屋外遊撃カメラ', desc: '屋台エリア・校内の様子' },
      { id: 'ch4', label: 'Ch4 総合', title: '総合チャンネル', desc: 'ダイジェスト・CM・タイムテーブル' }
    ]
  };

  /** config.json を取得する。失敗しても再生自体は続行できるようにする。 */
  function loadConfig() {
    return fetch('/config.json', { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) { throw new Error('HTTP ' + r.status); }
        return r.json();
      })
      .then(function (j) {
        return {
          officialSite: (j && j.officialSite) || FALLBACK_CONFIG.officialSite,
          channels: (j && j.channels && j.channels.length) ? j.channels : FALLBACK_CONFIG.channels
        };
      })
      .catch(function () {
        return FALLBACK_CONFIG;
      });
  }

  /**
   * @param {HTMLVideoElement} video
   * @param {(state:string, detail:object) => void} onState
   */
  function create(video, onState) {
    var hls = null;
    var retryTimer = null;
    var currentCh = null;
    var failures = 0;

    function emit(state, detail) {
      if (onState) { onState(state, detail || {}); }
    }

    function clearRetry() {
      if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    }

    /** 取得に失敗したときの共通処理。待ち時間を延ばしつつ再試行する。 */
    function fail() {
      clearRetry();
      var wait = RETRY_MS[Math.min(failures, RETRY_MS.length - 1)];
      failures += 1;
      emit('waiting', { channel: currentCh, attempt: failures, nextRetryMs: wait });
      retryTimer = setTimeout(function () { load(currentCh, true); }, wait);
    }

    function teardown() {
      clearRetry();
      if (hls) { hls.destroy(); hls = null; }
      video.removeAttribute('src');
      try { video.load(); } catch (e) { /* noop */ }
    }

    function attemptPlay() {
      var p = video.play();
      if (p && p.catch) {
        p.catch(function () {
          // モバイル・Kiosk の自動再生ブロック。ユーザー操作を 1 回もらう。
          emit('blocked', { resume: function () { video.play().catch(function () {}); } });
        });
      }
    }

    /**
     * @param {string} ch
     * @param {boolean} [isRetry] 内部からの再試行かどうか。
     *   外から呼ぶとき（初回・Ch 切替）は省略する。バックオフが初期化される。
     */
    function load(ch, isRetry) {
      if (!ch) { return; }
      teardown();
      currentCh = ch;
      if (!isRetry) {
        failures = 0;
        emit('connecting', { channel: ch });
      }

      var url = '/hls/' + ch + '/index.m3u8';
      var canNative = !!video.canPlayType('application/vnd.apple.mpegurl');
      var canHlsJs = !!(global.Hls && global.Hls.isSupported());

      // Safari(iOS/macOS) はネイティブ HLS の方が安定かつ省電力なので優先する
      if (!canHlsJs && canNative) {
        video.src = url;
        video.addEventListener('error', fail, { once: true });
        attemptPlay();
        return;
      }

      if (!canHlsJs) {
        emit('unsupported', {});
        return;
      }

      hls = new global.Hls({
        // ライブ先頭に追従しつつ、Wi-Fi の揺れに耐えるバッファ設定
        lowLatencyMode: false,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10,
        maxBufferLength: 20,
        manifestLoadingMaxRetry: 2,
        levelLoadingMaxRetry: 4,
        fragLoadingMaxRetry: 4
      });

      hls.on(global.Hls.Events.MANIFEST_PARSED, attemptPlay);

      hls.on(global.Hls.Events.ERROR, function (_evt, data) {
        if (!data.fatal) { return; }
        if (data.type === global.Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
          return;
        }
        // NETWORK_ERROR の 404 = MediaMTX にまだ publish されていない = 配信開始前
        fail();
      });

      hls.loadSource(url);
      hls.attachMedia(video);
    }

    video.addEventListener('playing', function () {
      clearRetry();
      failures = 0;
      emit('playing', { channel: currentCh });
    });
    video.addEventListener('error', fail);
    video.addEventListener('ended', fail);

    // タブが背面に回ったらリトライを止め、戻ったらライブ先頭に復帰させる。
    // 復帰は「新しい接続」扱いにして、待たされずにすぐ試す。
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        clearRetry();
      } else if (currentCh && (video.paused || video.readyState < 3)) {
        load(currentCh);
      }
    });

    return {
      load: load,
      current: function () { return currentCh; },
      destroy: teardown
    };
  }

  global.KosensaiPlayer = { create: create, loadConfig: loadConfig };
})(window);
