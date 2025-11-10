import { defineConfig } from 'vite';

export default defineConfig({
  root: 'playground',
  base: '/verse/',
  build: {
    outDir: '../dist-playground',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          monaco: ['monaco-editor']
        }
      }
    }
  },
  optimizeDeps: {
    include: ['monaco-editor']
  },
  server: {
    port: 3000,
  },
});