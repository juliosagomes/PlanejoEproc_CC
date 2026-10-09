import type { Subitem } from './subitems';

/* ============================================================================
 * REGRAS QUE NÃO MOVEM (decisoes.md#D-38)
 *
 * Boa parte das regras de ATP da unidade não leva o processo a lugar nenhum:
 * existe pela ação (lembrete, dado complementar) ou para tirar um localizador
 * ("tira PETIÇÃO"). O Eproc exige um destino, e a unidade preenche com um
 * localizador onde ninguém olha — os **destinos de descarte**, como "P".
 *
 * Desenhadas como seta, essas regras apontavam para o descarte ou para nós sem
 * nome. Aqui elas ficam **penduradas no localizador de origem**, em três
 * grupos que o usuário escolhe ao pendurar:
 *
 *  - **automática**: dispara sozinha, só executa a ação;
 *  - **manual**: "Por Ação Manual", o botão que o servidor aciona na fila —
 *    o D-28 generalizado para regra sem destino real;
 *  - **limpeza**: tira um localizador do processo e o deixa onde está.
 *
 * O grupo é escolha, e não dedução da `AtpRule`: a limpeza tem destino real (o
 * próprio localizador) e só se distingue pela intenção.
 * ========================================================================== */

export const EFEITOS_SEM_MOVER = ['automatica', 'manual', 'limpeza'] as const;
export type EfeitoSemMover = (typeof EFEITOS_SEM_MOVER)[number];

export const EFEITO_SEM_MOVER_LABEL = {
  automatica: 'Automáticas, sem mover',
  manual: 'Ações manuais',
  limpeza: 'Limpeza de localizador',
} as const satisfies Record<EfeitoSemMover, string>;

/** Rótulo de uma regra só, para checklist e títulos. */
export const EFEITO_SEM_MOVER_CURTO = {
  automatica: 'automática, sem mover',
  manual: 'ação manual',
  limpeza: 'limpeza de localizador',
} as const satisfies Record<EfeitoSemMover, string>;

/**
 * Uma regra de ATP pendurada no localizador. É o mesmo recurso da aresta (nome,
 * já criado, detalhamento em `atp`), com a categoria sempre "Regra de ATP" —
 * assim o modal de detalhe e o checklist a leem como leem as outras.
 */
export interface RegraSemMover extends Subitem {
  categoria: 'Regra de ATP';
  efeito: EfeitoSemMover;
  /**
   * Destino que a regra preenche no Eproc. Para automática e manual, um
   * destino de descarte da unidade; ausente, vale o primeiro da lista.
   */
  destino?: string;
  /** Só na limpeza: o localizador que a regra tira do processo. */
  tira?: string;
}

export function contarPorEfeito(
  regras: readonly Pick<RegraSemMover, 'efeito'>[],
): Record<EfeitoSemMover, number> {
  const c = { automatica: 0, manual: 0, limpeza: 0 };
  for (const r of regras) c[r.efeito] += 1;
  return c;
}
