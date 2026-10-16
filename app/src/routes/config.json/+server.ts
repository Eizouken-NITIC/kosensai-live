/* リポジトリ直下の config.json を web/config.json として書き出す。
 *
 * 視聴ページとサイネージはこれを実行時に読み直し、Ch の表示を差し替える。
 * 配信中に表示を変えるときは、配信サーバー上の web/config.json を直接書き換える。
 * 再ビルドするとリポジトリの内容で上書きされる。 */

import raw from '../../../../config.json';

export const prerender = true;

export function GET() {
  return new Response(JSON.stringify(raw, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
