import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
export default defineConfig({
  plugins: [vue()],
  server: { proxy: { '/api': 'http://127.0.0.1:8080' } },
  test: { environment: 'node', coverage: { provider: 'v8', include: ['src/core/**/*.ts'], exclude: ['src/core/**/Token.ts', 'src/core/**/LexicalError.ts', 'src/core/**/Comment.ts', 'src/core/**/LexerEvent.ts', 'src/core/**/LexerState.ts'], reporter: ['text', 'html'] } },
})
