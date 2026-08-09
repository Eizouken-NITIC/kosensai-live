<script lang="ts">
  import { externalSite } from '$lib/config';

  /* allowPopups: 埋め込んだページ内のリンクを新しいタブで開けるようにする。
     開いたタブを閉じる人がいない無人の設置では false のままにする。 */
  let { allowPopups = false, withLink = false }: { allowPopups?: boolean; withLink?: boolean } =
    $props();

  let frameEl = $state<HTMLIFrameElement | null>(null);

  /** 埋め込んだページを読み込み直す。埋め込み先の更新を拾うために使う。 */
  export function reload() {
    if (frameEl) frameEl.src = frameEl.src;
  }
</script>

{#if externalSite.embedUrl}
  <iframe
    bind:this={frameEl}
    src={externalSite.embedUrl}
    title="高専祭公式サイト"
    referrerpolicy="no-referrer"
    sandbox={allowPopups
      ? 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox'
      : 'allow-scripts allow-same-origin'}
  ></iframe>
{/if}

{#if withLink && externalSite.homeUrl}
  <a class="open" href={externalSite.homeUrl} target="_blank" rel="noopener">
    公式サイトを開く ↗
  </a>
{/if}

<style>
  /* .panel は縦の flex なので、残りの高さをこれが取る */
  iframe {
    flex: 1 1 auto;
    min-height: 0;
    width: 100%;
    border: 0;
    background: #fff;
  }

  .open {
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
  .open:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>
