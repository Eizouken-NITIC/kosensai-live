<script lang="ts">
  /* LIVE 部分の色そのものが配信状態のインジケータ（別バッジは置かない）。
     配信 UI の慣習に合わせて点滅はさせない。 */
  let { live = false, size = 'md' }: { live?: boolean; size?: 'md' | 'lg' } = $props();
</script>

<!-- .mark は inline-flex なので、要素間の改行は描画されない（詰めて並ぶ）。 -->
<span class="mark" class:live data-size={size}>
  <span class="kosensai">KOSENSAI</span>
  <span class="sep">-</span>
  <span class="live-part">LIVE</span>
</span>

<style>
  .mark {
    display: inline-flex;
    align-items: baseline;
    font-weight: 800;
    letter-spacing: 0.06em;
    line-height: 1;
    white-space: nowrap;
    user-select: none;
  }
  .mark[data-size='md'] {
    font-size: var(--fs-md);
  }
  .mark[data-size='lg'] {
    font-size: 2.4vw;
    letter-spacing: 0.1em;
  }

  .kosensai {
    color: var(--fg);
  }

  .sep {
    color: var(--fg-muted);
    margin: 0 0.12em;
  }

  .live-part {
    color: var(--live-off);
    transition: color 220ms ease;
  }
  .mark.live .live-part {
    color: var(--live);
    /* 点滅ではなく、わずかな発光で「通電している」ことを示す */
    text-shadow: 0 0 12px color-mix(in srgb, var(--live) 55%, transparent);
  }
</style>
