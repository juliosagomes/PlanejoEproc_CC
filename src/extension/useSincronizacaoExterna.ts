import { useEffect } from 'react';
import { assinarMudancaExterna, ehExtensao } from '@/infra/plataforma';
import type { ParaPagina } from './mensagens';

/* ============================================================================
 * O editor ouvindo o mundo de fora
 *
 * Duas coisas podem mexer no silo sem passar por esta aba:
 *
 *  1. O service worker pede que **nós** sincronizemos (`sincronize-voce`).
 *     Ele delega em vez de agir porque o plano ativo vive na memória da store
 *     do canvas — ver `extension/background.ts`.
 *  2. Outra aba do editor gravou. Aí o espelho do `chrome.storage` reconcilia
 *     sozinho, mas a UI desta aba continuaria mostrando o índice antigo.
 *
 * Fora da extensão o hook não faz nada — no servidor de dev (`npm run dev`) e
 * nos testes não há service worker nem outras abas com a mesma origem.
 * ========================================================================== */

/** Chaves cuja mudança externa deve fazer a UI recarregar a lista de planos. */
function afetaPlanos(chaves: string[]): boolean {
  return chaves.some((c) => c.includes(':plan'));
}

export interface OpcoesSincronizacaoExterna {
  /** O worker pediu que esta aba sincronize com o servidor. */
  aoPedirSincronizacao: () => void;
  /** Alguém de fora gravou planos; recarregue índice e plano ativo. */
  aoMudarPlanos: () => void;
}

export function useSincronizacaoExterna({
  aoPedirSincronizacao,
  aoMudarPlanos,
}: OpcoesSincronizacaoExterna): void {
  useEffect(() => {
    if (!ehExtensao()) return;

    const cancelarEspelho = assinarMudancaExterna((chaves) => {
      if (afetaPlanos(chaves)) aoMudarPlanos();
    });

    // Sem `sendResponse` e sem `return true`: não respondemos nada, e devolver
    // `true` aqui seguraria o canal de mensagens que o popup usa para falar com
    // o worker.
    const ouvinte = (msg: ParaPagina): void => {
      if (msg?.tipo === 'sincronize-voce') aoPedirSincronizacao();
    };
    chrome.runtime.onMessage.addListener(ouvinte);

    return () => {
      cancelarEspelho();
      chrome.runtime.onMessage.removeListener(ouvinte);
    };
  }, [aoPedirSincronizacao, aoMudarPlanos]);
}
