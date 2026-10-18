import {
  DIAS_SEMANA,
  acaoProgramadaDef,
  faltaNoGatilho,
  type AlvoPendencia,
  type AtpRule,
  type AtpTrigger,
  type CatalogoConjunto,
  type EfeitoSemMover,
  type PrefRule,
} from '@/domain';
import { POLOS_PETICAO, STATUS_PROCESSO, buscarLabel } from '@/data';
import { frasePorResumo, resumir, rotuloItem } from '@/features/conjuntos/catalogos';
import { detalhesFiltros, fmtParametros } from './detalhesAtp';

/* ============================================================================
 * A REGRA DE ATP ESCRITA EM PORTUGUÊS (decisoes.md#D-45)
 *
 * "Quando for lançado o evento X, o processo que estiver em A vai para B e sai
 * de A. Então o Eproc executa…" — uma frase corrida, para conferir a regra sem
 * ler campo por campo. O modal a mostra no topo, e o mapa descritivo pode
 * usá-la no lugar da lista de campos.
 *
 * Sai em trechos, e não em texto pronto, porque cada leitor desenha de um
 * jeito: o modal grifa o que falta e o torna clicável, o mapa escreve HTML, e
 * "Copiar frase" quer texto puro. O que falta usa os textos de
 * `estadoBlocosAtp`, para a frase e a navegação do modal dizerem o mesmo.
 * ========================================================================== */

export type Trecho =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'valor'; texto: string }
  | { tipo: 'falta'; texto: string; alvo: AlvoPendencia };

export interface ContextoFrase {
  /** As pontas da aresta. */
  origem: string;
  destino: string;
  /** Regra que não move, pendurada no localizador (decisoes.md#D-38). */
  pendurada?: { efeito: EfeitoSemMover; tira?: string };
}

const t = (texto: string): Trecho => ({ tipo: 'texto', texto });
const v = (texto: string): Trecho => ({ tipo: 'valor', texto: texto.trim() || '(sem nome)' });
const falta = (texto: string, alvo: AlvoPendencia): Trecho => ({ tipo: 'falta', texto: `falta ${texto}`, alvo });

/** "A", "A ou B", "A, B ou C". */
function juntar(itens: readonly string[], conj: 'ou' | 'e'): string {
  if (itens.length <= 1) return itens.join('');
  return `${itens.slice(0, -1).join(', ')} ${conj} ${itens.at(-1)}`;
}

/** Quantos itens avulsos cabem na frase antes de virar "e outros N". */
const LIMITE_LISTA = 4;

const ARTIGOS: Record<CatalogoConjunto, { um: string; varios: string; conjunto: string }> = {
  eventos: { um: 'o evento', varios: 'um dos eventos', conjunto: 'um evento de' },
  tiposPeticao: { um: 'petição do tipo', varios: 'petição de um dos tipos', conjunto: 'petição de' },
  documentos: { um: 'documento do tipo', varios: 'documento de um dos tipos', conjunto: 'documento de' },
};

/**
 * A seleção de eventos, petições ou documentos em poucas palavras. Com
 * conjunto, vale o resumo do D-29 ("Todos os eventos − Mera ciência"); sem
 * ele, os nomes, até um limite.
 */
function selecao(catalogo: CatalogoConjunto, ids: readonly string[]): Trecho[] {
  const a = ARTIGOS[catalogo];
  if (ids.length === 1) return [t(`${a.um} `), v(rotuloItem(catalogo, ids[0] ?? ''))];
  const r = resumir(catalogo, ids);
  if (r.modo === 'inclusao' && r.conjuntos.length === 0) {
    const nomes = ids.map((id) => rotuloItem(catalogo, id));
    const lista =
      nomes.length <= LIMITE_LISTA
        ? juntar(nomes, 'ou')
        : `${nomes.slice(0, LIMITE_LISTA - 1).join(', ')} e outros ${nomes.length - LIMITE_LISTA + 1}`;
    return [t(`${a.varios} `), v(lista)];
  }
  return [t(`${a.conjunto} `), v(frasePorResumo(catalogo, r))];
}

