import type { Plano, PlanoComNos } from '@/domain';
import { listPlanos, loadPlano } from '@/infra/storage';

/* ============================================================================
 * Os outros planos do silo, para o atalho que muda de fluxo (decisoes.md#D-40).
 *
 * O plano aberto fica de fora: o alvo do atalho para outro plano nunca está
 * nele. Os demais vêm do storage, e não da store — ninguém os edita enquanto
 * este está aberto, salvo outra aba, e aí o índice muda de `atualizadoEm`.
 * ========================================================================== */

export interface OutroPlano extends PlanoComNos {
  plano: Plano;
}

const cache = new Map<string, { atualizadoEm: string; plano: Plano }>();

export function outrosPlanos(ativoId: string | null): OutroPlano[] {
  return listPlanos()
    .filter((e) => e.id !== ativoId)
    .map((e) => {
      const guardado = cache.get(e.id);
      if (guardado && guardado.atualizadoEm === e.atualizadoEm) return { id: e.id, plano: guardado.plano };
      const plano = loadPlano(e.id);
      cache.set(e.id, { atualizadoEm: e.atualizadoEm, plano });
      return { id: e.id, plano };
    });
}
