import { ehAtalho, noEfetivo, nomeEfetivo, type DefinicaoFlag, type EdgeKind } from '@/domain';

/* ============================================================================
 * BUSCA NO QUADRO (decisoes.md#D-43)
 *
 * Lógica pura da paleta do Ctrl+K: recebe o que está no quadro e devolve os
 * resultados já ordenados. A paleta só desenha e executa.
 *
 * A comparação ignora acento e caixa, e a ordem dá preferência ao nome que
 * **começa** com o que foi digitado, descontado o prefixo "[FAMÍLIA]": quem
 * digita "replica" quer "[CUMPRIMENTO] Ag. Réplica" antes de "Decurso do prazo
 * da réplica".
 * ========================================================================== */

interface NoBusca {
  id: string;
  data: {
    nome: string;
    flags: string[];
    atalhoPara?: string;
    atalhoOutroPlano?: { planoId: string; noId: string; planoNome: string; nome: string };
  };
}

interface ArestaBusca {
  id: string;
  source: string;
  target: string;
  data?: { kind: EdgeKind; resumo: string; subitems: ReadonlyArray<{ nome: string }> };
}

interface GrupoBusca {
  id: string;
  rotulo: string;
  membros: readonly string[];
  recolhido?: boolean;
}

export interface QuadroBusca {
  nodes: readonly NoBusca[];
  edges: readonly ArestaBusca[];
  grupos: readonly GrupoBusca[];
  setores: readonly DefinicaoFlag[];
}

export interface ResultadoLocalizador {
  id: string;
  nome: string;
  setores: DefinicaoFlag[];
  entradas: number;
  saidas: number;
  /** Moldura recolhida que esconde o nó: a câmera vai até ela (D-31). */
  grupoRecolhido?: { id: string; rotulo: string };
}

export interface ResultadoTransicao {
  id: string;
  kind: EdgeKind;
  /** O resumo, ou o nome do primeiro recurso quando não há resumo. */
  titulo: string;
  /** O recurso onde o termo apareceu, quando não foi no título — senão a linha não diz por que veio. */
  recursoCasado?: string;
  origem: string;
  destino: string;
  source: string;
  target: string;
}

export interface ResultadoSetor {
  setor: DefinicaoFlag;
  total: number;
}

export interface ResultadosBusca {
  localizadores: ResultadoLocalizador[];
  transicoes: ResultadoTransicao[];
  setores: ResultadoSetor[];
}

export const LIMITE_LOCALIZADORES = 8;
/** Sem nada digitado, uns poucos para a lista não empurrar os comandos para baixo. */
export const LIMITE_LOCALIZADORES_VAZIO = 4;
export const LIMITE_TRANSICOES = 5;

/** Remove acento e caixa, um caractere de cada vez para os índices baterem com o original. */
function normalizarChar(c: string): string {
  return c.normalize('NFD').replace(/\p{M}+/gu, '').toLocaleLowerCase('pt-BR');
}

export function normalizar(texto: string): string {
  return Array.from(texto, normalizarChar).join('');
}

/** "[CUMPRIMENTO] Ag. Réplica" → "Ag. Réplica"; também tira emoji e símbolo do começo. */
export function semPrefixoFamilia(nome: string): string {
  return nome.replace(/^[^\p{L}\p{N}[]*(\[[^\]]*\])?[^\p{L}\p{N}]*/u, '');
}

/**
 * Onde o termo casa no texto original, já mapeado de volta dos índices
 * normalizados — para grifar "Réplica" quando se digitou "replica".
 */
export function trechoCasado(texto: string, consulta: string): { inicio: number; fim: number } | null {
  const alvo = normalizar(consulta.trim());
  if (!alvo) return null;
  // Para cada caractere normalizado, onde começa e termina o original de onde veio.
  const inicios: number[] = [];
  const fins: number[] = [];
  let normal = '';
  let pos = 0;
  for (const c of Array.from(texto)) {
    const n = normalizarChar(c);
    for (let k = 0; k < n.length; k++) {
      inicios.push(pos);
      fins.push(pos + c.length);
    }
    normal += n;
    pos += c.length;
  }
  const i = normal.indexOf(alvo);
  if (i < 0) return null;
  return { inicio: inicios[i] ?? 0, fim: fins[i + alvo.length - 1] ?? texto.length };
}

/**
 * 0 = o nome (sem o prefixo) começa com o termo; 1 = alguma palavra começa;
 * 2 = aparece no meio; `null` = não casa.
 */
export function pontuar(texto: string, consulta: string): number | null {
  const alvo = normalizar(consulta.trim());
  if (!alvo) return 2;
  const n = normalizar(semPrefixoFamilia(texto));
  if (n.startsWith(alvo)) return 0;
  if (n.split(/[\s.\-/()]+/).some((p) => p.startsWith(alvo))) return 1;
  if (normalizar(texto).includes(alvo)) return 2;
  return null;
}

