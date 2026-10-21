import {
  ehAtalho,
  ehDestinoDescarte,
  nomeEfetivo,
  rotuloDescarte,
  type EdgeKind,
  type LocalizadorData,
  type Position,
  type RegraAtpUnidade,
  type RegraSemMover,
  type Subitem,
} from '@/domain';
import { chaveNome } from '@/features/painel/presencaRegras';
import { regraDoEproc } from './conferirRegra';

/* ============================================================================
 * DESENHAR A PARTIR DA REGRA (decisoes.md#D-47, demo 11)
 *
 * Planeja o que uma ou mais regras da unidade viram no quadro, sem tocar nele:
 * a prévia mostra os efeitos, e só o clique em "Desenhar" aplica as operações.
 * Nada nasce sozinho.
 *
 * - Localizador e transição que já existem são reaproveitados; a regra entra
 *   como mais um recurso da transição (D-24).
 * - "A E B" no destino: uma seta até o primeiro, os outros em
 *   `outrosDestinos`; "E"/"OU" na origem vira `outrasOrigens` com a condição
 *   (D-42). Nada de leque.
 * - Origem "Nenhum": o localizador do filtro "Que Contenha" vira a origem; sem
 *   ele, uma entrada por evento (D-38). "Todos os localizadores" também.
 * - Destino de descarte (P, o invisível): a regra fica pendurada na origem.
 * ========================================================================== */

export interface NoDesenho {
  id: string;
  position: Position;
  data: Pick<LocalizadorData, 'nome' | 'atalhoPara' | 'atalhoOutroPlano' | 'regrasSemMover'>;
}

export interface ArestaDesenho {
  id: string;
  source: string;
  target: string;
  data?: { kind: EdgeKind; subitems: Subitem[] };
}

export interface EntradaDesenho {
  id: string;
  position: Position;
  rotulo: string;
}

export interface QuadroDesenho {
  nodes: readonly NoDesenho[];
  edges: readonly ArestaDesenho[];
  entradas: readonly EntradaDesenho[];
}

export interface EfeitoDesenho {
  tipo: 'novo' | 'ok' | 'aviso';
  texto: string;
}

export interface OperacoesDesenho {
  novosNos: { id: string; position: Position; nome: string; sistema: boolean }[];
  novasEntradas: EntradaDesenho[];
  novasArestas: { id: string; source: string; target: string; subitem: Subitem }[];
  /** Recurso a mais numa transição que já existe; `paraAtp` troca a manual por ATP. */
  recursos: { edgeId: string; subitem: Subitem; paraAtp: boolean }[];
  penduradas: { nodeId: string; regra: RegraSemMover }[];
}

export interface Desenho {
  efeitos: EfeitoDesenho[];
  operacoes: OperacoesDesenho;
  /** Id do que a câmera deve procurar depois de desenhar. */
  foco?: string;
}

export interface ContextoDesenho {
  descarte: readonly string[];
  /** Nomes de localizadores de sistema no catálogo da unidade (D-23). */
  sistema: readonly string[];
  gerarId: (prefixo: string) => string;
}

const LARGURA_COLUNA = 320;
const ALTURA_LINHA = 110;

/** Nº das regras já vinculadas a algum recurso do quadro. */
export function regrasNoQuadro(q: Pick<QuadroDesenho, 'nodes' | 'edges'>): Set<number> {
  const s = new Set<number>();
  for (const e of q.edges) for (const r of e.data?.subitems ?? []) if (r.eprocAtp) s.add(r.eprocAtp);
  for (const n of q.nodes) for (const r of n.data.regrasSemMover ?? []) if (r.eprocAtp) s.add(r.eprocAtp);
  return s;
}

/** Os localizadores que a regra toca: origens, destinos e os do filtro "Que Contenha". */
export function nomesDaRegra(r: RegraAtpUnidade): string[] {
  return [...r.origens, ...r.destinos, ...(r.filtroContem ?? [])];
}

