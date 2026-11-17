import type { RegraAtpUnidade } from '@/domain';
import { linhasDiretas, textoDaCelula } from './infraTable';
import { semDecoracao, separarSiglaNome } from './nomeLocalizador';

/**
 * Parser da listagem `automatizar_localizadores` — as regras de ATP da unidade
 * (decisoes.md#D-46). Uma página só, sem paginação: 279 regras numa unidade
 * real, levantadas em 21/10/2026.
 *
 * Armadilhas da tela, todas na fixture:
 *
 * - **"** DESATIVADA **" está em toda linha**, escondido por CSS. A situação
 *   real é o checkbox `ativarDesativarRegra`, na coluna de ações.
 * - **Vários localizadores numa célula** vêm separados por
 *   `<span> OU </span>` ou `<span> E </span>`, cada um como "sigla - nome".
 *   A sigla pode conter " - ", por isso a separação é a do `<select>`.
 * - **Resumo e completo.** Gatilhos e filtros longos vêm duas vezes, em
 *   `dadosResumidos_N` (cortado) e `dadosCompletos_N`. Só o completo vale.
 * - **A coluna de destino traz as ações** logo depois dos localizadores, a
 *   partir do primeiro `<div>`.
 */

const COLUNAS = {
  numero: ['PRIORIDADE'],
  grupo: ['GRUPO'],
  origem: ['ORIGEM'],
  gatilho: ['TIPO DE CONTROLE'],
  destino: ['DESTINO'],
  filtros: ['OUTROS CRITERIOS'],
  acoes: ['ACOES'],
} as const;

type Coluna = keyof typeof COLUNAS;

/** Posições de reserva, as da tela levantada, se o cabeçalho não vier. */
const POSICAO_PADRAO: Record<Coluna, number> = {
  numero: 1,
  grupo: 2,
  origem: 3,
  gatilho: 4,
  destino: 5,
  filtros: 6,
  acoes: 7,
};

export function parseRegrasAtp(fragmento: string): RegraAtpUnidade[] {
  const doc = new DOMParser().parseFromString(fragmento, 'text/html');
  const tabela =
    doc.querySelector<HTMLTableElement>('#tableAutomatizacaoLocalizadores') ??
    doc.querySelector<HTMLTableElement>('table');
  if (!tabela) throw new Error('Não achei a tabela das regras de ATP.');

  const pos = posicoes(tabela);
  const regras: RegraAtpUnidade[] = [];
  for (const linha of linhasDiretas(tabela)) {
    const celulas = Array.from(linha.children).filter((c) => c.tagName === 'TD');
    if (celulas.length < 7) continue;
    const regra = lerLinha((c) => celulas[pos[c]]);
    if (regra) regras.push(regra);
  }
  return regras;
}

function posicoes(tabela: HTMLTableElement): Record<Coluna, number> {
  const ths = Array.from(tabela.tHead?.rows[0]?.cells ?? []);
  if (ths.length === 0) return POSICAO_PADRAO;
  const saida = { ...POSICAO_PADRAO };
  for (const coluna of Object.keys(COLUNAS) as Coluna[]) {
    const i = ths.findIndex((th) =>
      COLUNAS[coluna].some((s) => semDecoracao(th.textContent ?? '').includes(s)),
    );
    if (i >= 0) saida[coluna] = i;
  }
  return saida;
}

function lerLinha(celula: (c: Coluna) => Element | undefined): RegraAtpUnidade | null {
  const tdNumero = celula('numero');
  const numero = Number(
    (tdNumero?.querySelector('span span') ?? tdNumero)?.textContent?.match(/\d+/)?.[0],
  );
  if (!Number.isInteger(numero) || numero <= 0) return null;

  const tdOrigem = celula('origem');
  const tdDestino = celula('destino');
  const tdGatilho = celula('gatilho');
  const tdFiltros = celula('filtros');
  const tdAcoes = celula('acoes');

  const textoOrigem = tdOrigem ? textoDaCelula(tdOrigem).replace(/\s+/g, ' ') : '';
  const tipoOrigem = /^nenhum$/i.test(textoOrigem)
    ? 'nenhum'
    : /^todos os localizadores$/i.test(textoOrigem)
      ? 'todos'
      : 'localizadores';
  // Lista longa de localizadores também vem em resumo e completo.
  const origens =
    tipoOrigem === 'localizadores' && tdOrigem ? itensSeparados(completo(tdOrigem)) : null;
  const destinos = tdDestino ? itensSeparados(completo(tdDestino)) : null;

  const gatilho = tdGatilho ? completo(tdGatilho) : undefined;
  const tipoControle = gatilho ? tipoDoGatilho(gatilho) : '';
  const gatilhoTexto = gatilho ? textoDaCelula(gatilho).replace(/\n/g, ' ') : '';
  const descricao = gatilhoTexto.match(/Descrição:\s*(.+)$/)?.[1]?.trim();

  const filtros = tdFiltros ? blocosDeFiltro(tdFiltros) : [];
  const acoesTexto = tdDestino ? acoesDaCelula(tdDestino) : [];
  const grupo = celula('grupo')?.querySelector('a, span')?.textContent?.trim();

  return {
    numero,
    ...(idDaRegra(tdAcoes) ? { eprocId: idDaRegra(tdAcoes) } : {}),
    ...(grupo ? { grupo } : {}),
    ativa: Boolean(tdAcoes?.querySelector('input[type="checkbox"]')?.hasAttribute('checked')),
    tipoOrigem,
    origens: origens?.itens ?? [],
    ...(origens && origens.itens.length > 1 && origens.op
      ? { opcaoOrigens: origens.op === 'E' ? ('AND' as const) : ('OR' as const) }
      : {}),
    destinos: destinos?.itens ?? [],
    tipoControle,
    ...(gatilhoTexto ? { gatilhoTexto } : {}),
    ...(descricao ? { descricao } : {}),
    ...(acoesTexto.length ? { acoesTexto } : {}),
    ...(filtros.length ? { filtrosTexto: filtros.map((f) => f.texto) } : {}),
    ...filtroContem(filtros),
  };
}

