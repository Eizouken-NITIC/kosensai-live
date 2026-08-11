<script lang="ts">
  import { externalSite } from '$lib/config';

  let { allowPopups = false }: { allowPopups?: boolean } = $props();

  let frameEl = $state<HTMLIFrameElement | null>(null);

  /** 埋め込んだページを読み込み直す。埋め込み先の更新を取得するために使う。 */
  export function reload() {
    if (frameEl) frameEl.src = frameEl.src;
  }
</script>

{#if externalSite.embedUrl}
  <iframe
    class="embed"
    bind:this={frameEl}
    src={externalSite.embedUrl}
    title={externalSite.title}
    referrerpolicy="no-referrer"
    sandbox={allowPopups
      ? 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox'
      : 'allow-scripts allow-same-origin'}
  ></iframe>
{/if}
