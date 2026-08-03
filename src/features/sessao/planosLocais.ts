import type { Plano } from '@/domain';
import {
  PLANO_BUNDLE_VERSION,
  comEscopo,
  listPlanos,
  loadPlano,
} from '@/infra/storage';
import { downloadJson, hojeIso } from '@/utils/download';

/* ============================================================================
 * Planos do modo local, vistos de fora da sessão.
 *
 * A tela de login roda sem escopo (nenhum silo apontado), então precisa
 * espiar o silo local via `comEscopo` para saber se há algo lá. São esses os
 * planos "em cache" que o app oferece salvar antes de o usuário entrar numa
 * lotação: os de dentro de uma lotação já têm cópia no servidor; os do modo
 * local só existem neste navegador.
 * ========================================================================== */

const ESCOPO_LOCAL = { tipo: 'local' } as const;

export function contarPlanosLocais(): number {
  return comEscopo(ESCOPO_LOCAL, () => listPlanos().length);
}

export function lerPlanosLocais(): Plano[] {
  return comEscopo(ESCOPO_LOCAL, () => listPlanos().map((e) => loadPlano(e.id)));
}

/** Baixa os planos do modo local como bundle — mesmo formato de "Salvar todos". */
export function baixarPlanosLocais(): void {
  const plans = lerPlanosLocais();
  if (plans.length === 0) return;
  downloadJson(`planejoeproc-modo-local-${hojeIso()}.json`, {
    kind: 'planejoeproc-bundle' as const,
    version: PLANO_BUNDLE_VERSION,
    exportedAt: new Date().toISOString(),
    plans,
  });
}
