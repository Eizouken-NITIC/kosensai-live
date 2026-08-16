<script lang="ts">
  import { onMount } from 'svelte';
  import { createPlayer } from '$lib/player.svelte.js';
  import { loadMediaChrome, keepLiveButtonEnabled } from '$lib/mediaChrome';
  import { setNowPlaying } from '$lib/mediaSession';
  import { setThemeColor } from '$lib/themeColor';
  import Logo from '$lib/components/Logo.svelte';
  import EmbeddedSite from '$lib/components/EmbeddedSite.svelte';
  import GitHubIcon from '$lib/components/GitHubIcon.svelte';
  import { startOnboarding } from '$lib/onboarding';
  import { channels, site, externalSite, viewer } from '$lib/config';

  const DEFAULT_CH = viewer.defaultChannel;
  const STORE_KEY = 'selectedChannel';
  const OVERLAY_HIDE_MS = 2000;
  // 初回起動時にミュート吹き出しを表示する時間である
  const MUTE_HINT_MS = 10000;

  const PANEL_INITIAL = 360;
  const PANEL_MIN = 280;
  const PANEL_MAX_RATIO = 0.6;
  // キーボード操作時にパネル幅を変化させる量である
  const PANEL_STEP = 16;
  const PANEL_STEP_LARGE = 64;

  const player = createPlayer();

  let current = $state(DEFAULT_CH);
  let overlayVisible = $state(true);
  let videoEl = $state<HTMLVideoElement | null>(null);
  let liveBtn = $state<HTMLElement | null>(null);
  // 自動再生の制約でミュート起動する。解除するまでコントロールを非表示にしない。
  let muted = $state(true);
  let muteHint = $state(false);
  let panelWidth = $state(PANEL_INITIAL);
  let dragging = $state(false);
  let winWidth = $state(0);
  const panelMax = $derived(Math.round(winWidth * PANEL_MAX_RATIO));

  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  // 映像が未配信のときにUIを固定表示するためのフラグである
  const pinned = $derived(!player.isLive);

  function showOverlay() {
    overlayVisible = true;
    clearTimeout(hideTimer);
    if (!pinned) hideTimer = setTimeout(() => (overlayVisible = false), OVERLAY_HIDE_MS);
  }

  function select(id: string | null, updateUrl = true) {
    const ch = channels.find((c) => c.id === id) ?? channels[0];
    if (!ch) return;
    current = ch.id;
    document.title = `${ch.label} | ${site.name}`;
    setNowPlaying(ch.label, site.name);
    if (updateUrl) history.replaceState(null, '', `?ch=${ch.id}`);
    try {
      localStorage.setItem(STORE_KEY, ch.id);
    } catch {
      /* ローカルストレージへ書き込めない場合は選択の保存を諦め、再生はそのまま続行する */
    }
    player.load(ch.id);
    showOverlay();
  }

  function clampPanel(px: number): number {
    return Math.round(Math.min(panelMax, Math.max(PANEL_MIN, px)));
  }

  /* パネルは右にあるので、境界を左へ動かすと幅は増える。 */
  function onGripPointerDown(event: PointerEvent) {
    const grip = event.currentTarget as HTMLElement;
    const startX = event.clientX;
    const startWidth = panelWidth;

    grip.setPointerCapture(event.pointerId);
    // ドラッグ中にiframeへポインターイベントが奪われないようにするフラグである
    dragging = true;

    const onMove = (e: PointerEvent) =>
      (panelWidth = clampPanel(startWidth - (e.clientX - startX)));
    const onUp = (e: PointerEvent) => {
      dragging = false;
      grip.releasePointerCapture(e.pointerId);
      grip.removeEventListener('pointermove', onMove);
      grip.removeEventListener('pointerup', onUp);
      grip.removeEventListener('pointercancel', onUp);
    };

    grip.addEventListener('pointermove', onMove);
    grip.addEventListener('pointerup', onUp);
    grip.addEventListener('pointercancel', onUp);
    // ドラッグ中にテキスト選択などのデフォルト挙動が起こらないようにする
    event.preventDefault();
  }

  function onGripKeyDown(event: KeyboardEvent) {
    const step = event.shiftKey ? PANEL_STEP_LARGE : PANEL_STEP;
    if (event.key === 'ArrowLeft') panelWidth = clampPanel(panelWidth + step);
    else if (event.key === 'ArrowRight') panelWidth = clampPanel(panelWidth - step);
    else return;
    event.preventDefault();
  }

  onMount(() => {
    player.prefetch();
    loadMediaChrome();

    if (!videoEl) return;
    const v = videoEl;
    const detach = player.attach(v);
    const releaseLiveBtn = keepLiveButtonEnabled(liveBtn);

    const onVolumeChange = () => {
      muted = v.muted;
      if (!v.muted) muteHint = false;
    };
    v.addEventListener('volumechange', onVolumeChange);

    muteHint = v.muted;
    const hintTimer = setTimeout(() => (muteHint = false), MUTE_HINT_MS);

    let initial = new URLSearchParams(location.search).get('ch');
    if (!initial) {
      try {
        initial = localStorage.getItem(STORE_KEY);
      } catch {
        /* ローカルストレージを読み取れない場合は initial を null のままにし、既定チャンネルへフォールバックする */
      }
    }
    select(initial ?? DEFAULT_CH, false);
    startOnboarding();

    return () => {
      clearTimeout(hideTimer);
      clearTimeout(hintTimer);
      v.removeEventListener('volumechange', onVolumeChange);
      releaseLiveBtn();
      detach();
    };
  });

  // 再生状態に応じてテーマカラーを変更する
  $effect(() => {
    setThemeColor(player.isLive ? '--live' : '--surface');
  });

  $effect(() => {
    if (pinned) {
      clearTimeout(hideTimer);
      overlayVisible = true;
    }
  });
