import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/compiler/index.ts',
    'monaco/index': 'src/monaco/language-service.ts'
  },
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['monaco-editor'],
});