<script>
  // 外部の CDN へ到達できるとは限らない。同梱したものを配信する。
  import '@fontsource-variable/noto-sans-jp';
  import '../app.css';
  let { children } = $props();
</script>

{@render children()}
