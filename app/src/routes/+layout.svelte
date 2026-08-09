<script>
  // 学内 LAN で完結するため CDN へ到達できない。同梱したものを配信する。
  import '@fontsource-variable/noto-sans-jp';
  import '../app.css';
  let { children } = $props();
</script>

{@render children()}
