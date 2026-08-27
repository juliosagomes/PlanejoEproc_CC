/**
 * Manifest da extensão (MV3).
 *
 * Mora na raiz, ao lado de `vite.config.ts` e `tailwind.config.ts`, porque é o
 * artefato de configuração mais importante do projeto — é ele que define o que
 * a extensão pode fazer. O `vite.config.ts` o emite como parte do build (ver o
 * plugin `extensao()` lá), então `dist-ext/` já sai completo a cada compilação,
 * inclusive em watch. Não há passo de empacotamento depois do Vite.
 *
 * A `version` vem do `package.json` — manter dois números em sincronia à mão é
 * o tipo de coisa que só se descobre quebrada na hora de publicar.
 */

/**
 * Chave pública fixa da extensão.
 *
 * Carregando sem compactação, o Chrome deriva o ID da extensão do **caminho da
 * pasta**. Sem `key`, mover ou renomear `dist-ext/` cria uma extensão nova — e
 * como `chrome.storage.sync` é indexado por ID, os códigos de lotação
 * replicados (decisoes.md#D-14) ficariam para trás.
 *
 * Como gerar a sua (uma vez só, ver README):
 *   1. chrome://extensions → "Pacote de extensão" apontando para dist-ext/
 *   2. guarde o .pem gerado FORA do repo (está no .gitignore)
 *   3. openssl rsa -in chave.pem -pubout -outform DER | openssl base64 -A
 *   4. cole o resultado aqui
 *
 * Vazia = sem `key` no manifest: funciona, mas o ID passa a depender do caminho.
 * O build avisa enquanto estiver assim.
 */
import { PADROES_EPROC } from './src/extension/eprocUrls';

export const CHAVE_PUBLICA = '';

export function montarManifest(version: string): Record<string, unknown> {
  return {
    manifest_version: 3,
    name: 'PlanejoEproc',
    version,
    description:
      'Planeje fluxos de trabalho do Eproc — localizadores, transições e regras de ATP — antes de configurá-los no sistema real.',
    ...(CHAVE_PUBLICA ? { key: CHAVE_PUBLICA } : {}),
    action: {
      default_popup: 'popup.html',
      default_title: 'PlanejoEproc',
      default_icon: { 16: 'icons/icon16.png', 32: 'icons/icon32.png' },
    },
    // `type: module` é o que permite ao service worker fazer `import` estático
    // dos chunks compartilhados que o Vite emite — é por isso que ele não
    // precisa ser um arquivo único.
    background: { service_worker: 'assets/background.js', type: 'module' },
    // Mínimo necessário. Sem `tabs` seria impossível focar a aba do editor já
    // aberta (e abrir uma segunda perderia o estado do canvas). `scripting` é
    // o que permite injetar o coletor na aba do Eproc quando o usuário clica em
    // "Sincronizar com a unidade" — não há content script declarado, então nada
    // roda no Eproc sem o clique.
    permissions: [
      'storage',
      'unlimitedStorage',
      'alarms',
      'notifications',
      'tabs',
      'scripting',
    ],
    // O /exec do Apps Script responde 302 para script.googleusercontent.com.
    // Sem a segunda entrada, o fetch do service worker morre depois do redirect
    // com um erro de rede genérico, difícil de diagnosticar.
    //
    // Os padrões do Eproc vêm de src/extension/eprocUrls.ts, que é a mesma lista
    // usada no chrome.tabs.query. Divergir as duas produziria o pior sintoma
    // possível: o app acha a aba e a injeção falha por falta de permissão.
    host_permissions: [
      'https://script.google.com/*',
      'https://script.googleusercontent.com/*',
      ...PADROES_EPROC,
    ],
    icons: {
      16: 'icons/icon16.png',
      32: 'icons/icon32.png',
      48: 'icons/icon48.png',
      128: 'icons/icon128.png',
    },
  };
}
