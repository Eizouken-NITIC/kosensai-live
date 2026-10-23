/** タブの favicon を、配信中かどうかに合わせて差し替える。 */
export function setFavicon(live: boolean): void {
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (link) link.href = live ? '/assets/favicon-live.svg' : '/assets/favicon-off.svg';
}
