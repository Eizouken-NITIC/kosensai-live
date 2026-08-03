import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
export default {
  kit: {
    // ビルド成果物はリポジトリ直下の web/ に出す。
    // hosts/server の Caddy と rehearsal はそこをマウントしているので、
    // 配信側の構成を一切変えずに差し替わる。
    adapter: adapter({
      pages: '../web',
      assets: '../web',
      fallback: undefined,
      precompress: false,
      strict: true
    }),
    // 学内限定・オフライン前提なので、実行時に外部を取りに行かせない
    prerender: { handleHttpError: 'fail' }
  }
};
