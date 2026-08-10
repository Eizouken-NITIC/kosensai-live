<script lang="ts">
  import { site } from '$lib/config';

  let { live = false }: { live?: boolean } = $props();
</script>

<!-- 参照している SVG はプロトタイプで、現在の文字組みをアウトライン化しただけのもの。
     本番の意匠は別途差し替える。
     点灯と消灯で別のファイルを持つのは、<img> で読んだ SVG が独立した文書として扱われ、
     親の CSS 変数を継承しないため。色は SVG 側が持つ。 -->
<span class="logo" class:live role="img" aria-label={site.name}>
  <img class="off" src="/assets/logo-off.svg" alt="" />
  <img class="on" src="/assets/logo-live.svg" alt="" />
</span>
