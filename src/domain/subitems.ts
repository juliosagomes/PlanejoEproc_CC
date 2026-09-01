import type { AtpRule, PrefRule } from './regras';

/**
 * Subitens de uma transição (aresta) — recursos do Eproc atrelados a ela. Cada
 * recurso cai numa das categorias canônicas e pode ser marcado como já criado
 * no sistema real.
 *
 * Dois deles são mais do que um nome: `Regra de ATP` e `Preferência` carregam
 * o **detalhamento** da automação (gatilho, filtros, ação). É por isso que uma
 * aresta comporta mais de uma regra — duas ATPs, ou uma ATP e uma preferência
 * (decisoes.md#D-24).
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
  /**
   * Detalhamento da regra. Só um dos dois é usado, conforme a `categoria` —
   * mas os dois são preservados ao trocá-la, para que reclassificar por engano
   * não apague o que o usuário preencheu. Use `regraDoSubitem` para ler.
   */
  atp?: AtpRule;
  pref?: PrefRule;
}
