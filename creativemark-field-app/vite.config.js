import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2018',
    minify: 'esbuild',
    cssMinify: true,
    chunkSizeWarningLimit: 400,
  },
  server: {
    port: 5174,
    open: true,
  },
});
