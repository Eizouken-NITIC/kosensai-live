<script lang="ts">
  import { onMount } from 'svelte';
  import { createPlayer } from '$lib/player.svelte.js';
  import Wordmark from '$lib/components/Wordmark.svelte';
  import { channels, officialSite } from '$lib/config';

  const DEFAULT_CH = 'ch1';
  const STORE_KEY = 'kosensai.ch';
  const PANEL_KEY = 'kosensai.panel';
  const OVERLAY_HIDE_MS = 2000;

  // 右カラムの幅。下限は公式サイトが 1 カラムに折り返す幅、
  // 上限は映像が 16:9 を保てる範囲として画面幅の 6 割とする。
  const PANEL_MIN = 280;
  const PANEL_DEFAULT = 360;

  const player = createPlayer();

  let current = $state(DEFAULT_CH);
  let overlayVisible = $state(true);
  let videoEl = $state<HTMLVideoElement | null>(null);
  let liveBtn = $state<HTMLElement | null>(null);
  let panelW = $state(PANEL_DEFAULT);
  let dragging = $state(false);

  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  // 映像が無い画面で UI まで消えると黒い板になる
  const pinned = $derived(!player.isLive);

  function showOverlay() {
    overlayVisible = true;
    clearTimeout(hideTimer);
    if (!pinned) hideTimer = setTimeout(() => (overlayVisible = false), OVERLAY_HIDE_MS);
  }

  function clampPanel(px: number) {
    return Math.round(Math.min(Math.max(px, PANEL_MIN), window.innerWidth * 0.6));
  }

  // setPointerCapture により、ポインタが iframe の上へ入っても move が届き続ける
  function startResize(e: PointerEvent) {
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    dragging = true;
  }

  function moveResize(e: PointerEvent) {
    if (!dragging) return;
    panelW = clampPanel(window.innerWidth - e.clientX);
  }

  function endResize(e: PointerEvent) {
    if (!dragging) return;
    dragging = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    try {
      localStorage.setItem(PANEL_KEY, String(panelW));
    } catch {
      /* プライベートブラウズ */
    }
  }

  function resetPanel() {
    panelW = PANEL_DEFAULT;
    try {
      localStorage.removeItem(PANEL_KEY);
    } catch {
      /* プライベートブラウズ */
    }
  }

  function select(id: string | null, updateUrl = true) {
    const ch = channels.find((c) => c.id === id) ?? channels[0];
    if (!ch) return;
    current = ch.id;
    document.title = `${ch.label} | KOSENSAI-LIVE`;
    if (updateUrl) history.replaceState(null, '', `?ch=${ch.id}`);
    try {
      localStorage.setItem(STORE_KEY, ch.id);
    } catch {
      /* プライベートブラウズ */
    }
    player.load(ch.id);
    showOverlay();
  }

  onMount(() => {
    player.prefetch();

    // カスタム要素の定義には DOM が要るので prerender 時には読めない
    Promise.all([
      import('media-chrome/dist/media-controller.js'),
      import('media-chrome/dist/media-control-bar.js'),
      import('media-chrome/dist/media-play-button.js'),
      import('media-chrome/dist/media-mute-button.js'),
      import('media-chrome/dist/media-volume-range.js'),
      import('media-chrome/dist/media-time-range.js'),
      import('media-chrome/dist/media-live-button.js'),
      import('media-chrome/dist/media-fullscreen-button.js'),
    ]).catch(() => {
      /* コントロールが出ないだけで再生は続く */
    });

    if (!videoEl) return;
    const detach = player.attach(videoEl);

    // media-chrome の LIVE ボタンは、再生中かつ先端と判定されている間クリックを
    // 無視する。先端の判定には liveedgeoffset の 8 秒の幅があるため、その範囲内で
    // 数秒遅れていても押せない。無視される条件のときだけ、こちらから要求を出す。
    const btn = liveBtn;
    const onLiveClick = () => {
      if (!btn) return;
      if (btn.hasAttribute('mediapaused') || !btn.hasAttribute('mediatimeislive')) return;
      btn.dispatchEvent(
        new CustomEvent('mediaseektoliverequest', { composed: true, bubbles: true }),
      );
    };
    btn?.addEventListener('click', onLiveClick);

    // 同じ条件で aria-disabled も付くが、上のとおり実際には操作できる。
    // 支援技術へ誤った状態を伝えないよう取り除く。
    const ariaFix = new MutationObserver(() => {
      if (btn?.getAttribute('aria-disabled') === 'true') btn.removeAttribute('aria-disabled');
    });
    if (btn) ariaFix.observe(btn, { attributes: true, attributeFilter: ['aria-disabled'] });

    try {
      const saved = Number(localStorage.getItem(PANEL_KEY));
      if (saved) panelW = clampPanel(saved);
    } catch {
      /* プライベートブラウズ */
    }

    const params = new URLSearchParams(location.search);
    let initial = params.get('ch');
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
      btn?.removeEventListener('click', onLiveClick);
      ariaFix.disconnect();
      detach();
    };
  });

  $effect(() => {
    if (pinned) {
      clearTimeout(hideTimer);
      overlayVisible = true;
    }
  });
