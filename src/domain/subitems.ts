/**
 * Subitens de uma transição (aresta) — recursos do Eproc atrelados a uma ATP
 * ou Preferência. Cada subitem cai numa das categorias canônicas e pode ser
 * marcado como já criado no sistema real.
 */

export const SUBITEM_CATS = [
  'Texto padrão',
  'Preferência',
  'Modelo',
  'Regra de ATP',
  'Outro',
] as const;

export type SubitemCategoria = (typeof SUBITEM_CATS)[number];

export interface Subitem {
  /** Identificador local, único dentro da aresta. Gerado pelo cliente. */
  id: string;
  categoria: SubitemCategoria;
  nome: string;
  descricao?: string;
  /** Marcado quando o recurso já existe no Eproc. */
  ja_criado: boolean;
}
