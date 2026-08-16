/** OS の再生通知（ロック画面・通知領域）に表示する情報を設定する。
 *
 * 設定しない場合、表題にはページの URL が表示される。 */
export function setNowPlaying(title: string, artist: string): void {
  if (!('mediaSession' in navigator)) return;

  navigator.mediaSession.metadata = new MediaMetadata({
    title,
    artist,
  });

  // ライブ配信であり、先頭からの経過時間と全体の長さに意味がない。
  // 設定しないと 00:00 / 00:00 のシークバーが表示される。
  navigator.mediaSession.setPositionState?.();

  // 同じ理由でシーク操作も受け付けない。
  for (const action of ['seekto', 'seekbackward', 'seekforward'] as const) {
    try {
      navigator.mediaSession.setActionHandler(action, null);
    } catch {
      /* この操作に対応していないブラウザでは例外が発生するため無視する */
    }
  }
}
