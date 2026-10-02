/* ============================================================================
 * DESCRITORES DE CAMPO DA REGRA DE ATP (decisoes.md#D-27)
 *
 * A tela "Cadastrar Nova Regra de ATP" do Eproc tem 24 ações programadas, cada
 * uma com parâmetros próprios, e mais de 40 filtros opcionais. Em vez de um
 * tipo e um trecho de JSX por campo, a estrutura da tela é descrita aqui como
 * dado, e a UI tem um renderizador só (`CampoDinamico`).
 *
 * A `chave` de cada campo é o **id do campo no Eproc** (`PrazoCMA`,
 * `selClassesJudiciaisMultiplo`…). Não é capricho: evita inventar nome para o
 * que o sistema já nomeou, e deixa o dado gravado alinhado com a tela real.
 * ========================================================================== */

export type ValorSimples = string | number | boolean | string[];

/** O que um campo pode guardar. Só `lista` usa a forma de array de objetos. */
export type ValorCampo = ValorSimples | Array<Record<string, ValorSimples>>;

export type Parametros = Record<string, ValorCampo>;

/**
 * Catálogos do Eproc embutidos no build. O domínio só conhece o **nome**; quem
 * tem os itens é `@/data`, que é obrigado pelo tipo a cobrir todos.
 */
export const CATALOGO_IDS = [
  'eventos',
  'tiposPeticao',
  'classes',
  'competencias',
  'statusProcesso',
  'rito',
  'dadoComplementarProcesso',
  'nivelSigilo',
  'modificadorData',
  'modificadorValor',
  'tipoInquerito',
  'tipoProcessoRelacionado',
  'prazo',
  'ultimaMovimentacao',
  'pendenciaCumprimento',
  'quantidadeDocEvento',
  'devolucaoCartaAr',
  'laudoPericial',
  'ordemConsultaRestricao',
  'tipoParte',
  'dadoComplementarParte',
  'litisconsorcio',
  'representacaoProcessual',
  'tipoPessoa',
  'qualificacaoParte',
  'poloEntidade',
  'poloRepresentante',
  'poloPeticao',
  'grupoEventoPeticao',
] as const;

export type CatalogoId = (typeof CATALOGO_IDS)[number];

/**
 * Listas que **não** são embutidas porque pertencem à unidade do usuário, e não
 * ao Eproc: a UI as resolve contra o plano aberto e o catálogo sincronizado.
 * `evento` é a exceção — é catálogo geral, mas o campo no Eproc é de texto com
 * autocompletar, então aqui também é texto com sugestão.
 */
export type SugestaoId = 'localizador' | 'modelo' | 'preferencia' | 'evento';

export interface OpcaoCampo {
  value: string;
  label: string;
}

interface CampoBase {
  /** Id do campo no Eproc. Único dentro da ação ou do filtro. */
  chave: string;
  rotulo: string;
  ajuda?: string;
  /**
   * O campo só existe quando outro campo do mesmo grupo vale um destes
   * códigos — "Data final" só com o modificador "entre datas". É o que a tela
   * do Eproc faz ao mostrar e esconder campos.
   */
  quando?: { chave: string; em: readonly string[] };
}

/** Campos que cabem dentro de um item de `lista`. */
export type CampoSimplesDef =
  | (CampoBase & {
      tipo: 'texto';
      sugestao?: SugestaoId;
      /** Valores que o Eproc oferece, sem impedir outro (ex.: órgão da unidade). */
      opcoes?: readonly OpcaoCampo[];
    })
  | (CampoBase & { tipo: 'textarea' })
  | (CampoBase & { tipo: 'numero' })
  | (CampoBase & { tipo: 'data' })
  | (CampoBase & { tipo: 'simNao' })
  | (CampoBase & { tipo: 'select'; opcoes?: readonly OpcaoCampo[]; catalogo?: CatalogoId })
  | (CampoBase & {
      tipo: 'multi';
      opcoes?: readonly OpcaoCampo[];
      catalogo?: CatalogoId;
      sugestao?: SugestaoId;
      /**
       * Aceita valor digitado. É o caso das listas grandes demais para embutir
       * (assunto, precedente, entidade) e das que são da unidade.
       */
      livre?: boolean;
    });

export type CampoDef =
  | CampoSimplesDef
  | (CampoBase & {
      tipo: 'lista';
      /** Rótulo do botão que acrescenta um item. */
      rotuloItem: string;
      subcampos: readonly CampoSimplesDef[];
    });

/**
 * O campo está em jogo com estes valores? Campo fora de jogo não é desenhado
 * nem listado no checklist, mesmo que tenha sobrado valor de antes.
 */
export function campoVisivel(campo: CampoDef, valores: Parametros): boolean {
  if (!campo.quando) return true;
  const v = valores[campo.quando.chave];
  return typeof v === 'string' && campo.quando.em.includes(v);
}

/** `true` quando o valor não diz nada — é o critério de "campo preenchido". */
export function valorVazio(v: ValorCampo | undefined): boolean {
  if (v === undefined || v === '') return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

/**
 * Grava um valor nos parâmetros, ou **remove a chave** quando ele é vazio. Sem
 * a remoção, apagar um campo deixaria `{ Prazo: '' }` para trás, e o plano
 * exportado carregaria chave que não diz nada.
 */
export function definirParametro(
  parametros: Parametros,
  chave: string,
  valor: ValorCampo | undefined,
): Parametros {
  const { [chave]: _anterior, ...resto } = parametros;
  return valorVazio(valor) || valor === undefined ? resto : { ...resto, [chave]: valor };
}

export function parametrosVazios(p: Parametros | undefined): boolean {
  if (!p) return true;
  return Object.values(p).every(valorVazio);
}
