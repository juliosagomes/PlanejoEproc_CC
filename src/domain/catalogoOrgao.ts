/**
 * Catálogo de localizadores do órgão — fonte de sugestões para o input de
 * nome do localizador. Importado pelo usuário a partir do XLS exportado do
 * Eproc; persistido global por navegador (não viaja dentro do JSON do plano).
 *
 * Apenas localizadores **não-sistema** entram no catálogo: os de sistema são
 * padrões fixos do Eproc, e o objetivo do PlanejoEproc é incentivar o
 * desenho de fluxos próprios — sugeri-los seria contraproducente. O filtro
 * acontece no parser (`infra/catalogo/parseLocalizadoresXls`), não aqui.
 */
export const CATALOGO_ORGAO_VERSION = 1 as const;

export type CatalogoOrgaoVersion = typeof CATALOGO_ORGAO_VERSION;

export interface LocalizadorOrgao {
  /** Identificador estável gerado na importação. Não vem do Eproc. */
  id: string;
  /** Nome do localizador como aparece no Eproc, com emojis decodificados. */
  nome: string;
  /** Descrição livre do Eproc, decodificada e com whitespace normalizado. */
  descricao?: string;
}

export interface CatalogoOrgao {
  version: CatalogoOrgaoVersion;
  /** ISO 8601 UTC do momento em que o XLS foi importado. */
  importadoEm: string;
  itens: LocalizadorOrgao[];
}
