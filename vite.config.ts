import { defineConfig } from 'vite';
// @ts-ignore
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
  plugins: [svelte()],
  assetsInclude: ['**/*.tgs'],
  resolve: {
    alias: [
      { find: /^@teact$/, replacement: path.resolve(__dirname, './src/lib/teact/teact.ts') },
      { find: /^@teact\/(.*)/, replacement: path.resolve(__dirname, './src/lib/teact/$1') },
      { find: 'src', replacement: path.resolve(__dirname, './src') }
    ]
  },
  server: {
    port: 3000,
  },
  build: {
    outDir: 'dist-svelte',
  },
});
