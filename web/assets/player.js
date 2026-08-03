/* player.js — 視聴ページ・サイネージページ共通の HLS 再生ロジック。
 *
 * DOM も見た目も触らない。状態を onState で呼び出し側に投げるだけにして、
 * 見せ方（文言・レイアウト）は各ページ側の責務にしてある。
 *
 * 状態:
 *   'waiting'     配信前 or 切断中。10 秒ごとに自動リトライ中
 *   'playing'     再生中
 *   'blocked'     ブラウザの自動再生ポリシーで止められた（ユーザー操作が必要）
 *   'unsupported' HLS を再生できないブラウザ
 */
(function (global) {
  'use strict';

  var RETRY_MS = 10000; // 配信開始前でも端末を放置しておけるよう自動リトライ

  // channels.json が読めなかったときの保険。中身は channels.json と揃えること。
  var FALLBACK_CHANNELS = [
    { id: 'ch1', label: 'Ch1 第一体育館', title: '第一体育館 メインステージ', desc: 'ステージ企画の中継' },
    { id: 'ch2', label: 'Ch2 第二体育館', title: '第二体育館 サブステージ', desc: '屋内展示・吹奏楽など' },
    { id: 'ch3', label: 'Ch3 屋外遊撃', title: '屋外遊撃カメラ', desc: '屋台エリア・校内の様子' },
    { id: 'ch4', label: 'Ch4 総合', title: '総合チャンネル', desc: 'ダイジェスト・CM・タイムテーブル' }
  ];

  /** channels.json を取得する。失敗しても再生自体は続行できるようにする。 */
  function loadChannels() {
    return fetch('/channels.json', { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) { throw new Error('HTTP ' + r.status); }
        return r.json();
      })
      .then(function (j) {
        return (j && j.channels && j.channels.length) ? j.channels : FALLBACK_CHANNELS;
      })
      .catch(function () {
        return FALLBACK_CHANNELS;
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
    var everPlayed = false;

    function emit(state, detail) {
      if (onState) { onState(state, detail || {}); }
    }

    function clearRetry() {
      if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    }

    function scheduleRetry() {
      clearRetry();
      retryTimer = setTimeout(function () { load(currentCh); }, RETRY_MS);
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

    function load(ch) {
      if (!ch) { return; }
      teardown();
      currentCh = ch;
      emit('waiting', { channel: ch, retried: everPlayed });

      var url = '/hls/' + ch + '/index.m3u8';
      var canNative = !!video.canPlayType('application/vnd.apple.mpegurl');
      var canHlsJs = !!(global.Hls && global.Hls.isSupported());

      // Safari(iOS/macOS) はネイティブ HLS の方が安定かつ省電力なので優先する
      if (!canHlsJs && canNative) {
        video.src = url;
        video.addEventListener('error', scheduleRetry, { once: true });
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
        emit('waiting', { channel: currentCh, retried: true });
        scheduleRetry();
      });

      hls.loadSource(url);
      hls.attachMedia(video);
    }

    video.addEventListener('playing', function () {
      clearRetry();
      everPlayed = true;
      emit('playing', { channel: currentCh });
    });
    video.addEventListener('error', scheduleRetry);
    video.addEventListener('ended', function () {
      emit('waiting', { channel: currentCh, retried: true });
      scheduleRetry();
    });

    // タブが背面に回ったらリトライを止め、戻ったらライブ先頭に復帰させる
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

  global.KosensaiPlayer = { create: create, loadChannels: loadChannels, RETRY_MS: RETRY_MS };
})(window);
