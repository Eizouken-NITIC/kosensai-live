<script lang="ts">
  import { onMount } from 'svelte';
  import { createPlayer } from '$lib/player.svelte.js';
  import Logo from '$lib/components/Logo.svelte';
  import EmbeddedSite from '$lib/components/EmbeddedSite.svelte';
  import { setNowPlaying } from '$lib/mediaSession';
  import { channels } from '$lib/config';

  const IFRAME_RELOAD_MS = 5 * 60 * 1000; // 埋め込み先の更新を拾う
  const PAGE_RELOAD_MS = 6 * 60 * 60 * 1000; // 長時間運転のリーク対策（無人運用の保険）

  const player = createPlayer();

  let clock = $state('--:--');
  let videoEl = $state<HTMLVideoElement | null>(null);
  let site = $state<ReturnType<typeof EmbeddedSite> | null>(null);

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
    setNowPlaying(channels.find((c) => c.id === ch)?.label ?? ch);

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

<div class="signage screen">
  <header class="bar">
    <Logo live={player.isLive} />
    <time class="clock">{clock}</time>
  </header>

  <section class="stage">
    <!-- muted を付けない。音声を出して設置するため。ユーザー操作の無い環境で
         音ありの自動再生を通すには、Chromium を
         --autoplay-policy=no-user-gesture-required で起動する必要がある。
         signage.service に指定してある。 -->
    <!-- svelte-ignore a11y_media_has_caption -->
    <video bind:this={videoEl} playsinline autoplay preload="none"></video>

    <!-- 配信を行わない時間帯は OBS がテロップを送るため、その旨は映像に映る。
         ここでは配信の状態を断定しない。 -->
    {#if !player.isLive}
      <div class="cover">
        <p>読み込み中…</p>
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

  <aside class="panel">
    <EmbeddedSite bind:this={site} />
  </aside>
</div>
