import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * Dois alvos de build:
 *
 *  - `vite build`               → `dist/`            (HTML + assets/, comportamento padrão).
 *  - `vite build --mode singlefile` → `dist-singlefile/index.html`
 *      (tudo embutido — JS, CSS e WOFF2 como base64 — para distribuição como
 *      arquivo único standalone).
 *
 * Ambos rodam 100% offline; `base: './'` garante que o `dist/` abra por
 * `file://` sem precisar de servidor.
 */
export default defineConfig(({ mode }) => {
  const singlefile = mode === 'singlefile';
  return {
    plugins: [react(), ...(singlefile ? [viteSingleFile()] : [])],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    base: './',
    build: {
      outDir: singlefile ? 'dist-singlefile' : 'dist',
      // O bundle ultrapassa 500 KB porque inclui ReactFlow + 6 catálogos do
      // Eproc embutidos. Aceitável para um app SPA offline; o aviso só polui.
      chunkSizeWarningLimit: 1500,
    },
  };
});
