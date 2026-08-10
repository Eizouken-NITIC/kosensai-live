<script lang="ts">
  import { onMount } from 'svelte';
  import Logo from './Logo.svelte';
  import { welcome } from '$lib/config';

  const STORE_KEY = 'welcomeSeen';

  let el = $state<HTMLDialogElement | null>(null);

  function seen(): boolean {
    try {
      return localStorage.getItem(STORE_KEY) === '1';
    } catch {
      // 読めない環境では初めての来場者へ確実に届くほうを選び、毎回開く
      return false;
    }
  }

  onMount(() => {
    if (seen()) return;
    // top layer へ上げるため showModal を使う。開いている間は背後の操作を受け付けない。
    el?.showModal();
  });

  // Esc で閉じた場合もここを通る
  function onClose() {
    try {
      localStorage.setItem(STORE_KEY, '1');
    } catch {
      /* ローカルストレージ無効時 */
    }
  }
</script>

<dialog class="welcome" bind:this={el} onclose={onClose} aria-labelledby="welcome-title">
  <Logo />

  <h1 id="welcome-title">はじめてご覧になる方へ</h1>

  <dl>
    <dt>会場の切り替え</dt>
    <dd>画面の上部にタブが並んでいます。タブを選ぶと、その会場の映像へ切り替わります。</dd>

    <dt>音声</dt>
    <dd>
      音声は消音の状態で始まります。映像の下にあるスピーカーのボタンを押して、消音を解除してください。隣のつまみで音量を調整できます。
    </dd>

    <dt>視聴の条件</dt>
    <dd>{welcome.note}</dd>
  </dl>

  <button type="button" onclick={() => el?.close()}>視聴をはじめる</button>
</dialog>