/** "por PÓLO ATIVO", "por ENTIDADE ESPECÍFICA: União". QUALQUER PARTE é o padrão e não se diz. */
function quem(g: { restringirA?: string; entidade?: string }): Trecho[] {
  if (!g.restringirA || g.restringirA === 'Q') return [];
  const polo = buscarLabel(POLOS_PETICAO, g.restringirA) ?? g.restringirA;
  if (g.restringirA !== 'S') return [t(' por '), v(polo)];
  return g.entidade?.trim() ? [t(' por '), v(g.entidade)] : [t(' por '), v(polo), t(' '), falta('entidade', 'gatilho')];
}

function dias(n: number, uteis?: boolean): string {
  return `${n} dia${n === 1 ? '' : 's'}${uteis ? (n === 1 ? ' útil' : ' úteis') : ''}`;
}

/** "08/10/2026" a partir do ISO que o campo de data grava. */
function dataBr(iso: string): string {
  const [a, m, d] = iso.split('-');
  return a && m && d ? `${d}/${m}/${a}` : iso;
}

function quandoPorData(g: Extract<AtpTrigger, { tipo: 'D' }>): Trecho[] {
  const pend = faltaNoGatilho(g);
  if (!g.tipoData) return [t('Quando '), falta(pend ?? '', 'gatilho')];
  if (g.tipoData === 'T') return [t('Todos os dias')];
  if (g.tipoData === 'D') return g.data ? [t('Em '), v(dataBr(g.data))] : [t('Em '), falta('data', 'gatilho')];
  if (g.tipoData === 'M') {
    return g.diaMes != null ? [t('Todo dia '), v(String(g.diaMes)), t(' do mês')] : [t('Todo mês, '), falta('dia do mês', 'gatilho')];
  }
  if (!g.diaSemana) return [t('Toda semana, '), falta('dia da semana', 'gatilho')];
  const dia = (buscarLabel(DIAS_SEMANA, g.diaSemana) ?? g.diaSemana).toLowerCase();
  // Domingo e sábado são masculinos; os outros, "-feira".
  return [t(g.diaSemana === '0' || g.diaSemana === '6' ? 'Todo ' : 'Toda '), v(dia)];
}

/** O começo da frase: o que dispara a regra. */
export function quando(g: AtpTrigger | undefined): Trecho[] {
  if (!g) return [t('Quando '), falta('tipo de controle', 'tipoControle')];
  const pend = faltaNoGatilho(g);
  switch (g.tipo) {
    case 'A': {
      const partes: Trecho[][] = [];
      if (g.eventoIds?.length) partes.push([t('for lançado '), ...selecao('eventos', g.eventoIds)]);
      if (g.peticaoTipoIds?.length) partes.push([t('for juntada '), ...selecao('tiposPeticao', g.peticaoTipoIds)]);
      if (g.documentos?.length) partes.push([t('for juntado '), ...selecao('documentos', g.documentos)]);
      if (partes.length === 0) return [t('Quando '), falta(pend ?? '', 'gatilho')];
      return [t('Quando '), ...partes.flatMap((p, i) => (i === 0 ? p : [t(' ou '), ...p])), ...quem(g)];
    }
    case 'E':
      return g.eventoIds?.length
        ? [t('Quando for lançado '), ...selecao('eventos', g.eventoIds)]
        : [t('Quando for lançado '), falta('evento', 'gatilho')];
    case 'P':
      return g.peticaoTipoIds?.length
        ? [t('Quando for juntada '), ...selecao('tiposPeticao', g.peticaoTipoIds), ...quem(g)]
        : [t('Quando for juntada petição '), falta('tipo de petição', 'gatilho')];
    case 'O':
      return g.documento?.trim()
        ? [t('Quando for juntado documento do tipo '), v(g.documento)]
        : [t('Quando for juntado documento '), falta('tipo de documento', 'gatilho')];
    case 'D':
      return quandoPorData(g);
    case 'L':
      return g.dias != null
        ? [t('Depois de '), v(dias(g.dias, g.diasUteis)), t(' no localizador')]
        : [t('Depois de '), falta(pend ?? '', 'gatilho')];
    case 'S': {
      const situacao = g.statusId
        ? [v(buscarLabel(STATUS_PROCESSO, g.statusId) ?? g.statusId)]
        : [falta('situação', 'gatilho')];
      const tempo = g.dias != null ? [v(dias(g.dias, g.diasUteis))] : [falta('quantos dias', 'gatilho')];
      return [t('Depois de '), ...tempo, t(' na situação '), ...situacao];
    }
    case 'V':
      return g.dias != null
        ? [t('Depois de '), v(dias(g.dias)), t(' sem movimentação')]
        : [t('Depois de '), falta(pend ?? '', 'gatilho')];
    case 'M':
      return [
        t('Quando alguém '),
        v('acionar a regra à mão'),
        ...(g.descricao?.trim() ? [t(` (“${g.descricao.trim()}”)`)] : []),
      ];
  }
}

