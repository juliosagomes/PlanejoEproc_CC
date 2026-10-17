import {
  KIND_LABELS,
  type BlocoFluxo,
  type DefinicaoFlag,
  type Edge,
  type EdgeKind,
  type Localizador,
  type Plano,
  type Position,
} from '@/domain';
import { orientacaoDaDobra, xDaFracao, yDoDesvio, OFFSET_SMOOTHSTEP } from '@/features/canvas/dobra';
import { esc } from './html';

/* ============================================================================
 * O DESENHO DO PLANO EM PAPEL (decisoes.md#D-39)
 *
 * Um SVG gerado do domínio, não um print do ReactFlow: sai nítido em qualquer
 * escala, não depende da câmera nem do tema, e o texto continua selecionável
 * no PDF. Usa as posições gravadas no plano e o mesmo traçado em degrau do
 * quadro, com a dobra manual do D-21.
 *
 * Os tipos se distinguem pelo **traço**, não só pela cor (ATP com traço longo,
 * preferência contínua, manual pontilhada), para a impressão em preto e branco.
 * As cores vêm de tokens `--p-*` da classe `.papel`, fixos e claros: papel não
 * tem tema escuro.
 * ========================================================================== */

/** Medida do cartão no papel. O quadro mede cada nó; o plano gravado não. */
export const NO_LARGURA = 176;
export const NO_ALTURA = 56;

export interface Recorte {
  /** Os localizadores escolhidos. */
  escolhidos: Set<string>;
  /** Escolhidos mais as pontas de fora, quando `fora`. */
  visiveis: Set<string>;
  /** As transições do recorte, na ordem de leitura. */
  arestas: Edge[];
  /** Número de cada transição, pela leitura do desenho (esquerda → direita). */
  numero: Record<string, number>;
}

function porId(plano: Plano): Map<string, Localizador> {
  return new Map(plano.nodes.map((n) => [n.id, n]));
}

/** O nome de um nó; o atalho (D-30) não tem nome próprio, e usa o do alvo. */
export function nomeDoNo(plano: Plano, id: string): string {
  const nos = porId(plano);
  const n = nos.get(id);
  if (!n) return '';
  const alvo = n.data.atalhoPara ? nos.get(n.data.atalhoPara) : undefined;
  return (alvo ?? n).data.nome.trim() || 'Localizador sem nome';
}

/**
 * As transições entre os escolhidos e, com `fora`, também as que entram e saem
 * do conjunto. Só ligam localizadores: a seta que sai de uma entrada por evento
 * (D-38) ou chega numa moldura (D-31) não tem ponta no desenho em papel.
 */
export function recortar(plano: Plano, ids: readonly string[], fora: boolean): Recorte {
  const nos = porId(plano);
  const escolhidos = new Set(ids.filter((id) => nos.has(id)));
  const arestas = plano.edges
    .filter((e) => nos.has(e.source) && nos.has(e.target))
    .filter((e) =>
      fora
        ? escolhidos.has(e.source) || escolhidos.has(e.target)
        : escolhidos.has(e.source) && escolhidos.has(e.target),
    );
  const pos = (id: string) => nos.get(id)!.position;
  arestas.sort(
    (a, b) =>
      pos(a.source).x - pos(b.source).x ||
      pos(a.source).y - pos(b.source).y ||
      pos(a.target).y - pos(b.target).y,
  );
  const visiveis = new Set(escolhidos);
  for (const e of arestas) {
    visiveis.add(e.source);
    visiveis.add(e.target);
  }
  const numero: Record<string, number> = {};
  arestas.forEach((e, i) => {
    numero[e.id] = i + 1;
  });
  return { escolhidos, visiveis, arestas, numero };
}

interface Traco {
  d: string;
  /** Ponta da seta (entrada do destino). */
  tx: number;
  ty: number;
  /** Onde vai o número da transição. */
  selo: { x: number; y: number };
}

/**
 * O degrau entre a alça direita da origem e a esquerda do destino. Espelha o
 * `getSmoothStepPath` nos dois ramos que o app produz (ver `canvas/dobra.ts`).
 */
