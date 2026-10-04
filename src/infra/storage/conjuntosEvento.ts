import { CONJUNTOS_EVENTO_VERSION, type ConjuntosEventoUnidade } from '@/domain';
import { getStorage } from '@/infra/plataforma/storageLike';
import { prefixo } from './escopo';
import { ConjuntosEventoUnidadeSchema } from './schema';

/**
 * Conjuntos de eventos criados pelo usuário (decisoes.md#D-29). Uma chave por
 * silo, como os setores (D-26): é conhecimento da unidade sobre como ela agrupa
 * os eventos, não conteúdo de um plano.
 *
 *   modo local      →  planejoeproc:conjuntosEvento
 *   lotação <wsId>  →  planejoeproc:lot:<wsId>:conjuntosEvento
 *
 * Valor irreconhecível vira lista vazia, sem backup: o que se perde é um atalho
 * de seleção — os planos guardam os eventos explícitos, e nenhum deles muda.
 */

function conjuntosKey(): string | null {
  const p = prefixo();
  return p === null ? null : `${p}conjuntosEvento`;
}

export function loadConjuntosEvento(): ConjuntosEventoUnidade['itens'] {
  const key = conjuntosKey();
  const raw = key === null ? null : (getStorage()?.getItem(key) ?? null);
  if (raw === null) return [];
  try {
    const parsed = ConjuntosEventoUnidadeSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data.itens : [];
  } catch {
    return [];
  }
}

export function saveConjuntosEvento(itens: ConjuntosEventoUnidade['itens']): void {
  const key = conjuntosKey();
  if (key === null) return;
  try {
    if (itens.length === 0) getStorage()?.removeItem(key);
    else getStorage()?.setItem(key, JSON.stringify({ version: CONJUNTOS_EVENTO_VERSION, itens }));
  } catch (err) {
    console.warn('[storage] Falha ao salvar conjuntos de eventos.', err);
  }
}
