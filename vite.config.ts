import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: 'playground',
  base: '/ttrpg-script-lang/',
  build: {
    outDir: '../dist-playground',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      // Ensure Monaco worker resolution works
      'monaco-editor': path.resolve(__dirname, 'node_modules/monaco-editor'),
    },
  },
  optimizeDeps: {
    include: ['monaco-editor'],
  },
});