function listaLocs(nomes: readonly string[], conj: 'ou' | 'e', prefixo = ''): Trecho[] {
  return nomes.flatMap((n, i) => {
    const sep = i === 0 ? [] : [t(i === nomes.length - 1 ? ` ${conj} ${prefixo}` : `, ${prefixo}`)];
    return [...sep, v(n)];
  });
}

/** "o processo que estiver em A ou em B". Sem a condição escolhida, a dúvida fica no lugar do "ou". */
function emOrigens(origens: readonly string[], r: AtpRule): Trecho[] {
  if (origens.length <= 1) return [t('o processo que estiver em '), v(origens[0] ?? '')];
  if (r.opcaoMultiplosLocalizadores === 'AND') {
    return [t('o processo que estiver ao mesmo tempo em '), ...listaLocs(origens, 'e', 'em ')];
  }
  if (r.opcaoMultiplosLocalizadores === 'OR') {
    return [t('o processo que estiver em '), ...listaLocs(origens, 'ou', 'em ')];
  }
  return [
    t('o processo que estiver em '),
    v(origens[0] ?? ''),
    t(' '),
    falta('“ou” ou “e”', 'multiplos'),
    t(' em '),
    ...listaLocs(origens.slice(1), 'e'),
  ];
}

function comportamento(r: AtpRule, origens: readonly string[]): Trecho[] {
  switch (r.comportamentoOrigem) {
    case '0':
      return [t(' e sai de '), ...listaLocs(origens, 'e')];
    case '4':
      return [t(' e sai de '), ...listaLocs(origens, 'e'), t(', se for localizador de sistema')];
    case '1':
      return [t(' e '), v('sai de todos os outros localizadores')];
    case '2':
      return [t(' e '), v('sai de todos os outros localizadores'), t(', exceto os de sistema e os fixos')];
    case '3':
      return [t(' e '), v('continua também'), t(' em '), ...listaLocs(origens, 'e')];
    default:
      return [t(' e '), falta('comportamento da origem', 'comportamento')];
  }
}

/** O meio da frase: de onde o processo sai e para onde vai. */
function movimento(r: AtpRule, ctx: ContextoFrase): Trecho[] {
  const origens = [ctx.origem, ...(r.outrasOrigens ?? [])].filter((n) => n.trim());
  const destinos = [ctx.destino, ...(r.outrosDestinos ?? [])].filter((n) => n.trim());
  const p = ctx.pendurada;
  if (p && p.efeito !== 'limpeza') {
    return [
      ...emOrigens(origens, r),
      t(' fica onde está'),
      ...(destinos.length ? [t(' (o destino '), ...listaLocs(destinos, 'e'), t(' só preenche o campo que o Eproc exige)')] : []),
    ];
  }
  // A limpeza tem destino real, o próprio localizador: dizer "vai para A e sai
  // de A" seria fiel aos campos e ilegível. O que importa é o que ela tira.
  if (p) {
    return [
      ...emOrigens(origens, r),
      t(' fica onde está'),
      ...(p.tira?.trim() ? [t(' e perde o localizador '), v(p.tira)] : []),
    ];
  }
  return [...emOrigens(origens, r), t(' vai para '), ...listaLocs(destinos.length ? destinos : [''], 'e'), ...comportamento(r, origens)];
}

