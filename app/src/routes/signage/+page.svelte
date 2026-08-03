<script>
  import { onMount } from 'svelte';
  import { createPlayer } from '$lib/player.svelte.js';
  import Wordmark from '$lib/components/Wordmark.svelte';

  const IFRAME_RELOAD_MS = 5 * 60 * 1000; // 公式サイト側の更新を拾う
  const PAGE_RELOAD_MS = 6 * 60 * 60 * 1000; // 長時間運転のリーク対策（無人運用の保険）

  const player = createPlayer();

  let official = $state({ embedUrl: '' });
  let clock = $state('--:--');
  let videoEl = $state(null);
  let frameEl = $state(null);

  function tick() {
    const d = new Date();
    clock = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  onMount(() => {
    const detach = player.attach(videoEl);
    const ch = new URLSearchParams(location.search).get('ch') ?? 'ch4';
    player.load(ch);

    (async () => {
      try {
        const r = await fetch('/config.json', { cache: 'no-cache' });
        if (r.ok) official = (await r.json()).officialSite ?? {};
      } catch {
        /* 設定が読めなくても再生は試みる */
      }
    })();

    tick();
    const timers = [
      setInterval(tick, 15000),
      setInterval(() => {
        if (frameEl) frameEl.src = frameEl.src;
      }, IFRAME_RELOAD_MS),
      // 無人運用の保険。再生中はリロードしない。
      setInterval(() => {
        if (videoEl?.paused || (videoEl?.readyState ?? 0) < 3) location.reload();
      }, PAGE_RELOAD_MS)
    ];

    return () => {
      timers.forEach(clearInterval);
      detach();
    };
  });

  // 自動再生がブロックされたら黙って再試行する。無人運用なので誰も操作しない。
  // Kiosk は --autoplay-policy=no-user-gesture-required で起動すること。
  $effect(() => {
    if (player.state === 'blocked') player.resume();
  });
</script>

<svelte:head><title>KOSENSAI-LIVE サイネージ</title></svelte:head>

<div class="signage">
  <section class="stage">
    <!-- svelte-ignore a11y_media_has_caption -->
    <video bind:this={videoEl} playsinline muted autoplay preload="none"></video>

    <!-- 時計は映像に重ねる。OBS で焼き込むと HLS の遅延（20秒前後）が
         そのまま時刻のズレになるので、端末のローカル時刻で出す。
         逆に「現在の企画名」など映像と同期すべきものは OBS 側で焼き込む。 -->
    <div class="overlay">
      <Wordmark live={player.isLive} size="lg" />
      <time class="clock">{clock}</time>
    </div>

    {#if !player.isLive}
      <!-- スピナーは置かない。実際には数秒〜10 秒間隔で再試行しているだけで、
           回り続ける表示は「今まさに読み込んでいる」という誤った印象を与える。
           開始時刻も分からないので「まもなく」とは言わない。 -->
      <div class="idle">
        <p>現在配信していません</p>
      </div>
    {/if}
  </section>

  <aside class="side">
    {#if official.embedUrl}
      <iframe
        bind:this={frameEl}
        src={official.embedUrl}
        title="高専祭公式サイト"
        referrerpolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin"
      ></iframe>
    {/if}

    <!-- 通りすがりの人が自分の端末で見るための導線。配信中も常に出す。
         QR は静的な SVG。学内限定配信なので実行時生成には依存させない。 -->
    <div class="invite">
      <img src="/assets/qr-viewer.svg" alt="視聴ページの QR コード" />
      <div>
        <strong>スマホでも視聴できます</strong>
        <span>学内Wi-Fi限定</span>
        <code>live.kosensai.ichinoseki.ac.jp</code>
      </div>
    </div>
  </aside>
</div>

<style>
  .signage {
    display: grid;
    grid-template-columns: 1fr var(--side, 26vw);
    height: 100dvh;
    overflow: hidden;
    cursor: none;
    user-select: none;
  }

  .stage {
    position: relative;
    background: #000;
    display: grid;
    place-items: center;
    min-width: 0;
  }
  .stage video {
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: #000;
  }

  /* 映像の上端に重ねる。面は作らず、グラデーションだけで文字を読ませる。 */
  .overlay {
    position: absolute;
    inset: 0 0 auto 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2vw;
    padding: 2vh 2vw 4vh;
    background: linear-gradient(to bottom, rgb(0 0 0 / 0.72), transparent);
    pointer-events: none;
  }
  .clock {
    font-size: 3vw;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
    line-height: 1;
  }

  .idle {
    position: absolute;
    inset: 0;
    display: grid;
    place-content: center;
    background: #000;
  }
  .idle p {
    margin: 0;
    font-size: 1.4vw;
    color: var(--fg-muted);
  }

  /* ---- 右カラム ---- */
  .side {
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border-left: 1px solid var(--line);
    min-width: 0;
  }
  .side iframe {
    flex: 1 1 auto;
    width: 100%;
    border: 0;
    background: #fff;
  }

  .invite {
    display: flex;
    align-items: center;
    gap: 1vw;
    padding: 1.6vh 1.2vw calc(1.6vh + var(--safe-b));
    border-top: 1px solid var(--line);
  }
  .invite img {
    flex: 0 0 auto;
    width: 6.5vw;
    height: 6.5vw;
    /* SVG を currentColor にしてあるので、この色がモジュール色になる */
    color: var(--fg);
    /* 拡大時にモジュールの縁がぼけると読み取り率が落ちる */
    image-rendering: pixelated;
  }
  .invite div {
    display: flex;
    flex-direction: column;
    gap: 0.4vh;
    min-width: 0;
  }
  .invite strong {
    font-size: 1vw;
  }
  .invite span {
    font-size: 0.8vw;
    color: var(--fg-muted);
  }
  .invite code {
    font-size: 0.72vw;
    color: var(--fg-muted);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    word-break: break-all;
  }
</style>
