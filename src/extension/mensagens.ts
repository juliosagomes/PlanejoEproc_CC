import type { Permissao } from '@/domain';
import type { ResumoSincronizacao } from '@/infra/sync/operacoes';
import type { PrefsSync } from '@/infra/sync/sessaoPersistida';

/* ============================================================================
 * CONTRATO DE MENSAGENS — popup ↔ service worker
 *
 * Duas direções, ambas por `chrome.runtime.sendMessage`:
 *
 *   popup  → worker : pedir estado, verificar agora, salvar preferências
 *   worker → popup  : resposta das ações acima
 *
 * Já houve uma terceira (`worker → editor: "sincronize você"`). Ela existia
 * porque o worker baixava os planos sozinho e precisava delegar à aba aberta
 * para não sobrescrever o canvas por baixo. Com o D-17 o worker parou de
 * baixar: ele verifica e notifica, não escreve nada, e não há mais o que
 * delegar.
 *
 * União discriminada por `tipo` em vez de objetos soltos: o `switch` no
 * `onMessage` fica exaustivo e o TypeScript reclama quando alguém adiciona uma
 * mensagem e esquece de tratá-la.
 * ========================================================================== */

/** Mensagens que o worker recebe. */
export type ParaWorker =
  | { tipo: 'estado' }
  | { tipo: 'verificar-agora' }
  | { tipo: 'salvar-prefs'; prefs: PrefsSync }
  | { tipo: 'abrir-editor' };

export interface EstadoLotacao {
  workspaceId: string;
  nome: string;
  permissao: Permissao;
}

export interface Estado {
  /** `null` = modo local ou nenhuma lotação aberta ainda. */
  lotacao: EstadoLotacao | null;
  /** ISO 8601 do último *pull/push* bem-sucedido nesta máquina. */
  ultimaSincronizacao: string | null;
  /** ISO 8601 da última consulta ao servidor — inclusive as que não baixaram nada. */
  ultimaVerificacao: string | null;
  /** O que a última verificação encontrou de diferente, ou `null` se nada. */
  pendente: ResumoSincronizacao | null;
  prefs: PrefsSync;
  verificando: boolean;
  /** Mensagem da última falha, para o popup não mentir que está tudo bem. */
  ultimoErro: string | null;
}

export type RespostaEstado = { ok: true; estado: Estado };
export type RespostaAcao = { ok: true } | { ok: false; erro: string };