function acoes(r: AtpRule): Trecho[] {
  const lista = r.acoes ?? [];
  if (lista.length === 0) return [];
  const partes = lista.map((a, i): Trecho[] => {
    if (!a.tipo) return [falta(`tipo da ${i + 1}ª ação`, `acao:${a.id}`)];
    const def = acaoProgramadaDef(a.tipo);
    const params = fmtParametros(def?.campos ?? [], a.parametros).map((l) => l.replace(/\n/g, '; '));
    return [
      v(def?.rotulo ?? a.tipo),
      ...(params.length ? [t(` (${params.join('; ')})`)] : []),
      ...(a.localizadorErro?.trim() ? [t(' — se falhar, o processo vai para '), v(a.localizadorErro)] : []),
    ];
  });
  return [t(' Então o Eproc executa '), ...partes.flatMap((p, i) => (i === 0 ? p : [t('; em seguida, '), ...p])), t('.')];
}

function filtros(r: AtpRule): Trecho[] {
  const lista = detalhesFiltros(r);
  if (lista.length === 0) return [];
  const partes = lista.map((f): Trecho[] => [v(f.label), t(`: ${f.valor.replace(/\n/g, '; ')}`)]);
  return [t(' Só vale para processos com '), ...partes.flatMap((p, i) => (i === 0 ? p : [t('; '), ...p])), t('.')];
}

function capa(g: AtpTrigger | undefined): Trecho[] {
  if (g?.tipo !== 'M' || (!g.acaoPreferencialNaCapa && !g.umClique)) return [];
  const onde = g.acaoPreferencialNaCapa ? ' A regra aparece como ação preferencial na capa do processo' : ' A regra';
  return [t(`${onde}${g.umClique ? `${g.acaoPreferencialNaCapa ? ' e' : ''} executa em um único clique` : ''}.`)];
}

export function fraseAtp(rule: AtpRule | undefined, ctx: ContextoFrase): Trecho[] {
  const r: AtpRule = rule ?? { implantar: false };
  return [...quando(r.trigger), t(', '), ...movimento(r, ctx), t('.'), ...acoes(r), ...filtros(r), ...capa(r.trigger)];
}

/** Para copiar e para o checklist: o que falta vai entre colchetes. */
export function fraseTexto(trechos: readonly Trecho[]): string {
  return trechos.map((x) => (x.tipo === 'falta' ? `[${x.texto}]` : x.texto)).join('');
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Para o mapa descritivo: valores em negrito, o que falta em itálico. */
export function fraseHtml(trechos: readonly Trecho[]): string {
  return trechos
    .map((x) => (x.tipo === 'valor' ? `<b>${esc(x.texto)}</b>` : x.tipo === 'falta' ? `<em>[${esc(x.texto)}]</em>` : esc(x.texto)))
    .join('');
}

/** A preferência não tem os blocos da ATP: a frase é o tipo, o efeito e o conteúdo da minuta. */
export function frasePref(p: PrefRule | undefined): Trecho[] {
  if (!p) return [];
  const out: Trecho[] = [];
  if (p.tipo) out.push(t('Preferência de '), v(p.tipo.toLowerCase()));
  if (p.acao?.trim()) out.push(t(out.length ? ': ' : ''), t(p.acao.trim()));
  if (out.length) out.push(t('.'));
  if (p.tipo === 'Minuta' && p.minutaModo && p.minutaConteudo?.trim()) {
    out.push(t(` Usa o ${p.minutaModo === 'modelo' ? 'modelo' : 'texto padrão'} `), v(p.minutaConteudo), t('.'));
  }
  return out;
}
