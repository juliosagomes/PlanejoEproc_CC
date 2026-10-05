/**
 * Anotações do usuário sobre os recursos do catálogo (decisoes.md#D-25).
 *
 * O catálogo diz **o que existe** na unidade; a anotação diz **o que fazer com
 * aquilo** — para que serve este modelo, quando usar aquela preferência. É
 * conhecimento da secretaria, não do Eproc, e por isso não vem de coleta
 * nenhuma.
 *
 * Vive fora de `CatalogoOrgao` e de `CatalogoUnidade` porque reimportar o XLS e
 * ressincronizar a unidade **sobrescrevem** o catálogo inteiro: guardada lá
 * dentro, a anotação duraria até a próxima atualização.
 */
export const ANOTACOES_CATALOGO_VERSION = 1 as const;

export type AnotacoesCatalogoVersion = typeof ANOTACOES_CATALOGO_VERSION;

/**
 * Os quatro tipos de recurso que o catálogo conhece. Não é
 * `SubitemCategoria`: `Regra de ATP` e `Outro` não vêm de catálogo nenhum, e
 * `Localizador` não é subitem.
 */
export const TIPOS_RECURSO = [
  'Localizador',
  'Preferência',
  'Modelo',
  'Texto padrão',
  // As consultas salvas das telas de relatório (decisoes.md#D-32). A anotação é
  // o único lugar onde os filtros delas ficam escritos: a coleta só traz o nome.
  'Consulta salva',
] as const;

export type TipoRecurso = (typeof TIPOS_RECURSO)[number];

export interface AnotacaoRecurso {
  /** O que o recurso é, nas palavras da unidade. */
  descricao?: string;
  /** Quando e como usar — o que a coleta nunca traz. */
  orientacoes?: string;
  /** ISO 8601 UTC da última edição. */
  atualizadoEm: string;
}

export interface AnotacoesCatalogo {
  version: AnotacoesCatalogoVersion;
  /**
   * Chave: `${tipo}|${forma canônica do nome}`, montada por `chaveAnotacao`
   * (`infra/catalogo/chaveAnotacao.ts` — a canonização depende de
   * `semDecoracao`, que é de infra).
   *
   * Chaveado por **nome**, e não por id, e é isso que faz a anotação
   * sobreviver: o XLS não traz id estável, e `eprocId` é opcional nos itens
   * coletados da unidade.
   */
  itens: Record<string, AnotacaoRecurso>;
}

/** Nada anotado ainda. */
export function anotacoesVazias(): AnotacoesCatalogo {
  return { version: ANOTACOES_CATALOGO_VERSION, itens: {} };
}

/** `true` quando a anotação não tem conteúdo nenhum — vale apagar em vez de gravar. */
export function anotacaoVazia(a: Pick<AnotacaoRecurso, 'descricao' | 'orientacoes'>): boolean {
  return !a.descricao?.trim() && !a.orientacoes?.trim();
}
