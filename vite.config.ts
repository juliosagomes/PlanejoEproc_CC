import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { CHAVE_PUBLICA, montarManifest } from './manifest.config';

const raiz = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

/**
 * Emite `manifest.json` e os ícones como parte do bundle.
 *
 * Antes isso era um script rodado *depois* do Vite (`scripts/pack-ext.mjs`), o
 * que tornava `vite build --watch` inútil: os assets eram regenerados, mas a
 * pasta ficava sem manifest — e uma pasta sem manifest não é uma extensão.
 * Emitindo daqui, todo rebuild produz um `dist-ext/` completo por construção,
 * e o ciclo de desenvolvimento vira "salvar arquivo → F5 na aba".
 */
function extensao(): Plugin {
  let avisou = false;

  return {
    name: 'planejoeproc:extensao',
    async generateBundle() {
      const pkg: { version?: string } = JSON.parse(
        await readFile(raiz('./package.json'), 'utf8'),
      );
      const version = pkg.version ?? '0.0.0';

      this.emitFile({
        type: 'asset',
        fileName: 'manifest.json',
        source: JSON.stringify(montarManifest(version), null, 2),
      });

      const dirIcones = raiz('./src/extension/icons');
      for (const nome of (await readdir(dirIcones)).filter((f) => f.endsWith('.png'))) {
        this.emitFile({
          type: 'asset',
          fileName: `icons/${nome}`,
          source: await readFile(`${dirIcones}/${nome}`),
        });
      }
    },
    closeBundle() {
      // `closeBundle` roda a cada rebuild em watch; o aviso só interessa uma vez.
      if (avisou) return;
      avisou = true;
      if (!CHAVE_PUBLICA) {
        this.warn(
          'Sem `key` em manifest.config.ts — o ID da extensão muda se você mover ' +
            'dist-ext/, e os dados de chrome.storage.sync ficam para trás. ' +
            'Ver "Instalar como extensão" no README.md.',
        );
      }
      console.log(
        '\n  Instalar: chrome://extensions → Modo do desenvolvedor → ' +
          'Carregar sem compactação → dist-ext\n',
      );
    },
  };
}

/**
 * Alvo único: a extensão do Chrome (decisoes.md#D-15).
 *
 *   `vite build`          → `dist-ext/`, pronto para "Carregar sem compactação"
 *   `vite build --watch`  → o mesmo, recompilando a cada save (`npm run dev:ext`)
 *   `vite`                → servidor de dev com HMR, servindo só `index.html`.
 *                           Roda o editor como página comum: sem `chrome.*`, a
 *                           persistência cai no localStorage e não há popup,
 *                           sync de fundo nem notificações.
 *
 * Três entradas num build só. O service worker (`background.ts`) é entrada de
 * JS ao lado das duas páginas, e não um segundo passe do Vite: um service
 * worker MV3 com `"type": "module"` faz `import` estático normalmente, então
 * ele pode compartilhar chunks com as páginas em vez de duplicar `infra/` e Zod.
 */
export default defineConfig({
  plugins: [react(), extensao()],
  resolve: {
    alias: { '@': raiz('./src') },
  },
  base: './',
  build: {
    outDir: 'dist-ext',
    rollupOptions: {
      input: {
        index: raiz('./index.html'),
        popup: raiz('./popup.html'),
        background: raiz('./src/extension/background.ts'),
      },
      // Sem content hash: hash existe para cache busting em CDN, e a extensão
      // carrega do disco. Com hash, cada rebuild em watch deixaria para trás um
      // `index-<hash>.js` novo e `dist-ext/assets/` viraria um cemitério.
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
    // O bundle ultrapassa 500 KB porque inclui ReactFlow + 6 catálogos do
    // Eproc embutidos. Aceitável para um app offline; o aviso só polui.
    chunkSizeWarningLimit: 1500,
  },
});
