<script lang="ts">
  import { onMount } from 'svelte';
  import { createPlayer } from '$lib/player.svelte.js';
  import Logo from '$lib/components/Logo.svelte';
  import EmbeddedSite from '$lib/components/EmbeddedSite.svelte';
  import { setNowPlaying } from '$lib/mediaSession';
  import { channels, signage, site } from '$lib/config';

  const IFRAME_RELOAD_MS = 5 * 60 * 1000; // 埋め込み先iframeの自動リロード間隔
  const PAGE_RELOAD_MS = 6 * 60 * 60 * 1000; // 長時間運転時のリーク対策（ページリロード間隔）

  const player = createPlayer();

  const coverText = $derived(
    player.state === 'idle'
      ? 'このチャンネルは配信されていません'
      : player.state === 'waiting'
        ? '接続中です'
        : '読み込み中…',
  );

  let clock = $state('--:--');
  let videoEl = $state<HTMLVideoElement | null>(null);
  let embed = $state<ReturnType<typeof EmbeddedSite> | null>(null);

  function tick() {
    const d = new Date();
    clock = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  onMount(() => {
    player.prefetch();

    if (!videoEl) return;
    const detach = player.attach(videoEl);
    const ch = new URLSearchParams(location.search).get('ch') ?? signage.defaultChannel;
    player.load(ch);
    setNowPlaying(channels.find((c) => c.id === ch)?.label ?? ch, site.name);

    tick();
    const timers = [
      setInterval(tick, 5000),
      setInterval(() => embed?.reload(), IFRAME_RELOAD_MS),
      // ライブ再生中でない場合はページをリロード（メモリ解放）
      setInterval(() => {
        if (videoEl?.paused || (videoEl?.readyState ?? 0) < 3) location.reload();
      }, PAGE_RELOAD_MS),
    ];

    return () => {
      timers.forEach(clearInterval);
      detach();
    };
  });

  // 自動再生ブロック時は自動で再開を試行
  $effect(() => {
    if (player.state === 'blocked') player.resume();
  });
</script>

<svelte:head><title>{site.name} サイネージ</title></svelte:head>

<div class="signage screen">
  <header class="bar">
    <Logo live={player.isLive} />
    <time class="clock">{clock}</time>
  </header>

  <section class="stage">
    <!-- 音声付き自動再生のためmutedは付与せず、ブラウザ起動引数による制御に依存 -->
    <!-- svelte-ignore a11y_media_has_caption -->
    <video bind:this={videoEl} playsinline autoplay preload="none"></video>

    {#if !player.isLive}
      <div class="cover">
        <p>{coverText}</p>
      </div>
    {/if}
  </section>

  <div class="invite">
    <span class="qr">
      <img src="/assets/qr-viewer.svg" alt="視聴ページの QR コード" />
    </span>
    <div class="invite-text">
      <strong>{signage.inviteHeading}</strong>
      <span>{signage.inviteNote} &nbsp;/&nbsp; <code>{site.domain}</code></span>
    </div>
  </div>

  <aside class="panel">
    <EmbeddedSite bind:this={embed} />
  </aside>
</div>
