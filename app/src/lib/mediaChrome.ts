/** 使用するカスタム要素を定義する。定義には DOM が要るため prerender 時には呼べない。 */
export function loadMediaChrome(): void {
  Promise.all([
    import('media-chrome/dist/media-controller.js'),
    import('media-chrome/dist/media-control-bar.js'),
    import('media-chrome/dist/media-play-button.js'),
    import('media-chrome/dist/media-mute-button.js'),
    import('media-chrome/dist/media-volume-range.js'),
    import('media-chrome/dist/media-time-range.js'),
    import('media-chrome/dist/media-live-button.js'),
    import('media-chrome/dist/media-pip-button.js'),
    import('media-chrome/dist/media-fullscreen-button.js'),
  ]).catch(() => {
    /* コントロールが出ないだけで再生は続く */
  });
}

/**
 * LIVE ボタンが先端の判定中もクリックを受け付けるようにする。戻り値は後片付けに使う。
 *
 * media-chrome は再生中かつ先端と判定している間、クリックを無視し aria-disabled を
 * 付与する。先端の判定には liveedgeoffset の幅があるため、その範囲内で数秒遅れて
 * いても操作できない状態になる。無視される条件のときだけ、こちらから要求を送出する。
 */
export function keepLiveButtonEnabled(btn: HTMLElement | null): () => void {
  if (!btn) return () => {};

  const onClick = () => {
    if (btn.hasAttribute('mediapaused') || !btn.hasAttribute('mediatimeislive')) return;
    btn.dispatchEvent(new CustomEvent('mediaseektoliverequest', { composed: true, bubbles: true }));
  };
  btn.addEventListener('click', onClick);

  // 支援技術へ誤った状態を伝えないよう、付与された aria-disabled を取り除く。
  const observer = new MutationObserver(() => {
    if (btn.getAttribute('aria-disabled') === 'true') btn.removeAttribute('aria-disabled');
  });
  observer.observe(btn, { attributes: true, attributeFilter: ['aria-disabled'] });

  return () => {
    btn.removeEventListener('click', onClick);
    observer.disconnect();
  };
}
