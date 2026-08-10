<script lang="ts">
  import { onMount } from 'svelte';
  import { createPlayer } from '$lib/player.svelte.js';
  import { loadMediaChrome, keepLiveButtonEnabled } from '$lib/mediaChrome';
  import { setNowPlaying } from '$lib/mediaSession';
  import { setThemeColor } from '$lib/themeColor';
  import Logo from '$lib/components/Logo.svelte';
  import EmbeddedSite from '$lib/components/EmbeddedSite.svelte';
  import { startOnboarding } from '$lib/onboarding';
  import { channels, site } from '$lib/config';

  const DEFAULT_CH = 'ch1';
  const STORE_KEY = 'selectedChannel';
  const OVERLAY_HIDE_MS = 2000;
  // 初回起動時のミュート吹き出しの表示時間
  const MUTE_HINT_MS = 10000;

  const PANEL_INITIAL = 360;
  const PANEL_MIN = 280;
  const PANEL_MAX_RATIO = 0.6;
  // キーボード操作時のパネル幅の変化幅
  const PANEL_STEP = 16;
  const PANEL_STEP_LARGE = 64;

  const player = createPlayer();

  let current = $state(DEFAULT_CH);
  let overlayVisible = $state(true);
  let videoEl = $state<HTMLVideoElement | null>(null);
  let liveBtn = $state<HTMLElement | null>(null);
  // 自動再生の制約でミュート起動する。解除するまでコントロールを消さない。
  let muted = $state(true);
  let muteHint = $state(false);
  let panelWidth = $state(PANEL_INITIAL);
  let dragging = $state(false);
  let winWidth = $state(0);
  const panelMax = $derived(Math.round(winWidth * PANEL_MAX_RATIO));

  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  // 映像未配信時にUIを固定表示するためのフラグ
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
      /* ローカルストレージ無効時 */
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
    // ドラッグ中にiframeへのポインター干渉を防ぐフラグ
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
    // ドラッグ中の選択などのデフォルト挙動を防止
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
        /* ローカルストレージ無効時 */
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

  // 再生状態に応じてテーマカラーを変更
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

<!-- a11yエラー防止のためbody要素でイベントを受信 -->
<svelte:body onmousemove={showOverlay} onpointerdown={showOverlay} onfocusin={showOverlay} />
<svelte:window bind:innerWidth={winWidth} />

<div class="page screen" class:dragging>
  <!-- レスポンシブレイアウト（幅1000px基準）の配置 -->
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
    <!-- ライブ配信用のコントローラー制御 -->
    <media-controller mediastreamtype="live" seektoliveoffset="0" liveedgeoffset="12">
      <!-- svelte-ignore a11y_media_has_caption -->
      <video slot="media" bind:this={videoEl} playsinline muted autoplay preload="none"></video>

      <!-- 自動再生制約への対応（ミュート解除まで非表示にしない） -->
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
        <!-- 手動の再読み込みボタン -->
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

  <!-- 幅調整用のスプリッター -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <!-- キーボード操作（Aria）対応セパレーター -->
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
    <EmbeddedSite allowPopups withLink />
  </aside>
</div>
