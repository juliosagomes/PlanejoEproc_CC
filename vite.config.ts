import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * Dois alvos de build:
 *
 *  - `vite build`               → `dist/`            (HTML + assets/, padrão).
 *  - `vite build --mode singlefile` → `dist-singlefile/index.html`
 *      (tudo embutido — JS, CSS e WOFF2 como base64 — para distribuição como
 *      arquivo único standalone).
 *
 * Ambos rodam 100% offline; `base: './'` garante caminhos relativos.
 *
 * Particularidade do alvo padrão: o `index.html` é entregue como um SCRIPT
 * IIFE clássico (sem `type="module"` nem `crossorigin`). Motivo: navegadores
 * Chromium bloqueiam silenciosamente o carregamento de ES modules pelo
 * protocolo `file://` (cada `import` dispara uma checagem CORS que falha sem
 * origem HTTP), o que resultava em tela branca ao abrir por duplo clique.
 * Com IIFE + dynamic imports inlinados, vira um único bundle carregável como
 * script tradicional. O alvo singlefile não precisa disso porque o
 * `vite-plugin-singlefile` já injeta o JS inline.
 */
function noModuleHtmlPlugin(): Plugin {
  return {
    name: 'pj-no-module-html',
    enforce: 'post',
    transformIndexHtml(html) {
      return html
        .replace(/<script\s+type="module"\s+/g, '<script ')
        .replace(/\s+crossorigin\b/g, '');
    },
  };
}

export default defineConfig(({ mode }) => {
  const singlefile = mode === 'singlefile';
  return {
    plugins: [
      react(),
      ...(singlefile ? [viteSingleFile()] : [noModuleHtmlPlugin()]),
    ],
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
      // Singlefile usa o pipeline padrão (módulos) pois o plugin os inlina.
      // Para o alvo de pasta, força IIFE com dynamic imports inlinados —
      // ver justificativa em noModuleHtmlPlugin acima.
      rollupOptions: singlefile
        ? undefined
        : {
            output: {
              format: 'iife',
              inlineDynamicImports: true,
              entryFileNames: 'assets/[name]-[hash].js',
              assetFileNames: 'assets/[name]-[hash][extname]',
            },
          },
    },
  };
});
