<script lang="ts">
  import { onMount } from 'svelte';
  import { createPlayer } from '$lib/player.svelte.js';
  import Wordmark from '$lib/components/Wordmark.svelte';
  import type { Channel, OfficialSite, SiteConfig } from '$lib/types';

  const DEFAULT_CH = 'ch1';
  const STORE_KEY = 'kosensai.ch';
  const OVERLAY_HIDE_MS = 3000;

  const player = createPlayer();

  let channels = $state<Channel[]>([]);
  let official = $state<OfficialSite>({ homeUrl: '', embedUrl: '' });
  let current = $state(DEFAULT_CH);
  let overlayVisible = $state(true);
  /** @type {HTMLVideoElement | null} */
  let videoEl = $state<HTMLVideoElement | null>(null);
  /** @type {HTMLElement | null} */

  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  // 再生していない間はバーを出しっぱなしにする。
  // 何も映っていない画面で UI まで消えると、ただの黒い板になるため。
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
    /* media-chrome はカスタム要素を定義するので、prerender 時（DOM が無い）には
       読み込めない。必要な要素だけ個別に読む（barrel import より軽い）。 */
    Promise.all([
      import('media-chrome/dist/media-controller.js'),
      import('media-chrome/dist/media-control-bar.js'),
      import('media-chrome/dist/media-play-button.js'),
      import('media-chrome/dist/media-mute-button.js'),
      import('media-chrome/dist/media-volume-range.js'),
      import('media-chrome/dist/media-live-button.js'),
      import('media-chrome/dist/media-fullscreen-button.js')
    ]).catch(() => {
      /* 読めなくても再生自体は続く。コントロールが出ないだけ。 */
    });

    if (!videoEl) return;
    const detach = player.attach(videoEl);

    (async () => {
      let cfg: Partial<SiteConfig> = {};
      try {
        const r = await fetch('/config.json', { cache: 'no-cache' });
        if (r.ok) cfg = await r.json();
      } catch {
        /* 設定が読めなくても再生自体は試みる */
      }
      channels = cfg.channels ?? [];
      official = cfg.officialSite ?? { homeUrl: '', embedUrl: '' };

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
      detach();
    };
  });

  // 再生が止まったらバーを出し直す
  $effect(() => {
    if (pinned) {
      clearTimeout(hideTimer);
      overlayVisible = true;
    }
  });
</script>

<svelte:head><title>KOSENSAI-LIVE</title></svelte:head>

<!-- 映像の <section> にハンドラを付けると a11y_no_static_element_interactions
     が出るため、バーの復帰は body 側で受ける。 -->
<svelte:body onmousemove={showOverlay} onpointerdown={showOverlay} onfocusin={showOverlay} />

<div class="page">
  <!-- 映像とその上に重なる上端のバー。ヘッダー用の帯を別に持たないので、
       映像がビューポートの縦を使い切れる（下に空白が残らない）。 -->
  <section class="stage">
    <!-- ネイティブコントロールにはライブ点へ戻る導線が無く、シークバーの
         末端まで手で戻すしかない。mediastreamtype="live" を明示すると
         LIVE ボタンが出て、押すとライブ点へシークする。MediaMTX の HLS は
         DVR 判定用の非標準タグを出さないので、自動判定に任せず指定する。 -->
    <media-controller mediastreamtype="live">
      <!-- svelte-ignore a11y_media_has_caption -->
      <video slot="media" bind:this={videoEl} playsinline muted autoplay preload="none"></video>

      <media-control-bar>
        <media-play-button></media-play-button>
        <media-mute-button></media-mute-button>
        <media-volume-range></media-volume-range>
        <span class="spacer"></span>
        <media-live-button></media-live-button>
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

    <!-- 伝えることがあるときだけ出す。接続中は出さない
         （読み込み表示はブラウザ内蔵プレイヤーに任せる）。 -->
    {#if player.state === 'waiting'}
      <div class="cover" role="status" aria-live="polite">
        <p>このチャンネルはまだ配信されていません</p>
        <small>始まると自動で再生されます</small>
        <!-- 自動リトライは続いているが、待てない人のために手動の出口も出す。 -->
        <button class="retry" type="button" onclick={() => player.load(current)}>
          今すぐ再読み込み
        </button>
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
  :global(media-controller) {
    width: 100%;
    height: 100%;
    /* 既定の色をテーマに合わせる。個別に上書きせず変数で渡す。 */
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
  :global(.spacer) {
    flex: 1 1 auto;
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
