import type { Permissao } from '@/domain';
import type { PrefsSync } from '@/infra/sync/sessaoPersistida';

/* ============================================================================
 * CONTRATO DE MENSAGENS — página ↔ service worker
 *
 * Três direções, todas por `chrome.runtime.sendMessage`:
 *
 *   popup  → worker : pedir estado, sincronizar agora, salvar preferências
 *   worker → editor : "sincronize você, que eu não posso" (ver background.ts)
 *   worker → popup  : resposta das ações acima
 *
 * União discriminada por `tipo` em vez de objetos soltos: o `switch` no
 * `onMessage` fica exaustivo e o TypeScript reclama quando alguém adiciona uma
 * mensagem e esquece de tratá-la.
 * ========================================================================== */

/** Mensagens que o worker recebe. */
export type ParaWorker =
  | { tipo: 'estado' }
  | { tipo: 'sincronizar-agora' }
  | { tipo: 'salvar-prefs'; prefs: PrefsSync }
  | { tipo: 'abrir-editor' };

/** Mensagens que o worker envia às páginas do app. */
export type ParaPagina = { tipo: 'sincronize-voce' };

export interface EstadoLotacao {
  workspaceId: string;
  nome: string;
  permissao: Permissao;
}

export interface Estado {
  /** `null` = modo local ou nenhuma lotação aberta ainda. */
  lotacao: EstadoLotacao | null;
  /** ISO 8601 da última sincronização bem-sucedida nesta máquina. */
  ultimaSincronizacao: string | null;
  prefs: PrefsSync;
  sincronizando: boolean;
  /** Mensagem da última falha, para o popup não mentir que está tudo bem. */
  ultimoErro: string | null;
}

export type RespostaEstado = { ok: true; estado: Estado };
export type RespostaAcao = { ok: true } | { ok: false; erro: string };
