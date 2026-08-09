<script lang="ts">
  import { onMount } from 'svelte';
  import { createPlayer } from '$lib/player.svelte.js';
  import { loadMediaChrome, keepLiveButtonEnabled } from '$lib/mediaChrome';
  import Wordmark from '$lib/components/Wordmark.svelte';
  import OfficialSite from '$lib/components/OfficialSite.svelte';
  import { channels } from '$lib/config';

  const DEFAULT_CH = 'ch1';
  const STORE_KEY = 'kosensai.ch';
  const OVERLAY_HIDE_MS = 2000;

  const player = createPlayer();

  let current = $state(DEFAULT_CH);
  let overlayVisible = $state(true);
  let videoEl = $state<HTMLVideoElement | null>(null);
  let liveBtn = $state<HTMLElement | null>(null);

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
    loadMediaChrome();

    if (!videoEl) return;
    const detach = player.attach(videoEl);
    const releaseLiveBtn = keepLiveButtonEnabled(liveBtn);

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
      releaseLiveBtn();
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

<div class="page">
  <!-- 幅 1000px 以上では映像と同じグリッドのセルに置いて重ね、それ未満では
       映像の上の行に積む。縦画面では映像が 16:9 に収まるため、重ねると
       映像の大部分が隠れる。タッチにはホバーが無く、消すこともできない。 -->
  <div class="topbar" class:visible={overlayVisible || pinned}>
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

  <aside class="panel">
    <OfficialSite allowPopups withLink />
  </aside>
</div>

<style>
  .page {
    display: grid;
    /* バー・映像・パネルを縦に積む */
    grid-template-rows: auto auto 1fr;
    height: 100dvh;
    /* 子がはみ出してページ全体がスクロールするのを止める */
    overflow: hidden;
  }
  @media (min-width: 1000px) {
    .page {
      grid-template-rows: 1fr;
      /* 幅は .panel の resize が決める */
      grid-template-columns: minmax(0, 1fr) auto;
    }
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
  .stage {
    grid-row: 2;
  }
  @media (max-width: 999px) {
    /* 縦画面では映像を 16:9 に留め、残りをパネルに渡す */
    .stage {
      aspect-ratio: 16 / 9;
    }
  }
  @media (min-width: 1000px) {
    .stage {
      grid-area: 1 / 1;
    }
  }

  /* ---- 上端のバー ---- */
  /* 下の余白を置かず、タブのインジケータをバーの下端に接する位置で終わらせる。
     ベースライン揃えのため、インジケータの分だけ下へ伸びた高さの中心に
     ロゴの中心が一致する。 */
  .topbar {
    grid-row: 1;
    padding: calc(var(--sp-3) + var(--safe-t)) var(--sp-4) 0;
    background: var(--surface);
    border-bottom: 1px solid var(--line);
  }
  .topbar-inner {
    display: flex;
    /* center だとタブの下線を含んだ箱がロゴに揃い、文字がずれる */
    align-items: baseline;
    gap: var(--sp-3) var(--sp-5);
    flex-wrap: wrap;
  }

  /* 幅 1000px 以上では映像と同じセルに置いて重ねる。暗がりを敷いて文字を読ませ、
     操作が無ければ消す。ロゴとタブが 2 行に折り返しても読めるよう、暗い部分を
     下まで保つ。 */
  @media (min-width: 1000px) {
    .topbar {
      grid-area: 1 / 1;
      align-self: start;
      z-index: 1;
      padding-bottom: var(--sp-6);
      border-bottom: 0;
      background: linear-gradient(
        to bottom,
        rgb(0 0 0 / 0.85) 0%,
        rgb(0 0 0 / 0.7) 45%,
        rgb(0 0 0 / 0.35) 75%,
        transparent 100%
      );
      opacity: 0;
      transition: opacity 200ms ease;
      pointer-events: none;
    }
    .topbar.visible {
      opacity: 1;
      pointer-events: auto;
    }
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
    grid-row: 3;
    position: relative;
    min-height: 0;
    background: var(--surface);
    border-top: 1px solid var(--line);
  }
  /* 幅をブラウザ標準のリサイズで変える。つまみは要素の下端の、
     direction が始まる側の隅に出る。rtl にすることで映像との継ぎ目側へ移り、
     左へ引くと広がる向きになる。中身の文字組みは ltr に戻す。 */
  @media (min-width: 1000px) {
    .panel {
      grid-area: 1 / 2;
      border-top: 0;
      border-left: 1px solid var(--line);
      resize: horizontal;
      overflow: hidden;
      direction: rtl;
      width: 360px;
      min-width: 280px;
      max-width: 60vw;
    }
    /* 子は別コンポーネントなので、スコープを跨いで打ち消す */
    .panel > :global(*) {
      direction: ltr;
    }
  }
</style>
