import type { Plano } from '@/domain';
import { useCanvasStore } from '@/features/canvas/store';
import { getAtivoId, listPlanos, loadPlano } from '@/infra/storage';
import type { PlanoComId } from './mencoes';

/**
 * Os planos do silo, para as menções e o desenho. O ativo vem da store do
 * canvas e não do storage: a gravação dele tem debounce, e uma menção ao
 * localizador que acabou de ser renomeado precisa achar o nome novo.
 */
export function todosOsPlanos(): PlanoComId[] {
  const ativo = getAtivoId();
  return listPlanos().map((e) => ({
    id: e.id,
    plano: e.id === ativo ? useCanvasStore.getState().getPlano() : loadPlano(e.id),
  }));
}

/** `null` quando o plano não existe mais neste silo. */
export function planoPorId(id: string): Plano | null {
  if (!listPlanos().some((e) => e.id === id)) return null;
  return id === getAtivoId() ? useCanvasStore.getState().getPlano() : loadPlano(id);
}
