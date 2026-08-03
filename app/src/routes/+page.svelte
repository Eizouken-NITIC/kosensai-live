<script>
  import { onMount } from 'svelte';
  import { createPlayer } from '$lib/player.svelte.js';
  import Wordmark from '$lib/components/Wordmark.svelte';

  const DEFAULT_CH = 'ch1';
  const STORE_KEY = 'kosensai.ch';
  const CHROME_HIDE_MS = 3000; // 操作が止まってから chrome を隠すまで

  const player = createPlayer();

  let channels = $state([]);
  let official = $state({ homeUrl: '', embedUrl: '' });
  let current = $state(DEFAULT_CH);
  let chromeVisible = $state(true);
  let videoEl = $state(null);
  let stageEl = $state(null);
  let muted = $state(true);
  let fullscreen = $state(false);

  let hideTimer = null;

  // 再生していない間は chrome を出しっぱなしにする。
  // 何も映っていない画面で UI まで消えると、ただの黒い板になるため。
  const pinned = $derived(!player.isLive);

  function showChrome() {
    chromeVisible = true;
    clearTimeout(hideTimer);
    if (!pinned) hideTimer = setTimeout(() => (chromeVisible = false), CHROME_HIDE_MS);
  }

  function toggleMute() {
    if (!videoEl) return;
    videoEl.muted = !videoEl.muted;
    muted = videoEl.muted;
    showChrome();
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stageEl?.requestFullscreen();
    } catch {
      /* 端末が対応していないだけ。黙って諦める */
    }
    showChrome();
  }

  function select(id, updateUrl = true) {
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
    showChrome();
  }

  onMount(() => {
    const detach = player.attach(videoEl);
    const onFs = () => (fullscreen = !!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);

    (async () => {
      let cfg = { channels: [], officialSite: {} };
      try {
        const r = await fetch('/config.json', { cache: 'no-cache' });
        if (r.ok) cfg = await r.json();
      } catch {
        /* 設定が読めなくても再生自体は試みる */
      }
      channels = cfg.channels ?? [];
      official = cfg.officialSite ?? {};

      const params = new URLSearchParams(location.search);
      let initial = params.get('ch');
      if (!initial) {
        try {
          initial = localStorage.getItem(STORE_KEY);
        } catch {
          /* noop */
        }
      }
      select(initial ?? DEFAULT_CH, false);
    })();

    return () => {
      clearTimeout(hideTimer);
      document.removeEventListener('fullscreenchange', onFs);
      detach();
    };
  });

  // 再生が止まったら chrome を出し直す
  $effect(() => {
    if (pinned) {
      clearTimeout(hideTimer);
      chromeVisible = true;
    }
  });
</script>

<svelte:head><title>KOSENSAI-LIVE</title></svelte:head>

<div class="page">
  <!-- 映像とその上に重なる chrome。ヘッダー用の帯を別に持たないので、
       映像がビューポートの縦を使い切れる（下に空白が残らない）。 -->
  <section
    bind:this={stageEl}
    class="stage"
    onmousemove={showChrome}
    onpointerdown={showChrome}
    onfocusin={showChrome}
  >
    <!-- svelte-ignore a11y_media_has_caption -->
    <!-- controls は付けない。ライブ配信なのでシークバーに意味がなく、
         むしろ末端がライブ点に追従しないぶん誤解を招く。
         必要な操作（音量・全画面）だけ自前で置く。 -->
    <video bind:this={videoEl} playsinline muted autoplay preload="none"></video>

    <div class="scrim chrome" class:visible={chromeVisible || pinned}>
      <div class="chrome-top">
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

        <div class="controls">
          <button type="button" onclick={toggleMute} aria-label={muted ? '音を出す' : '消音する'}>
            {muted ? '🔇' : '🔊'}
          </button>
          <button
            type="button"
            onclick={toggleFullscreen}
            aria-label={fullscreen ? '全画面をやめる' : '全画面にする'}
          >
            {fullscreen ? '⤡' : '⤢'}
          </button>
        </div>
      </div>
    </div>

    <!-- 伝えることがあるときだけ出す。接続中は出さない
         （読み込み表示はブラウザ内蔵プレイヤーに任せる）。 -->
    {#if player.state === 'waiting'}
      <div class="cover" role="status" aria-live="polite">
        <p>このチャンネルはまだ配信されていません</p>
        <small>始まると自動で再生されます</small>
      </div>
    {:else if player.state === 'blocked'}
      <div class="cover">
        <button class="resume" type="button" onclick={() => player.resume()}>▶ 再生する</button>
      </div>
    {:else if player.state === 'unsupported'}
      <div class="cover" role="status">
        <p>このブラウザでは再生できません</p>
        <small>Safari / Chrome の最新版でお試しください</small>
      </div>
    {/if}
  </section>

  <!-- 右カラム。今は公式サイト 1 枚だが、コメントを足すときは
       ここをタブで差し替える想定（レイアウトは変えずに済む）。 -->
  <aside class="panel">
    {#if official.embedUrl}
      <iframe
        src={official.embedUrl}
        title="高専祭公式サイト"
        loading="lazy"
        referrerpolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      ></iframe>
    {/if}
    <!-- 帯を 1 本使わずに済ませるため、導線は浮かせる -->
    <a class="open-official" href={official.homeUrl} target="_blank" rel="noopener">
      公式サイトを開く ↗
    </a>
  </aside>
</div>

<style>
  .page {
    display: grid;
    grid-template-rows: auto 1fr;
    height: 100dvh;
    /* グリッドの子（映像・iframe）がわずかにはみ出して
       ページ全体がスクロールできてしまうのを止める */
    overflow: hidden;
  }
  @media (min-width: 1000px) {
    .page {
      grid-template-rows: 1fr;
      grid-template-columns: minmax(0, 1fr) 360px;
    }
  }

  /* ---- 映像（枠は app.css の .stage） ---- */
  @media (max-width: 999px) {
    /* 縦画面では映像を 16:9 に留め、残りをパネルに渡す */
    .stage {
      aspect-ratio: 16 / 9;
    }
  }

  /* ---- 映像に重なる chrome ---- */
  /* 位置と暗がりは .scrim。ここは出入りの制御と余白だけ。 */
  .chrome {
    padding: calc(var(--sp-3) + var(--safe-t)) var(--sp-4) var(--sp-6);
    opacity: 0;
    transition: opacity 200ms ease;
    pointer-events: none;
  }
  .chrome.visible {
    opacity: 1;
    pointer-events: auto;
  }
  .chrome-top {
    display: flex;
    /* 文字どうしのベースラインで揃える。center にすると
       タブの下線を含んだ箱の中央がロゴに揃ってしまい、文字がずれる。 */
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
  nav button:focus-visible,
  .controls button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }

  /* ライブなので操作は音量と全画面だけ。再生位置の操作は置かない。 */
  .controls {
    margin-left: auto;
    display: flex;
    gap: var(--sp-2);
  }
  .controls button {
    appearance: none;
    background: none;
    border: 0;
    padding: var(--sp-1) var(--sp-2);
    font-size: var(--fs-md);
    line-height: 1;
    color: #fff;
    cursor: pointer;
  }

  .resume {
    pointer-events: auto;
    appearance: none;
    border: 0;
    border-radius: var(--radius);
    padding: var(--sp-3) var(--sp-5);
    background: #fff;
    color: #000;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
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

  /* 帯を作らずに浮かせる */
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
