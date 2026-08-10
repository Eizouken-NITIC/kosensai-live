<script lang="ts">
  import { onMount } from 'svelte';
  import { createPlayer } from '$lib/player.svelte.js';
  import { loadMediaChrome, keepLiveButtonEnabled } from '$lib/mediaChrome';
  import { setNowPlaying } from '$lib/mediaSession';
  import { setThemeColor } from '$lib/themeColor';
  import Logo from '$lib/components/Logo.svelte';
  import EmbeddedSite from '$lib/components/EmbeddedSite.svelte';
  import { channels, site } from '$lib/config';

  const DEFAULT_CH = 'ch1';
  const STORE_KEY = 'selectedChannel';
  const OVERLAY_HIDE_MS = 2000;
  // 読み込み直後、ミュートであることを示す吹き出しをこの時間だけ表示しておく。
  const MUTE_HINT_MS = 10000;

  const PANEL_INITIAL = 360;
  const PANEL_MIN = 280;
  const PANEL_MAX_RATIO = 0.6;
  // 矢印キー 1 打あたりの変化量である。Shift を押している間は大きく動かす。
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

  // 映像が無い画面で UI まで消えると黒い板になる
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
      /* プライベートブラウズ */
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
    // 別プロセスで描かれる iframe の上にポインタが入ると、捕捉していても
    // そちらへ配送されて捕捉が解ける。ドラッグの間だけ当たり判定を外す。
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
    // ドラッグ中に映像やパネルの文字が選択されるのを止める。
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
        /* プライベートブラウズ */
      }
    }
    select(initial ?? DEFAULT_CH, false);

    return () => {
      clearTimeout(hideTimer);
      clearTimeout(hintTimer);
      v.removeEventListener('volumechange', onVolumeChange);
      releaseLiveBtn();
      detach();
    };
  });

  // ブラウザの UI の色を再生の状態に合わせる。
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

<!-- section に付けると a11y_no_static_element_interactions が出るので body で受ける -->
<svelte:body onmousemove={showOverlay} onpointerdown={showOverlay} onfocusin={showOverlay} />
<svelte:window bind:innerWidth={winWidth} />

<div class="page screen" class:dragging>
  <!-- 幅 1000px 以上では映像と同じグリッドのセルに置いて重ね、それ未満では
       映像の上の行に積む。縦画面では映像が 16:9 に収まるため、重ねると
       映像の大部分が隠れる。タッチにはホバーが無く、消すこともできない。 -->
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
    <!-- mediastreamtype: MediaMTX は DVR 判定用の非標準タグを含めないため明示する。
         seektoliveoffset: 既定は liveedgeoffset と同値で、LIVE ボタンが通常の再生位置
           よりも後ろへ移動してしまう。0 は末端を指す。
         liveedgeoffset: 通常の再生位置は末端から 10 秒手前である。セグメント 1 本分を余裕と
           して加える。狭めると再生位置の揺れで LIVE の点灯が変化する。 -->
    <media-controller mediastreamtype="live" seektoliveoffset="0" liveedgeoffset="12">
      <!-- svelte-ignore a11y_media_has_caption -->
      <video slot="media" bind:this={videoEl} playsinline muted autoplay preload="none"></video>

      <!-- 自動再生の制約でミュート起動するため、音を出すには操作が要る。
           消えてしまうとミュートボタンに気づけないので、解除するまで消さない。 -->
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
        <!-- 自動リトライは続いているが、待てない人のために手動の出口も表示する。 -->
        <button class="retry" type="button" onclick={() => player.load(current)}>
          今すぐ再読み込み
        </button>
      </div>
    {:else if player.state === 'unsupported'}
      <div class="cover" role="status">
        <p>このブラウザでは再生できません</p>
        <small>Safari / Chrome の最新版でお試しください</small>
      </div>
    {/if}
  </section>

  <!-- 幅 1000px 以上でのみ出る。映像とパネルの境界そのものを掴ませる。
       CSS の resize は隅の正方形しか作れないため、辺で掴ませるには
       role="separator" のスプリッターを置くほかにない。 -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <!-- ARIA は separator を、値を持つもの（window splitter）と持たないものに
       分けている。前者はフォーカスを受けて矢印キーで動かす操作要素であり、
       aria-valuenow を持つこの要素はそちらに当たる。 -->
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
