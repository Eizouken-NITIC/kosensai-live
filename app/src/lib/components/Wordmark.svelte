<script>
  /* ワードマーク。LIVE の部分そのものが配信状態のインジケータになる。
     独立した「LIVEバッジ」を置かずに済むので、画面上の部品が 1 つ減る。
     配信 UI の慣習に合わせて点滅はさせない。色と輝度の差だけで示す。 */
  let { live = false, size = 'md' } = $props();
</script>

<span class="mark" class:live data-size={size}>
  <span class="kosensai">KOSENSAI</span><span class="sep">-</span><span class="live-part">LIVE</span>
</span>

<style>
  .mark {
    display: inline-flex;
    align-items: baseline;
    font-family: var(--font-mark);
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

  /* 待機中は消灯。配信中だけ点灯する。 */
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
