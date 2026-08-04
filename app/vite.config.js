import { sveltekit } from '@sveltejs/kit/vite';

export default {
  plugins: [sveltekit()],
  build: {
    sourcemap: false,
    target: 'es2020',
  },
};
