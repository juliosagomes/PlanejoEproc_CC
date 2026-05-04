import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // O produto final precisa abrir por file:// — base relativa garante que assets
  // sejam carregados sem depender de caminho absoluto do servidor.
  base: './',
});