/**
 * O tipo de controle. Quase sempre é o `<b>` do começo ("Por Evento / …"),
 * mas em "Por Evento ou Petição ou Documento" o tipo vem em texto e o `<b>` é
 * o subtipo casado ("PETIÇÃO", "EVENTO").
 */
function tipoDoGatilho(raiz: Element): string {
  const b = raiz.querySelector('b');
  let antes = '';
  for (const no of Array.from(raiz.childNodes)) {
    if (no === b || no.contains(b)) break;
    antes += no.textContent ?? '';
  }
  const texto = antes.replace(/\s+/g, ' ').replace(/\s*\/\s*$/, '').trim();
  return (
    texto ||
    (b?.textContent ?? '').trim() ||
    textoDaCelula(raiz).split(/[/\n]/)[0]?.trim() ||
    ''
  );
}

/** O bloco completo, quando a tela mostra também um resumo cortado. */
function completo(td: Element): Element {
  return td.querySelector('[id^="dadosCompletos_"]') ?? td;
}

function idDaRegra(td: Element | undefined): string | undefined {
  const links = Array.from(td?.querySelectorAll('a[href]') ?? []);
  for (const a of links) {
    const href = a.getAttribute('href') ?? '';
    if (!/acao=automatizar_localizadores_alterar/.test(href) || /sin_duplicar_regra=S/.test(href)) {
      continue;
    }
    const id = href.match(/id_controle_localizador_sistema=(\d+)/)?.[1];
    if (id) return id;
  }
  return undefined;
}

/**
 * Localizadores de uma célula, até o primeiro `<div>` (onde começam as ações),
 * com o conector entre eles. Um rótulo inicial ("Classe:") é pulado.
 */
function itensSeparados(raiz: Element): { itens: string[]; op?: 'OU' | 'E' } {
  const itens: string[] = [];
  let atual = '';
  let op: 'OU' | 'E' | undefined;

  const fechar = () => {
    const texto = atual.replace(/\s+/g, ' ').trim();
    if (texto) itens.push(separarSiglaNome(texto).sigla);
    atual = '';
  };

  for (const no of Array.from(raiz.childNodes)) {
    if (no.nodeType === Node.TEXT_NODE) {
      atual += no.textContent ?? '';
      continue;
    }
    if (!(no instanceof Element)) continue;
    if (no.tagName === 'DIV') break;
    if (no.tagName === 'BR' || no.id.startsWith('alternarVisualizacao')) continue;
    const texto = (no.textContent ?? '').trim();
    if (no.tagName === 'SPAN' && (texto === 'OU' || texto === 'E')) {
      op = texto;
      fechar();
      continue;
    }
    if (/:\s*$/.test(texto)) continue;
    atual += no.textContent ?? '';
  }
  fechar();
  return { itens, ...(op ? { op } : {}) };
}

interface BlocoFiltro {
  rotulo: string;
  texto: string;
  raiz: Element;
}

/** Um filtro por `<div>`: o rótulo em negrito e o valor depois dele. */
function blocosDeFiltro(td: Element): BlocoFiltro[] {
  const raiz = completo(td);
  return Array.from(raiz.children)
    .filter((el) => el.tagName === 'DIV')
    .map((div) => {
      const texto = textoDaCelula(div).replace(/\s+/g, ' ').replace(/\s*:\s*/, ': ').trim();
      const rotulo = div.querySelector('span, b')?.textContent?.replace(/:\s*$/, '').trim() ?? '';
      return { rotulo, texto, raiz: div };
    })
    .filter((b) => b.texto);
}

/**
 * Localizadores dos filtros "Que Contenha Todos" e "Que Contenha ao Menos Um".
 * O "NÃO Contenha" fica de fora: ele diz onde o processo não está.
 */
function filtroContem(blocos: BlocoFiltro[]): { filtroContem?: string[] } {
  const nomes = blocos
    .filter((b) => /^Localizador \(Que Contenha/i.test(b.rotulo))
    .flatMap((b) => itensSeparados(b.raiz).itens);
  return nomes.length ? { filtroContem: nomes } : {};
}

/**
 * Ações programadas da coluna de destino, uma por item. Com uma só, o Eproc
 * não numera; com várias, cada uma começa por um `<div>` "#n-…".
 */
function acoesDaCelula(td: Element): string[] {
  const clone = td.cloneNode(true) as Element;
  for (const br of Array.from(clone.querySelectorAll('br'))) br.replaceWith('\n');
  for (const div of Array.from(clone.querySelectorAll('div'))) {
    div.prepend('\n');
    div.append('\n');
  }
  const texto = clone.textContent ?? '';
  const inicio = texto.indexOf('Executar Ação Programada:');
  if (inicio < 0) return [];
  const linhas = texto
    .slice(inicio + 'Executar Ação Programada:'.length)
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const acoes: string[][] = [];
  for (const linha of linhas) {
    if (/^#\d+-/.test(linha) || acoes.length === 0) acoes.push([]);
    if (!/^#\d+-/.test(linha)) acoes[acoes.length - 1]?.push(linha);
  }
  return acoes.map((a) => a.join(' · ')).filter(Boolean);
}