function porPontuacao<T>(itens: Array<{ item: T; nota: number; nome: string }>): T[] {
  return itens
    .sort((a, b) => a.nota - b.nota || a.nome.localeCompare(b.nome, 'pt-BR'))
    .map((x) => x.item);
}

function contarPontas(q: QuadroBusca): { entradas: Map<string, number>; saidas: Map<string, number> } {
  const entradas = new Map<string, number>();
  const saidas = new Map<string, number>();
  // A seta que chega num atalho chega no localizador que ele representa (D-30).
  for (const e of q.edges) {
    const de = noEfetivo(q.nodes, e.source)?.id;
    const para = noEfetivo(q.nodes, e.target)?.id;
    if (de) saidas.set(de, (saidas.get(de) ?? 0) + 1);
    if (para) entradas.set(para, (entradas.get(para) ?? 0) + 1);
  }
  return { entradas, saidas };
}

function buscarLocalizadores(q: QuadroBusca, consulta: string, setoresCasados: Set<string>): ResultadoLocalizador[] {
  const { entradas, saidas } = contarPontas(q);
  const recolhidoDe = new Map<string, GrupoBusca>();
  for (const g of q.grupos) if (g.recolhido) for (const id of g.membros) recolhidoDe.set(id, g);
  const setorPorId = new Map(q.setores.map((s) => [s.id, s]));
  const vazia = !consulta.trim();

  const achados: Array<{ item: ResultadoLocalizador; nota: number; nome: string }> = [];
  for (const n of q.nodes) {
    if (ehAtalho(n) || !n.data.nome.trim()) continue;
    const pelaNome = pontuar(n.data.nome, consulta);
    // Achado pelo setor vem depois de qualquer achado pelo nome.
    const peloSetor = n.data.flags.some((f) => setoresCasados.has(f)) ? 3 : null;
    const nota = pelaNome ?? peloSetor;
    if (nota === null) continue;
    const grupo = recolhidoDe.get(n.id);
    achados.push({
      nome: n.data.nome,
      nota,
      item: {
        id: n.id,
        nome: n.data.nome,
        setores: n.data.flags.flatMap((f) => setorPorId.get(f) ?? []),
        entradas: entradas.get(n.id) ?? 0,
        saidas: saidas.get(n.id) ?? 0,
        ...(grupo ? { grupoRecolhido: { id: grupo.id, rotulo: grupo.rotulo } } : {}),
      },
    });
  }
  return porPontuacao(achados).slice(0, vazia ? LIMITE_LOCALIZADORES_VAZIO : LIMITE_LOCALIZADORES);
}

function buscarTransicoes(q: QuadroBusca, consulta: string): ResultadoTransicao[] {
  if (!consulta.trim()) return [];
  const achados: Array<{ item: ResultadoTransicao; nota: number; nome: string }> = [];
  for (const e of q.edges) {
    if (!e.data) continue;
    const resumo = e.data.resumo.trim();
    const recursos = e.data.subitems.map((s) => s.nome.trim()).filter(Boolean);
    const candidatos = [resumo, ...recursos].filter(Boolean);
    const notas = candidatos.map((c) => pontuar(c, consulta)).filter((x): x is number => x !== null);
    if (notas.length === 0) continue;
    const titulo = resumo || recursos[0] || '';
    const recursoCasado = pontuar(titulo, consulta) === null ? recursos.find((r) => pontuar(r, consulta) !== null) : undefined;
    achados.push({
      nome: titulo,
      nota: Math.min(...notas),
      item: {
        id: e.id,
        kind: e.data.kind,
        titulo,
        ...(recursoCasado ? { recursoCasado } : {}),
        origem: nomeEfetivo(q.nodes, e.source) || 'sem nome',
        destino: nomeEfetivo(q.nodes, e.target) || 'sem nome',
        source: e.source,
        target: e.target,
      },
    });
  }
  return porPontuacao(achados).slice(0, LIMITE_TRANSICOES);
}

export function buscarNoQuadro(q: QuadroBusca, consulta: string): ResultadosBusca {
  const vazia = !consulta.trim();
  const setores = vazia
    ? []
    : q.setores
        .filter((s) => pontuar(s.label, consulta) !== null || normalizar(s.code) === normalizar(consulta.trim()))
        .map((setor) => ({
          setor,
          total: q.nodes.filter((n) => !ehAtalho(n) && n.data.flags.includes(setor.id)).length,
        }));
  const casados = new Set(setores.map((s) => s.setor.id));
  return {
    localizadores: buscarLocalizadores(q, consulta, casados),
    transicoes: buscarTransicoes(q, consulta),
    setores,
  };
}
