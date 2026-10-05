import type { OrdemPlanos, PlanIndexEntry } from '@/infra/storage';

const comparadorNome = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

/**
 * `numeric` põe "Plano 2" antes de "Plano 10", e `sensitivity: 'base'` faz
 * "Égua" cair junto do "E" em vez de no fim da lista. Empate de nome desempata
 * pelo mais recente, para que dois "Plano sem título" não troquem de lugar a
 * cada abertura do menu.
 */
export function ordenarPlanos(planos: PlanIndexEntry[], ordem: OrdemPlanos): PlanIndexEntry[] {
  const recentes = (a: PlanIndexEntry, b: PlanIndexEntry) =>
    b.atualizadoEm.localeCompare(a.atualizadoEm);
  if (ordem === 'recentes') return [...planos].sort(recentes);
  return [...planos].sort(
    (a, b) => comparadorNome.compare(a.nome.trim(), b.nome.trim()) || recentes(a, b),
  );
}
