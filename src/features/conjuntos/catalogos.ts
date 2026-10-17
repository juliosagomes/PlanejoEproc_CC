import { DOCUMENTOS, EVENTOS, TIPOS_PETICAO, type ItemCatalogo } from '@/data';
import {
  CATEGORIAS_CONJUNTO_DOCUMENTO,
  CATEGORIAS_CONJUNTO_EVENTO,
  CONJUNTOS_DOCUMENTO_PADRAO,
  CONJUNTOS_EVENTO_PADRAO,
  CONJUNTOS_PETICAO_PADRAO,
  resolverConjuntosPadrao,
  resumirSelecao,
  type CatalogoConjunto,
  type Conjunto,
  type ResumoSelecao,
} from '@/domain';

/** O que o seletor e o checklist precisam saber de cada catálogo com conjuntos. */
export interface ConfigCatalogo {
  itens: readonly ItemCatalogo[];
  ids: readonly string[];
  /** Conjuntos padrão resolvidos contra o catálogo embutido. Calculados uma vez. */
  padrao: readonly Conjunto[];
  /** Vazio quando os padrão são uma lista plana. */
  categorias: readonly string[];
  /** "eventos", "tipos de petição", "documentos" — para "Todos os …". */
  plural: string;
  /** Para "1 evento", "1 tipo de petição". */
  singular: string;
}

function config(
  itens: readonly ItemCatalogo[],
  regras: Parameters<typeof resolverConjuntosPadrao>[1],
  resto: Pick<ConfigCatalogo, 'categorias' | 'plural' | 'singular'>,
): ConfigCatalogo {
  return { itens, ids: itens.map((e) => e.value), padrao: resolverConjuntosPadrao(itens, regras), ...resto };
}

export const CATALOGOS_CONJUNTO: Record<CatalogoConjunto, ConfigCatalogo> = {
  eventos: config(EVENTOS, CONJUNTOS_EVENTO_PADRAO, {
    categorias: CATEGORIAS_CONJUNTO_EVENTO,
    plural: 'eventos',
    singular: 'evento',
  }),
  tiposPeticao: config(TIPOS_PETICAO, CONJUNTOS_PETICAO_PADRAO, {
    categorias: [],
    plural: 'tipos de petição',
    singular: 'tipo de petição',
  }),
  documentos: config(DOCUMENTOS, CONJUNTOS_DOCUMENTO_PADRAO, {
    categorias: CATEGORIAS_CONJUNTO_DOCUMENTO,
    plural: 'documentos',
    singular: 'documento',
  }),
};

const ROTULOS: Record<CatalogoConjunto, Map<string, string>> = {
  eventos: new Map(EVENTOS.map((e) => [e.value, e.label])),
  tiposPeticao: new Map(TIPOS_PETICAO.map((e) => [e.value, e.label])),
  documentos: new Map(DOCUMENTOS.map((e) => [e.value, e.label])),
};

/**
 * Código sem rótulo (item que saiu do catálogo, ou documento digitado por nome
 * antes do D-41) aparece como veio.
 */
export function rotuloItem(catalogo: CatalogoConjunto, id: string): string {
  return ROTULOS[catalogo].get(id) ?? id;
}

export function resumir(
  catalogo: CatalogoConjunto,
  ids: readonly string[],
  conjuntos: readonly Conjunto[] = CATALOGOS_CONJUNTO[catalogo].padrao,
): ResumoSelecao {
  return resumirSelecao(ids, CATALOGOS_CONJUNTO[catalogo].ids, conjuntos);
}

const fmt = new Intl.NumberFormat('pt-BR');

function juntar(itens: string[]): string {
  if (itens.length <= 1) return itens.join('');
  return `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`;
}

export function contagem(catalogo: CatalogoConjunto, n: number): string {
  const c = CATALOGOS_CONJUNTO[catalogo];
  if (n === 1) return `1 ${c.singular}`;
  return `${n} ${c.plural}`;
}

/**
 * Uma linha legível, para o checklist e para o rótulo do resumo:
 * "Todos os eventos − Mera ciência e Despacho (1.011)". Na exclusão, os
 * avulsos vão pelo nome — são no máximo `LIMITE_EXCLUSAO` peças; na inclusão,
 * pela contagem, porque podem ser centenas.
 */
export function frasePorResumo(catalogo: CatalogoConjunto, r: ResumoSelecao): string {
  const todos = `Todos os ${CATALOGOS_CONJUNTO[catalogo].plural}`;
  if (r.modo === 'vazio') return '';
  if (r.modo === 'todos') return `${todos} (${fmt.format(r.total)})`;
  if (r.modo === 'exclusao') {
    const partes = [...r.conjuntos.map((c) => c.rotulo), ...r.avulsos.map((id) => rotuloItem(catalogo, id))];
    return `${todos} − ${juntar(partes)} (${fmt.format(r.total)})`;
  }
  const avulsos = r.avulsos.length
    ? [`${contagem(catalogo, r.avulsos.length)} avulso${r.avulsos.length > 1 ? 's' : ''}`]
    : [];
  return `${juntar([...r.conjuntos.map((c) => c.rotulo), ...avulsos])} (${fmt.format(r.total)})`;
}
