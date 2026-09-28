import type { Subitem } from './subitems';

/**
 * Tipo da transição entre dois localizadores.
 * - `atp`     — Automatização de Tramitação Processual (aresta animada azul).
 * - `pref`    — Preferência (aresta verde sólida).
 * - `manual`  — sem automação (aresta cinza tracejada).
 *
 * Continua sendo escolha explícita do usuário, e é ele quem manda no traço da
 * aresta — não as regras atreladas. Uma transição com duas ATPs e uma
 * preferência ainda tem um caráter dominante, e quem sabe qual é é quem
 * desenha (decisoes.md#D-24).
 */
export type EdgeKind = 'atp' | 'pref' | 'manual';

/**
 * Rótulos canônicos para exibição. Centralizados aqui (e não em features/canvas)
 * porque o termo é parte do domínio — ATP e Preferência são conceitos do Eproc,
 * não jargão da UI.
 */
export const KIND_LABELS = {
  atp: 'ATP',
  pref: 'Preferência',
  manual: 'Manual',
} as const satisfies Record<EdgeKind, string>;

/** Categoria de recurso que corresponde a cada tipo de aresta automatizada. */
export const KIND_CATEGORIA = {
  atp: 'Regra de ATP',
  pref: 'Preferência',
} as const;

/**
 * Posição manual da dobra ("cotovelo") da aresta no modo Diagrama.
 *
 * Guardada em dois campos porque *qual* eixo dobra depende de onde os nós
 * estão: com o destino folgadamente à direita o cotovelo é o segmento vertical
 * e anda no eixo x; caso contrário é o horizontal, e anda no y. O campo não
 * usado fica `undefined`, que significa automático — e é preservado, para que
 * mover um localizador para o outro lado e voltar traga o ajuste de volta.
 *
 * As duas unidades são diferentes de propósito, e os nomes dizem qual é qual.
 * Ver decisoes.md#D-21.
 */
export interface DobraAresta {
  /**
   * Onde o segmento **vertical** dobra, como fração [0,1] do vão entre as duas
   * alças. Relativa, e não coordenada absoluta: mover os nós mantém o cotovelo
   * proporcional em vez de deixá-lo para trás. Ausente ≡ 0.5, o automático.
   */
  fracaoX?: number;
  /**
   * Deslocamento do segmento **horizontal** a partir da linha média entre as
   * alças, em unidades do canvas. Aqui não é fração porque no caso que mais
   * importa — a seta que volta para trás entre dois nós na mesma altura — o
   * vão de referência seria zero, e nenhuma fração significaria coisa alguma.
   * Ausente ≡ 0, o automático.
   */
  desvioY?: number;
}

/**
 * Dados associados a uma aresta. Convenção: quando `kind === 'manual'`,
 * `subitems` é `[]` — uma transição sem automação não tem o que configurar.
 *
 * As regras de ATP e Preferência **não** moram aqui: cada uma é um `Subitem`
 * de categoria própria, o que permite mais de uma por aresta
 * (decisoes.md#D-24).
 */
export interface EdgeData {
  kind: EdgeKind;
  resumo: string;
  observacao: string;
  subitems: Subitem[];
  /**
   * Ajuste manual do cotovelo. Só tem efeito no modo Diagrama, mas é
   * preservado no Orgânico: alternar o modo por engano não pode apagar o que o
   * usuário ajustou.
   */
  dobra?: DobraAresta;
}