</script>

<svelte:head><title>{site.name}</title></svelte:head>

<!-- a11yエラーを防止するため、body要素でイベントを受信する -->
<svelte:body onmousemove={showOverlay} onpointerdown={showOverlay} onfocusin={showOverlay} />
<svelte:window bind:innerWidth={winWidth} />

<div class="page screen" class:dragging>
  <!-- 幅1000pxを基準に、レスポンシブレイアウトへ配置を切り替える -->
  <div class="topbar" class:visible={overlayVisible || pinned}>
    <div class="bar">
      <Logo live={player.isLive} />

      <nav aria-label="チャンネル">
        {#each channels as ch (ch.id)}
          <button
            type="button"
            aria-current={ch.id === current ? 'true' : undefined}
            onclick={() => select(ch.id)}
          >
            {ch.label}
          </button>
        {/each}
      </nav>
    </div>
  </div>

  <section class="stage">
    <!-- ライブ配信向けにコントローラーの動作を設定する -->
    <media-controller mediastreamtype="live" seektoliveoffset="0" liveedgeoffset="12">
      <!-- svelte-ignore a11y_media_has_caption -->
      <video slot="media" bind:this={videoEl} playsinline muted autoplay preload="none"></video>

      <!-- 自動再生の制約に対応するため、ミュート解除まで非表示にしない -->
      <media-control-bar noautohide={muted || undefined}>
        <media-play-button></media-play-button>
        <media-mute-button class:hint={muteHint}>
          {#if muteHint}<span slot="tooltip-content">ミュート中です！</span>{/if}
        </media-mute-button>
        <media-volume-range></media-volume-range>
        <media-time-range></media-time-range>
        <media-live-button bind:this={liveBtn}></media-live-button>
        <media-pip-button></media-pip-button>
        <media-fullscreen-button></media-fullscreen-button>
      </media-control-bar>
    </media-controller>

    {#if player.state === 'connecting'}
      <div class="cover" role="status" aria-live="polite">
        <p>読み込み中…</p>
      </div>
    {:else if player.state === 'idle'}
      <div class="cover" role="status" aria-live="polite">
        <p>このチャンネルは配信されていません</p>
      </div>
    {:else if player.state === 'waiting'}
      <div class="cover" role="status" aria-live="polite">
        <p>接続中です...</p>
        <!-- 利用者が手動で再読み込みできるボタンである -->
        <button class="retry" type="button" onclick={() => player.load(current)}>
          今すぐ再読み込み
        </button>
      </div>
    {:else if player.state === 'unsupported'}
      <div class="cover" role="status">
        <p>このブラウザでは再生できません</p>
        <small>ブラウザの最新版でお試しください</small>
      </div>
    {/if}
  </section>

  <!-- ここはパネル幅を調整するスプリッターである -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <!-- キーボード操作とARIAに対応したセパレーターである -->
  <div
    class="grip"
    role="separator"
    aria-orientation="vertical"
    aria-label="パネルの幅"
    aria-valuenow={panelWidth}
    aria-valuemin={PANEL_MIN}
    aria-valuemax={panelMax}
    tabindex="0"
    onpointerdown={onGripPointerDown}
    onkeydown={onGripKeyDown}
  ></div>

  <aside class="panel" style="--panel-w: {panelWidth}px">
    <EmbeddedSite allowPopups />
    <div class="panel-links">
      {#if site.repository}
        <a
          class="panel-link gh"
          href={site.repository}
          target="_blank"
          rel="noopener"
          aria-label="GitHub"
        >
          <GitHubIcon />
        </a>
      {/if}
      {#if externalSite.homeUrl}
        <a class="panel-link external" href={externalSite.homeUrl} target="_blank" rel="noopener">
          {externalSite.title}を開く ↗
        </a>
      {/if}
    </div>
  </aside>
</div>