export function traco(origem: Position, destino: Position, edge: Edge): Traco {
  const g = {
    sourceX: origem.x + NO_LARGURA,
    sourceY: origem.y + NO_ALTURA / 2,
    targetX: destino.x,
    targetY: destino.y + NO_ALTURA / 2,
  };
  const { sourceX: sx, sourceY: sy, targetX: tx, targetY: ty } = g;
  const dobra = edge.data.dobra;
  if (orientacaoDaDobra(g) === 'vertical') {
    if (Math.abs(ty - sy) < 1) return { d: `M${sx},${sy} H${tx}`, tx, ty, selo: { x: (sx + tx) / 2, y: ty } };
    const cx = xDaFracao(dobra?.fracaoX ?? 0.5, g);
    return { d: `M${sx},${sy} H${cx} V${ty} H${tx}`, tx, ty, selo: { x: cx, y: (sy + ty) / 2 } };
  }
  const cy = yDoDesvio(dobra?.desvioY ?? 0, g);
  const a = sx + OFFSET_SMOOTHSTEP;
  const b = tx - OFFSET_SMOOTHSTEP;
  return {
    d: `M${sx},${sy} H${a} V${cy} H${b} V${ty} H${tx}`,
    tx,
    ty,
    selo: { x: (a + b) / 2, y: cy },
  };
}

/* O quadro tem vãos largos — o usuário espalha o desenho para trabalhar —, e
   no papel cada vão rouba tamanho de letra. As colunas e linhas do recorte são
   reaproximadas até um vão máximo, sem trocar a ordem de nada. */
const VAO_MAX_X = NO_LARGURA + 90;
const VAO_MAX_Y = NO_ALTURA + 44;

function compactarEixo(valores: number[], vaoMax: number): Map<number, number> {
  const unicos = [...new Set(valores)].sort((a, b) => a - b);
  const mapa = new Map<number, number>();
  let atual = 0;
  unicos.forEach((v, i) => {
    if (i > 0) atual += Math.min(v - unicos[i - 1]!, vaoMax);
    mapa.set(v, atual);
  });
  return mapa;
}

/** Posições do recorte no papel. */
export function posicoesNoPapel(plano: Plano, r: Recorte): Map<string, Position> {
  const nos = plano.nodes.filter((n) => r.visiveis.has(n.id));
  const xs = compactarEixo(nos.map((n) => Math.round(n.position.x)), VAO_MAX_X);
  const ys = compactarEixo(nos.map((n) => Math.round(n.position.y)), VAO_MAX_Y);
  return new Map(
    nos.map((n) => [n.id, { x: xs.get(Math.round(n.position.x))!, y: ys.get(Math.round(n.position.y))! }]),
  );
}

function setorDoNo(n: Localizador, setores: readonly DefinicaoFlag[]): DefinicaoFlag | undefined {
  return n.data.flags.map((id) => setores.find((s) => s.id === id)).find(Boolean);
}

/** O desenho do recorte, pronto para entrar no mapa. */
export function svgDoRecorte(plano: Plano, r: Recorte, setores: readonly DefinicaoFlag[]): string {
  const visiveis = plano.nodes.filter((n) => r.visiveis.has(n.id));
  if (visiveis.length === 0) return '';
  const pos = posicoesNoPapel(plano, r);
  const em = (id: string) => pos.get(id)!;
  const folga = 24;
  const todas = [...pos.values()];
  const x0 = Math.min(...todas.map((p) => p.x)) - folga;
  const y0 = Math.min(...todas.map((p) => p.y)) - folga;
  const x1 = Math.max(...todas.map((p) => p.x + NO_LARGURA)) + folga;
  const y1 = Math.max(...todas.map((p) => p.y + NO_ALTURA)) + folga;
  const deFora = (e: Edge) => (r.escolhidos.has(e.source) && r.escolhidos.has(e.target) ? '' : ' fantasma');

  const linhas = r.arestas.map((e) => {
    const t = traco(em(e.source), em(e.target), e);
    const k = e.data.kind;
    return `<g class="${deFora(e).trim()}"><path class="ar ${k}" d="${t.d}"/><path class="ponta ${k}" d="M${t.tx - 8},${t.ty - 4.5} L${t.tx},${t.ty} L${t.tx - 8},${t.ty + 4.5} z"/></g>`;
  });

  const cartoes = visiveis.map((n) => {
    const { x, y } = em(n.id);
    const setor = setorDoNo(n, setores);
    const flag = setor
      ? `<rect x="${x + NO_LARGURA - 25}" y="${y + 5}" width="20" height="13" rx="3" fill="var(--p-flag-${setor.cor}-bg)"/><text class="flag-tx" x="${x + NO_LARGURA - 15}" y="${y + 11.5}" fill="var(--p-flag-${setor.cor}-fg)">${esc(setor.code)}</text>`
      : '';
    const atalho = n.data.atalhoPara ? '↪ ' : '';
    return `<g class="${r.escolhidos.has(n.id) ? '' : 'fantasma'}"><rect class="no-r${n.data.ja_criado ? ' criado' : ''}" x="${x}" y="${y}" width="${NO_LARGURA}" height="${NO_ALTURA}" rx="7"/><foreignObject x="${x}" y="${y}" width="${NO_LARGURA - (setor ? 26 : 4)}" height="${NO_ALTURA}"><div xmlns="http://www.w3.org/1999/xhtml" class="no-t">${atalho}${esc(nomeDoNo(plano, n.id))}</div></foreignObject>${flag}</g>`;
  });

  const selos = r.arestas.map((e) => {
    const t = traco(em(e.source), em(e.target), e);
    const k = e.data.kind;
    return `<g class="${deFora(e).trim()}"><circle class="selo-n ${k}" cx="${t.selo.x}" cy="${t.selo.y}" r="9"/><text class="selo-t ${k}" x="${t.selo.x}" y="${t.selo.y + 0.5}">${r.numero[e.id]}</text></g>`;
  });

  return `<svg viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Desenho do fluxo">${linhas.join('')}${cartoes.join('')}${selos.join('')}</svg>`;
}

