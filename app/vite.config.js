import { sveltekit } from '@sveltejs/kit/vite';

export default {
  plugins: [sveltekit()],
  server: {
    // src/lib/config.ts がリポジトリ直下の config.json を読む。
    // Vite の開発サーバーは既定でプロジェクト外のファイルを配信しない。
    fs: { allow: ['..'] },
  },
  build: {
    sourcemap: false,
    target: 'es2020',
  },
};
