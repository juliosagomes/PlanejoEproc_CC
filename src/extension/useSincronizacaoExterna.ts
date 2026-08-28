import { useEffect } from 'react';
import { assinarMudancaExterna, ehExtensao } from '@/infra/plataforma';

/* ============================================================================
 * O editor ouvindo o mundo de fora
 *
 * Sobrou uma coisa que mexe no silo sem passar por esta aba: **outra aba do
 * editor** gravando. O espelho do `chrome.storage` reconcilia sozinho, mas a UI
 * daqui continuaria mostrando o índice antigo.
 *
 * Havia uma segunda: o service worker pedindo "sincronize você" antes de
 * baixar os planos em segundo plano. Ela sumiu com o D-17 — o worker verifica e
 * notifica, não escreve, e não há mais o que delegar.
 *
 * Fora da extensão o hook não faz nada — no servidor de dev (`npm run dev`) e
 * nos testes não há service worker nem outras abas com a mesma origem.
 * ========================================================================== */

/** Chaves cuja mudança externa deve fazer a UI recarregar a lista de planos. */
function afetaPlanos(chaves: string[]): boolean {
  return chaves.some((c) => c.includes(':plan'));
}

export interface OpcoesSincronizacaoExterna {
  /** Alguém de fora gravou planos; recarregue índice e plano ativo. */
  aoMudarPlanos: () => void;
}

export function useSincronizacaoExterna({
  aoMudarPlanos,
}: OpcoesSincronizacaoExterna): void {
  useEffect(() => {
    if (!ehExtensao()) return;
    return assinarMudancaExterna((chaves) => {
      if (afetaPlanos(chaves)) aoMudarPlanos();
    });
  }, [aoMudarPlanos]);
}
