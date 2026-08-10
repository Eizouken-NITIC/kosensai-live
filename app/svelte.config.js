import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
export default {
  kit: {
    // ビルド成果物はリポジトリ直下の web/ に出力する。
    // hosts/server の Caddy と rehearsal はそこをマウントしているので、
    // 配信側の構成を一切変えずに差し替わる。
    adapter: adapter({
      pages: '../web',
      assets: '../web',
      fallback: undefined,
      precompress: false,
      strict: true,
    }),
    // web/ は Caddy が静的にそのまま配信するため、実行時にリンク切れを解決する手段がない。
    // ビルドの時点で検出できるよう明示する。
    prerender: { handleHttpError: 'fail' },
  },
};
