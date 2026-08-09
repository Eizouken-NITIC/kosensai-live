<script lang="ts">
  import { onMount } from 'svelte';
  import { createPlayer } from '$lib/player.svelte.js';
  import Wordmark from '$lib/components/Wordmark.svelte';
  import OfficialSite from '$lib/components/OfficialSite.svelte';

  const IFRAME_RELOAD_MS = 5 * 60 * 1000; // 公式サイト側の更新を拾う
  const PAGE_RELOAD_MS = 6 * 60 * 60 * 1000; // 長時間運転のリーク対策（無人運用の保険）

  const player = createPlayer();

  let clock = $state('--:--');
  let videoEl = $state<HTMLVideoElement | null>(null);
  let site = $state<ReturnType<typeof OfficialSite> | null>(null);

  function tick() {
    const d = new Date();
    clock = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  onMount(() => {
    player.prefetch();

    if (!videoEl) return;
    const detach = player.attach(videoEl);
    const ch = new URLSearchParams(location.search).get('ch') ?? 'ch4';
    player.load(ch);

    tick();
    const timers = [
      setInterval(tick, 5000),
      setInterval(() => site?.reload(), IFRAME_RELOAD_MS),
      // 再生中はリロードしない
      setInterval(() => {
        if (videoEl?.paused || (videoEl?.readyState ?? 0) < 3) location.reload();
      }, PAGE_RELOAD_MS),
    ];

    return () => {
      timers.forEach(clearInterval);
      detach();
    };
  });

  // 無人で運用するため、自動再生がブロックされても操作する人がいない。
  // Kiosk は --autoplay-policy=no-user-gesture-required で起動すること。
  $effect(() => {
    if (player.state === 'blocked') player.resume();
  });
</script>

<svelte:head><title>KOSENSAI-LIVE サイネージ</title></svelte:head>

<div class="signage">
  <header>
    <Wordmark live={player.isLive} />
    <time class="clock">{clock}</time>
  </header>

  <section class="stage">
    <!-- svelte-ignore a11y_media_has_caption -->
    <video bind:this={videoEl} playsinline muted autoplay preload="none"></video>

    {#if !player.isLive}
      <div class="cover idle">
        <p>現在配信していません</p>
      </div>
    {/if}
  </section>

  <div class="invite">
    <!-- QR は白地に黒で置く。読み取り機は「暗いモジュール／明るい下地」を
         前提にしているので、反転させると読み取り率が落ちる。
         なお <img> で読み込んだ SVG は独立した文書として扱われるため、
         SVG 内の currentColor は親の色を継承しない（黒のまま出る）。 -->
    <span class="qr">
      <img src="/assets/qr-viewer.svg" alt="視聴ページの QR コード" />
    </span>
    <div class="invite-text">
      <strong>スマホでも視聴できます</strong>
      <span>学内Wi-Fi限定 &nbsp;/&nbsp; <code>live.kosensai.ichinoseki.ac.jp</code></span>
    </div>
  </div>

  <aside class="side">
    <OfficialSite bind:this={site} />
  </aside>
</div>

<style>
  .signage {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 460px;
    grid-template-rows: auto minmax(0, 1fr) auto;
    grid-template-areas:
      'header side'
      'stage  side'
      'invite side';
    height: 100dvh;
    overflow: hidden;
    cursor: none;
    user-select: none;
  }

  header {
    grid-area: header;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--sp-5);
    /* 視聴ページのヘッダーと同じくらいの高さに揃える */
    padding: var(--sp-3) var(--sp-5);
  }
  .clock {
    font-size: var(--fs-lg);
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  .stage {
    grid-area: stage;
  }
  /* 配信していない間は映像が無いので、透過ではなく完全に黒で塗る。 */
  .idle {
    background: #000;
  }
  .idle p {
    font-size: 1.4vw;
    color: var(--fg-muted);
  }

  .invite {
    grid-area: invite;
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 16px 24px calc(16px + var(--safe-b));
  }
  .qr {
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    padding: 8px;
    background: #fff;
    border-radius: var(--radius);
  }
  .qr img {
    width: 96px;
    height: 96px;
    display: block;
    /* 拡大時にモジュールの縁がぼけると読み取り率が落ちる */
    image-rendering: pixelated;
  }
  .invite-text {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }
  .invite-text strong {
    font-size: 22px;
  }
  .invite-text span {
    font-size: 15px;
    color: var(--fg-muted);
  }
  .invite-text code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  .side {
    grid-area: side;
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border-left: 1px solid var(--line);
    min-width: 0;
  }
</style>
