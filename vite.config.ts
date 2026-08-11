import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    target: 'es2022',
  },
  server: {
    host: true,
    port: 5173,
  },
});
