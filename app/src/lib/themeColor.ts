/** ブラウザの UI に出る色を、再生の状態に合わせて差し替える。
 *
 * 色は CSS のトークンを参照する。 */
export function setThemeColor(token: string): void {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  if (value) meta.setAttribute('content', value);
}