/** A chave de leitura que acompanha o desenho. */
export function chaveDeLeitura(r: Recorte, plano: Plano, setores: readonly DefinicaoFlag[], fora: boolean): string {
  const amostra = (k: EdgeKind) =>
    `<span class="it"><svg width="30" height="8" aria-hidden="true"><line class="ar ${k}" x1="1" y1="4" x2="29" y2="4"/></svg>${KIND_LABELS[k]}</span>`;
  const usados = new Map<string, DefinicaoFlag>();
  for (const n of plano.nodes) {
    if (!r.visiveis.has(n.id)) continue;
    const s = setorDoNo(n, setores);
    if (s) usados.set(s.id, s);
  }
  const setoresHtml = [...usados.values()]
    .map((s) => `<span class="it"><span class="flag-p fp-${s.cor}">${esc(s.code)}</span>${esc(s.label)}</span>`)
    .join('');
  return `<div class="chave-p">${amostra('atp')}${amostra('pref')}${amostra('manual')}<span class="it"><span class="caixa-no criado"></span>existe no Eproc</span><span class="it"><span class="caixa-no"></span>a criar</span>${fora ? '<span class="it fantasma-it">esmaecido: fora da seleção</span>' : ''}${setoresHtml}</div>`;
}

/**
 * Impressão digital do que o desenho mostra. Se o plano mudar algo que aparece
 * nele (nome, posição, tipo de transição, dobra, setor, "já existe"), a
 * assinatura muda e o mapa avisa que o desenho ficou para trás.
 */
export function assinaturaDoRecorte(plano: Plano, r: Recorte): string {
  const nos = plano.nodes
    .filter((n) => r.visiveis.has(n.id))
    .map((n) => [n.id, nomeDoNo(plano, n.id), n.data.ja_criado, n.data.flags.join(','), Math.round(n.position.x), Math.round(n.position.y)]);
  const arestas = r.arestas.map((e) => [e.id, e.source, e.target, e.data.kind, e.data.dobra?.fracaoX ?? '', e.data.dobra?.desvioY ?? '']);
  return hash(JSON.stringify([[...r.escolhidos].sort(), nos, arestas]));
}

/** djb2 em hexadecimal: não é segurança, é só detectar mudança. */
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

export function desenharBloco(
  plano: Plano,
  planoId: string,
  ids: readonly string[],
  fora: boolean,
  setores: readonly DefinicaoFlag[],
  agora: string,
): BlocoFluxo {
  const r = recortar(plano, ids, fora);
  return {
    planoId,
    planoNome: plano.planoNome,
    nos: [...r.escolhidos],
    fora,
    assinatura: assinaturaDoRecorte(plano, r),
    svg: svgDoRecorte(plano, r, setores) + chaveDeLeitura(r, plano, setores, fora),
    desenhadoEm: agora,
  };
}

/** `true` quando o plano mudou algo que o desenho mostra — ou o plano sumiu. */
export function blocoDesatualizado(bloco: BlocoFluxo, plano: Plano | null): boolean {
  if (!plano) return true;
  return assinaturaDoRecorte(plano, recortar(plano, bloco.nos, bloco.fora)) !== bloco.assinatura;
}