</script>

<svelte:head><title>KOSENSAI-LIVE</title></svelte:head>

<!-- section に付けると a11y_no_static_element_interactions が出るので body で受ける -->
<svelte:body onmousemove={showOverlay} onpointerdown={showOverlay} onfocusin={showOverlay} />

<div class="page" class:dragging style="--panel-w: {panelW}px">
  <section class="stage">
    <!-- mediastreamtype: MediaMTX は DVR 判定用の非標準タグを出さないため明示する。
         seektoliveoffset: 既定は liveedgeoffset と同値で、LIVE ボタンが通常の再生位置
           よりも後ろへ移動してしまう。0 は末端を指す。
         liveedgeoffset: 通常の再生位置は末端から 6 秒手前。セグメント 1 本分を余裕と
           して加える。狭めると再生位置の揺れで LIVE の点灯が変化する。 -->
    <media-controller mediastreamtype="live" seektoliveoffset="0" liveedgeoffset="8">
      <!-- svelte-ignore a11y_media_has_caption -->
      <video slot="media" bind:this={videoEl} playsinline muted autoplay preload="none"></video>

      <media-control-bar>
        <media-play-button></media-play-button>
        <media-mute-button></media-mute-button>
        <media-volume-range></media-volume-range>
        <media-time-range></media-time-range>
        <media-live-button bind:this={liveBtn}></media-live-button>
        <media-fullscreen-button></media-fullscreen-button>
      </media-control-bar>
    </media-controller>

    <div class="scrim topbar" class:visible={overlayVisible || pinned}>
      <div class="topbar-inner">
        <Wordmark live={player.isLive} />

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

    <!-- 接続中は出さない。読み込み表示はプレイヤーに任せる -->
    {#if player.state === 'waiting'}
      <div class="cover" role="status" aria-live="polite">
        <p>このチャンネルはまだ配信されていません</p>
        <small>始まると自動で再生されます</small>
        <!-- 自動リトライは続いているが、待てない人のために手動の出口も出す。 -->
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

  <!-- 幅の調整。1000px 未満では上下に積むレイアウトになるため CSS で隠す。
       ダブルクリックで既定値に戻す。 -->
  <button
    class="resizer"
    type="button"
    aria-label="公式サイト枠の幅を変更"
    onpointerdown={startResize}
    onpointermove={moveResize}
    onpointerup={endResize}
    onpointercancel={endResize}
    ondblclick={resetPanel}
    onkeydown={(e) => {
      if (e.key === 'ArrowLeft') panelW = clampPanel(panelW + 24);
      else if (e.key === 'ArrowRight') panelW = clampPanel(panelW - 24);
      else return;
      e.preventDefault();
    }}
  ></button>

  <aside class="panel">
    {#if officialSite.embedUrl}
      <iframe
        src={officialSite.embedUrl}
        title="高専祭公式サイト"
        loading="lazy"
        referrerpolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      ></iframe>
    {/if}
    <a class="open-official" href={officialSite.homeUrl} target="_blank" rel="noopener">
      公式サイトを開く ↗
    </a>
  </aside>
</div>

<style>
  .page {
    display: grid;
    grid-template-rows: auto 1fr;
    height: 100dvh;
    /* 子がはみ出してページ全体がスクロールするのを止める */
    overflow: hidden;
    position: relative;
  }
  @media (min-width: 1000px) {
    .page {
      grid-template-rows: 1fr;
      grid-template-columns: minmax(0, 1fr) var(--panel-w);
    }
  }

  /* ---- 右カラムの幅を変えるつまみ ---- */
  .resizer {
    display: none;
  }
  @media (min-width: 1000px) {
    .resizer {
      display: block;
      position: absolute;
      top: 0;
      bottom: 0;
      /* 境界線の上に重ねる。当たり判定は線より広く取る。 */
      right: calc(var(--panel-w) - 3px);
      width: 7px;
      z-index: 2;
      appearance: none;
      border: 0;
      padding: 0;
      background: none;
      cursor: col-resize;
    }
    .resizer:hover,
    .resizer:focus-visible {
      background: var(--accent);
    }
    .resizer:focus-visible {
      outline: none;
    }
  }
  /* ドラッグ中はポインタが iframe へ入っても選択やホバーが起きないようにする */
  .page.dragging {
    user-select: none;
  }
  .page.dragging .panel iframe {
    pointer-events: none;
  }

  /* ---- 映像（枠は app.css の .stage） ---- */
  :global(media-controller) {
    width: 100%;
    height: 100%;
    --media-primary-color: #fff;
    --media-secondary-color: rgb(255 255 255 / 0.2);
    --media-control-background: transparent;
    --media-control-hover-background: rgb(255 255 255 / 0.15);
    --media-font-family: var(--font);
    --media-live-button-indicator-color: var(--live);
  }
  :global(media-control-bar) {
    background: linear-gradient(to top, rgb(0 0 0 / 0.75), transparent);
    padding: var(--sp-2) var(--sp-2) var(--sp-1);
  }
  /* media-chrome は先端と判定している間 --media-cursor を not-allowed にする。
     こちらで押せるようにしてあるので、押せる見た目に戻す。 */
  :global(media-live-button) {
    --media-cursor: pointer;
  }
  @media (max-width: 999px) {
    /* 縦画面では映像を 16:9 に留め、残りをパネルに渡す */
    .stage {
      aspect-ratio: 16 / 9;
    }
  }

  /* ---- 映像に重なる上端のバー ---- */
  /* 位置と暗がりは .scrim。ここは出入りの制御と余白だけ。 */
  .topbar {
    padding: calc(var(--sp-3) + var(--safe-t)) var(--sp-4) var(--sp-6);
    opacity: 0;
    transition: opacity 200ms ease;
    pointer-events: none;
  }
  .topbar.visible {
    opacity: 1;
    pointer-events: auto;
  }
  .topbar-inner {
    display: flex;
    /* center だとタブの下線を含んだ箱がロゴに揃い、文字がずれる */
    align-items: baseline;
    gap: var(--sp-3) var(--sp-5);
    flex-wrap: wrap;
  }

  nav {
    display: flex;
    gap: var(--sp-4);
    overflow-x: auto;
    scrollbar-width: none;
  }
  nav::-webkit-scrollbar {
    display: none;
  }
  nav button {
    flex: 0 0 auto;
    appearance: none;
    background: none;
    border: 0;
    /* 下線は文字の下にぶら下げる。box の高さでロゴと揃えない。 */
    border-bottom: 2px solid transparent;
    padding: 0 0 var(--sp-2);
    color: rgb(255 255 255 / 0.65);
    font: inherit;
    font-size: var(--fs-sm);
    font-weight: 600;
    cursor: pointer;
  }
  nav button[aria-current='true'] {
    color: #fff;
    border-bottom-color: var(--accent);
  }
  nav button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }

  .retry {
    pointer-events: auto;
    appearance: none;
    border: 1px solid rgb(255 255 255 / 0.35);
    border-radius: var(--radius);
    padding: var(--sp-2) var(--sp-4);
    background: none;
    color: #fff;
    font: inherit;
    font-size: var(--fs-sm);
    font-weight: 600;
    cursor: pointer;
  }
  .retry:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  /* ---- 右カラム ---- */
  .panel {
    position: relative;
    min-height: 0;
    background: var(--surface);
    border-top: 1px solid var(--line);
  }
  @media (min-width: 1000px) {
    .panel {
      border-top: 0;
      border-left: 1px solid var(--line);
    }
  }
  .panel iframe {
    width: 100%;
    height: 100%;
    border: 0;
    background: #fff;
  }

  .open-official {
    position: absolute;
    right: var(--sp-3);
    bottom: calc(var(--sp-3) + var(--safe-b));
    padding: var(--sp-2) var(--sp-3);
    border-radius: var(--radius-round);
    background: rgb(0 0 0 / 0.72);
    color: #fff;
    font-size: var(--fs-xs);
    font-weight: 600;
    text-decoration: none;
    backdrop-filter: blur(6px);
  }
  .open-official:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>
