<script lang="ts">
  /* LIVE 部分の色そのものが配信状態のインジケータで、別バッジは置かない。
     点滅と発光は検討して採らなかった。点滅は配信 UI の慣習に反する。
     text-shadow による発光は暗い無地の上でしか読めず、映像に重なる視聴ページと
     サイネージで見え方が変わる。 */
  let { live = false }: { live?: boolean } = $props();
</script>

<!-- .mark は inline-flex なので、要素間の改行は描画されない（詰めて並ぶ）。 -->
<span class="mark" class:live>
  <span class="kosensai">KOSENSAI</span>
  <span class="sep">-</span>
  <span class="live-part">LIVE</span>
</span>

<style>
  .mark {
    display: inline-flex;
    align-items: baseline;
    font-size: var(--fs-md);
    font-weight: 800;
    letter-spacing: 0.06em;
    line-height: 1;
    white-space: nowrap;
    user-select: none;
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
  }
</style>
