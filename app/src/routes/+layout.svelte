<script>
  /* 日本語フォントを同梱する。学内 LAN 完結で CDN を使えないうえ、
     端末任せだと macOS はヒラギノ・Windows は游ゴシック・サイネージの
     Raspberry Pi に至っては日本語フォントが無いと豆腐になる。
     unicode-range で分割されているので、ブラウザは使う文字を含む
     チャンクだけを取りに行く。 */
  import '@fontsource-variable/noto-sans-jp';
  import '../app.css';
  let { children } = $props();
</script>

{@render children()}
