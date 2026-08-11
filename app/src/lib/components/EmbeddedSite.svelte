<script lang="ts">
  import { externalSite } from '$lib/config';

  /* allowPopups: 埋め込んだページ内のリンクを新しいタブで開けるようにする。
     sandbox を緩めるため、操作の主体が来場者である視聴ページだけで渡す。
     サイネージは無人で表示するだけなので渡さない。 */
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
