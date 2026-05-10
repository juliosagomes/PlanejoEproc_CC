import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * Dois alvos de build:
 *
 *  - `vite build --mode singlefile` → `dist-singlefile/index.html`
 *      Tudo inline (JS, CSS, WOFF2 como base64). É a **distribuição principal**:
 *      o `npm run pack` empacota esse HTML único dentro da pasta companion
 *      `PlanejoEproc/` (com `planos/` e `LEIA-ME.txt`). Singlefile é o único
 *      formato que abre por duplo clique sem dor sob `file://` — Chromium
 *      bloqueia ES modules carregados por `file://`, então qualquer alvo que
 *      emita `<script type="module">` separado dá tela branca.
 *
 *  - `vite build` → `dist/`
 *      Build padrão (HTML + assets em pasta, com módulos). Útil para preview
 *      via servidor (`npm run preview`) e introspecção, **não** para
 *      distribuição por duplo clique.
 *
 * Ambos rodam 100% offline; `base: './'` garante caminhos relativos.
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
