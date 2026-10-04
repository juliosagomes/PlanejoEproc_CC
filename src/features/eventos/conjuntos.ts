import { EVENTOS } from '@/data';
import {
  resolverConjuntosPadrao,
  resumirSelecaoEventos,
  type ConjuntoEvento,
  type ResumoSelecaoEventos,
} from '@/domain';

/** Os conjuntos padrão resolvidos contra o catálogo embutido. Calculado uma vez. */
export const CONJUNTOS_PADRAO: readonly ConjuntoEvento[] = resolverConjuntosPadrao(EVENTOS);

export const IDS_EVENTOS: readonly string[] = EVENTOS.map((e) => e.value);

const ROTULOS = new Map(EVENTOS.map((e) => [e.value, e.label]));

/** Código sem rótulo (evento que saiu do catálogo) aparece como o próprio código. */
export function rotuloEvento(id: string): string {
  return ROTULOS.get(id) ?? id;
}

export function resumirEventos(
  ids: readonly string[],
  conjuntos: readonly ConjuntoEvento[] = CONJUNTOS_PADRAO,
): ResumoSelecaoEventos {
  return resumirSelecaoEventos(ids, IDS_EVENTOS, conjuntos);
}

const fmt = new Intl.NumberFormat('pt-BR');

function juntar(itens: string[]): string {
  if (itens.length <= 1) return itens.join('');
  return `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`;
}

/**
 * Uma linha legível, para o checklist e para o título do resumo:
 * "Todos os eventos, exceto Mera ciência e 2 avulsos (1.011)".
 */
export function frasePorResumo(r: ResumoSelecaoEventos): string {
  if (r.modo === 'vazio') return '';
  if (r.modo === 'todos') return `Todos os eventos (${fmt.format(r.total)})`;
  const avulsos = r.avulsos.length
    ? [`${r.avulsos.length} evento${r.avulsos.length > 1 ? 's' : ''} avulso${r.avulsos.length > 1 ? 's' : ''}`]
    : [];
  const partes = [...r.conjuntos.map((c) => c.rotulo), ...avulsos];
  if (r.modo === 'exclusao') {
    return `Todos os eventos, exceto ${juntar(partes)} (${fmt.format(r.total)})`;
  }
  return `${juntar(partes)} (${fmt.format(r.total)})`;
}
