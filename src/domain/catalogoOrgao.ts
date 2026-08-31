/**
 * Catálogo de localizadores do órgão — fonte de sugestões para o input de
 * nome do localizador. Importado pelo usuário a partir do XLS exportado do
 * Eproc; persistido global por navegador (não viaja dentro do JSON do plano).
 *
 * Os localizadores **de sistema** entram junto com os da unidade, marcados por
 * `sistema` (decisoes.md#D-23). A separação que antes era filtro no parser hoje
 * é destaque na apresentação: esconder o padrão do Eproc tirava da autocomplete
 * metade dos localizadores por onde os fluxos de fato passam.
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
  /**
   * `true` quando a coluna "Localizador Sistema" do Eproc diz Sim.
   *
   * Opcional, e é isso que mantém `CATALOGO_ORGAO_VERSION` em 1: um catálogo já
   * gravado no navegador não tem o campo, e exigi-lo o reprovaria no `safeParse`
   * do `loadCatalogoOrgao` — jogando fora o catálogo do usuário.
   */
  sistema?: boolean;
}

export interface CatalogoOrgao {
  version: CatalogoOrgaoVersion;
  /** ISO 8601 UTC do momento em que o XLS foi importado. */
  importadoEm: string;
  itens: LocalizadorOrgao[];
}
