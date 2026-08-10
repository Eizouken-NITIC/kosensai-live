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
    class="embed"
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
  <a class="embed-link" href={externalSite.homeUrl} target="_blank" rel="noopener">
    公式サイトを開く ↗
  </a>
{/if}