function resumoDaLista(r: RegraAtpUnidade): string {
  return [
    `Regra ${r.numero} no Eproc (só a lista; sincronize a regra para o detalhe).`,
    r.gatilhoTexto && `Tipo de controle: ${r.gatilhoTexto}`,
    ...(r.acoesTexto ?? []).map((a) => `Ação: ${a}`),
    ...(r.filtrosTexto ?? []).map((f) => `Filtro: ${f}`),
  ]
    .filter(Boolean)
    .join('\n');
}

export function planejarDesenho(
  quadro: QuadroDesenho,
  regras: readonly RegraAtpUnidade[],
  ctx: ContextoDesenho,
): Desenho {
  const efeitos: EfeitoDesenho[] = [];
  const op: OperacoesDesenho = { novosNos: [], novasEntradas: [], novasArestas: [], recursos: [], penduradas: [] };
  let foco: string | undefined;

  // Cópias de trabalho: a segunda regra reaproveita o que a primeira criou.
  const nos = quadro.nodes.filter((n) => !ehAtalho(n)).map((n) => ({ id: n.id, nome: nomeEfetivo(quadro.nodes, n.id), position: n.position }));
  const entradas = [...quadro.entradas];
  const arestas = quadro.edges.map((e) => ({ id: e.id, source: e.source, target: e.target }));
  const jaDesenhadas = regrasNoQuadro(quadro);
  const sistema = new Set(ctx.sistema.map(chaveNome));

  const maxX = Math.max(0, ...quadro.nodes.map((n) => n.position.x), ...quadro.entradas.map((e) => e.position.x));
  const minY = Math.min(...[...quadro.nodes, ...quadro.entradas].map((n) => n.position.y), 0);
  let livre = { x: maxX + LARGURA_COLUNA, y: minY };
  const proximaLivre = (): Position => {
    const p = { ...livre };
    livre = { x: livre.x, y: livre.y + ALTURA_LINHA };
    return p;
  };
  /** Ao lado de quem já está: à direita da origem, empilhando. */
  const vizinhos = new Map<string, number>();
  const aoLadoDe = (id: string): Position => {
    const base = nos.find((n) => n.id === id)?.position ?? entradas.find((e) => e.id === id)?.position;
    if (!base) return proximaLivre();
    const k = vizinhos.get(id) ?? 0;
    vizinhos.set(id, k + 1);
    return { x: base.x + LARGURA_COLUNA, y: base.y + k * ALTURA_LINHA };
  };

  const acharNo = (nome: string) => nos.find((n) => chaveNome(n.nome) === chaveNome(nome));
  const garantirNo = (nome: string, perto?: string): string => {
    const achado = acharNo(nome);
    if (achado) return achado.id;
    const id = ctx.gerarId('n');
    const position = perto ? aoLadoDe(perto) : proximaLivre();
    const ehSistema = sistema.has(chaveNome(nome));
    nos.push({ id, nome, position });
    op.novosNos.push({ id, position, nome, sistema: ehSistema });
    efeitos.push({ tipo: 'novo', texto: `Localizador "${nome}" entra no plano${ehSistema ? ', de sistema' : ', já marcado como criado'}.` });
    return id;
  };

  for (const regra of regras) {
    const n = regra.numero;
    if (jaDesenhadas.has(n)) {
      efeitos.push({ tipo: 'aviso', texto: `Regra ${n} já está no plano: fica como está.` });
      continue;
    }
    jaDesenhadas.add(n);

    /* --- origem ------------------------------------------------------------ */
    let origemId: string;
    let origemNome: string;
    const candidatas = regra.tipoOrigem === 'localizadores' ? regra.origens : (regra.filtroContem ?? []);
    if (regra.tipoOrigem !== 'todos' && candidatas.length > 0) {
      origemNome = candidatas.find((c) => acharNo(c)) ?? (candidatas[0] as string);
      origemId = garantirNo(origemNome);
      if (regra.tipoOrigem === 'nenhum') {
        efeitos.push({ tipo: 'aviso', texto: `No Eproc a origem é "Nenhum". O filtro aponta para "${origemNome}", que vira a origem desenhada.` });
      }
    } else {
      const rotulo = regra.tipoOrigem === 'todos'
        ? `Todos os localizadores${regra.descricao ? ` · ${regra.descricao}` : ''}`
        : (regra.gatilhoTexto?.split(' / ').slice(1).join(' / ') || regra.tipoControle);
      const existente = entradas.find((e) => e.rotulo.trim() === rotulo.trim());
      if (existente) {
        origemId = existente.id;
      } else {
        origemId = ctx.gerarId('ev');
        const nova = { id: origemId, position: proximaLivre(), rotulo };
        entradas.push(nova);
        op.novasEntradas.push(nova);
        efeitos.push({ tipo: 'novo', texto: `Entrada por evento "${rotulo}".` });
      }
      origemNome = `Entrada por evento "${rotulo}"`;
    }
    foco ??= origemId;

    /* --- destino ----------------------------------------------------------- */
    const reais = regra.destinos.filter((d) => !ehDestinoDescarte(d, ctx.descarte));
    const subitemBase = (destino: string, pendurada: boolean): Subitem => {
      const atp = regraDoEproc(regra, undefined, { origem: origemNome, destino, pendurada });
      return {
        id: ctx.gerarId(pendurada ? 'rs' : 's'),
        categoria: 'Regra de ATP',
        nome: regra.descricao ?? `Regra ${n}`,
        ja_criado: true,
        eprocAtp: n,
        atp: regra.detalhe ? atp : { ...atp, observacoes: resumoDaLista(regra) },
      };
    };

    if (reais.length === 0) {
      if (op.novasEntradas.some((e) => e.id === origemId) || entradas.some((e) => e.id === origemId)) {
        efeitos.push({ tipo: 'aviso', texto: `Regra ${n} não move o processo e não tem localizador de origem: não foi desenhada.` });
        continue;
      }
      const destino = regra.destinos[0] ?? '';
      const efeito = /a[çc][ãa]o manual/i.test(regra.tipoControle) ? 'manual' : 'automatica';
      op.penduradas.push({
        nodeId: origemId,
        regra: { ...subitemBase(destino, true), categoria: 'Regra de ATP', efeito, ...(destino ? { destino } : {}) },
      });
      efeitos.push({
        tipo: 'aviso',
        texto: `Regra ${n} não move o processo (destino ${destino ? rotuloDescarte(destino) : 'nenhum'}): fica pendurada em "${origemNome}".`,
      });
      continue;
    }

    const destinoNome = reais[0] as string;
    const destinoId = garantirNo(destinoNome, origemId);
    const subitem = subitemBase(destinoNome, false);
    const aresta = arestas.find((a) => a.source === origemId && a.target === destinoId);
    if (aresta) {
      const kind = quadro.edges.find((e) => e.id === aresta.id)?.data?.kind;
      op.recursos.push({ edgeId: aresta.id, subitem, paraAtp: kind === 'manual' });
      efeitos.push({
        tipo: 'ok',
        texto: `Regra ${n} entra como mais um recurso na transição que já existe até "${destinoNome}"${kind === 'manual' ? ', que passa a ser ATP' : ''}.`,
      });
    } else {
      const id = ctx.gerarId('e');
      arestas.push({ id, source: origemId, target: destinoId });
      op.novasArestas.push({ id, source: origemId, target: destinoId, subitem });
      efeitos.push({ tipo: 'novo', texto: `Transição ATP "${origemNome}" → "${destinoNome}" com o recurso Regra ${n}.` });
    }
    if (subitem.atp?.outrosDestinos?.length) {
      efeitos.push({ tipo: 'aviso', texto: `Também leva para ${subitem.atp.outrosDestinos.join(', ')}: ficam em "Outros localizadores DESTINO", sem seta (D-42).` });
    }
    if (subitem.atp?.outrasOrigens?.length) {
      const cond = subitem.atp.opcaoMultiplosLocalizadores === 'AND' ? 'E' : 'OU';
      efeitos.push({ tipo: 'aviso', texto: `A origem tem também ${subitem.atp.outrasOrigens.join(', ')} (condição "${cond}"): ficam em "Outros localizadores ORIGEM".` });
    }
    if (!regra.detalhe) {
      efeitos.push({ tipo: 'aviso', texto: `Sem o detalhe da regra ${n}: o resumo da lista vai para as Observações.` });
    }
  }

  return { efeitos, operacoes: op, ...(foco ? { foco } : {}) };
}
