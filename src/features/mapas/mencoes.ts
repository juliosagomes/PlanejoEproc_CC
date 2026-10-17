import {
  chaveMencaoAtp,
  chaveMencaoNome,
  type CatalogoUnidade,
  type DefinicaoFlag,
  type Plano,
  type RefMencao,
  type TipoMencao,
} from '@/domain';
import { detalhesAtp } from '@/features/checklist/detalhesAtp';
import { nomeDoNo } from './fluxoPapel';
import { esc } from './html';

/* ============================================================================
 * MENÇÕES (decisoes.md#D-39)
 *
 * O @ procura em tudo o que a unidade conhece: localizadores e preferências do
 * catálogo sincronizado e de todos os planos do silo, e as regras de ATP
 * desenhadas nos planos. As ATPs cadastradas no Eproc não são coletadas (fora
 * de escopo no CLAUDE.md), então a regra mencionável é o recurso da aresta.
 *
 * A menção grava só a referência (`RefMencao`); o texto visível é recalculado
 * contra este catálogo sempre que o mapa abre. É isso que a deixa "viva".
 * ========================================================================== */

export interface PlanoComId {
  id: string;
  plano: Plano;
}

export interface FontesMencao {
  planos: readonly PlanoComId[];
  unidade: CatalogoUnidade | null;
  setores: readonly DefinicaoFlag[];
}

interface UsoLocalizador {
  planoId: string;
  planoNome: string;
  noId: string;
  jaCriado: boolean;
  setor?: DefinicaoFlag;
  entradas: string[];
  saidas: string[];
}

interface InfoLoc {
  nome: string;
  eprocId?: string;
  naUnidade: boolean;
  sistema: boolean;
  descricao?: string;
  usos: UsoLocalizador[];
}

interface UsoPreferencia {
  planoNome: string;
  de: string;
  para: string;
  jaCriado: boolean;
  tipo?: string;
}

interface InfoPref {
  nome: string;
  eprocId?: string;
  naUnidade: boolean;
  tipo?: string;
  grupo?: string;
  /** Localizadores onde ela atua no Eproc (ações preferenciais sincronizadas). */
  atuaEm: string[];
  usos: UsoPreferencia[];
}

interface InfoAtp {
  nome: string;
  planoId: string;
  planoNome: string;
  de: string;
  para: string;
  jaCriado: boolean;
  linhas: { label: string; valor: string }[];
}

export interface ItemMencao {
  ref: RefMencao;
  nome: string;
  sub: string;
}

export interface CatalogoMencoes {
  itens: ItemMencao[];
  locs: Map<string, InfoLoc>;
  locPorEproc: Map<string, string>;
  prefs: Map<string, InfoPref>;
  prefPorEproc: Map<string, string>;
  atps: Map<string, InfoAtp>;
}

function obter<V>(m: Map<string, V>, chave: string, criar: () => V): V {
  let v = m.get(chave);
  if (!v) {
    v = criar();
    m.set(chave, v);
  }
  return v;
}

function lerUnidade(unidade: CatalogoUnidade | null, cat: CatalogoMencoes): void {
  if (!unidade) return;
  for (const l of unidade.localizadores) {
    const chave = chaveMencaoNome(l.nome);
    const info = obter(cat.locs, chave, () => ({ nome: l.nome, naUnidade: true, sistema: l.sistema, usos: [] }));
    info.naUnidade = true;
    info.sistema = l.sistema;
    if (l.descricao) info.descricao = l.descricao;
    if (l.eprocId) {
      info.eprocId = l.eprocId;
      cat.locPorEproc.set(l.eprocId, chave);
    }
  }
  for (const p of unidade.preferencias ?? []) {
    const chave = chaveMencaoNome(p.nome);
    const info = obter(cat.prefs, chave, () => ({ nome: p.nome, naUnidade: true, atuaEm: [], usos: [] }));
    info.naUnidade = true;
    if (p.detalhe) info.tipo = p.detalhe;
    if (p.grupo) info.grupo = p.grupo;
    if (p.eprocId) {
      info.eprocId = p.eprocId;
      cat.prefPorEproc.set(p.eprocId, chave);
    }
  }
  for (const a of unidade.acoesPreferenciais ?? []) {
    for (const nome of a.preferencias) {
      const info = obter(cat.prefs, chaveMencaoNome(nome), () => ({ nome, naUnidade: true, atuaEm: [], usos: [] }));
      if (!info.atuaEm.includes(a.localizador)) info.atuaEm.push(a.localizador);
    }
  }
}

function lerPlano({ id: planoId, plano }: PlanoComId, setores: readonly DefinicaoFlag[], cat: CatalogoMencoes): void {
  const nome = (id: string) => nomeDoNo(plano, id);
  for (const n of plano.nodes) {
    if (n.data.atalhoPara || !n.data.nome.trim()) continue;
    const info = obter(cat.locs, chaveMencaoNome(n.data.nome), () => ({
      nome: n.data.nome.trim(),
      naUnidade: false,
      sistema: !!n.data.sistema,
      usos: [],
    }));
    const setor = n.data.flags.map((f) => setores.find((s) => s.id === f)).find(Boolean);
    info.usos.push({
      planoId,
      planoNome: plano.planoNome,
      noId: n.id,
      jaCriado: n.data.ja_criado,
      ...(setor ? { setor } : {}),
      entradas: plano.edges.filter((e) => e.target === n.id).map((e) => nome(e.source)).filter(Boolean),
      saidas: plano.edges.filter((e) => e.source === n.id).map((e) => nome(e.target)).filter(Boolean),
    });
    for (const ap of n.data.acoesPreferenciais ?? []) {
      obter(cat.prefs, chaveMencaoNome(ap.nome), () => ({ nome: ap.nome, naUnidade: false, atuaEm: [], usos: [] }));
    }
  }
  for (const e of plano.edges) {
    const de = nome(e.source) || 'entrada por evento';
    const para = nome(e.target) || '—';
    for (const s of e.data.subitems) {
      if (s.categoria === 'Regra de ATP') {
        cat.atps.set(chaveMencaoAtp(planoId, e.id, s.id), {
          nome: s.nome.trim() || 'Regra de ATP sem nome',
          planoId,
          planoNome: plano.planoNome,
          de,
          para,
          jaCriado: s.ja_criado,
          linhas: s.atp ? detalhesAtp(s.atp) : [],
        });
      } else if (s.categoria === 'Preferência' && s.nome.trim()) {
        const info = obter(cat.prefs, chaveMencaoNome(s.nome), () => ({
          nome: s.nome.trim(),
          naUnidade: false,
          atuaEm: [],
          usos: [],
        }));
        info.usos.push({
          planoNome: plano.planoNome,
          de,
          para,
          jaCriado: s.ja_criado,
          ...(s.pref?.tipo ? { tipo: s.pref.tipo } : {}),
        });
        if (!info.tipo && s.pref?.tipo) info.tipo = s.pref.tipo;
      }
    }
  }
}

function itens(cat: CatalogoMencoes): ItemMencao[] {
  const out: ItemMencao[] = [];
  for (const [chave, l] of cat.locs) {
    const planos = [...new Set(l.usos.map((u) => u.planoNome))];
    const setor = l.usos.find((u) => u.setor)?.setor;
    const partes = [
      setor ? `${setor.code} · ${setor.label}` : '',
      planos.length ? `em ${planos.slice(0, 2).join(', ')}${planos.length > 2 ? ` e mais ${planos.length - 2}` : ''}` : 'fora dos planos',
    ].filter(Boolean);
    out.push({ ref: refDe('loc', chave, l.nome, l.eprocId), nome: l.nome, sub: partes.join(' · ') });
  }
  for (const [chave, p] of cat.prefs) {
    const partes = [p.tipo ?? 'Preferência', p.grupo ? `grupo ${p.grupo}` : '', p.naUnidade ? 'na unidade' : 'só nos planos'];
    out.push({ ref: refDe('pref', chave, p.nome, p.eprocId), nome: p.nome, sub: partes.filter(Boolean).join(' · ') });
  }
  for (const [chave, a] of cat.atps) {
    out.push({ ref: refDe('atp', chave, a.nome), nome: a.nome, sub: `${a.planoNome} · ${a.de} → ${a.para}` });
  }
  return out;
}

function refDe(tipo: TipoMencao, chave: string, rotulo: string, eprocId?: string): RefMencao {
  return { tipo, chave, rotulo, ...(eprocId ? { eprocId } : {}) };
}

export function montarCatalogo(fontes: FontesMencao): CatalogoMencoes {
  const cat: CatalogoMencoes = {
    itens: [],
    locs: new Map(),
    locPorEproc: new Map(),
    prefs: new Map(),
    prefPorEproc: new Map(),
    atps: new Map(),
  };
  lerUnidade(fontes.unidade, cat);
  for (const p of fontes.planos) lerPlano(p, fontes.setores, cat);
  cat.itens = itens(cat);
  return cat;
}

/* ---------------------------------------------------------------------------
 * Busca
 * ------------------------------------------------------------------------- */

const semAcento = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

function pontuar(texto: string, q: string): number {
  if (!q) return 1;
  const t = semAcento(texto);
  if (t.startsWith(q)) return 3;
  if (t.split(/[\s\-[\]—·/()]+/).some((w) => w.startsWith(q))) return 2;
  return t.includes(q) ? 1 : 0;
}

export type FiltroMencao = TipoMencao | 'todos';

export const ORDEM_TIPOS: readonly TipoMencao[] = ['loc', 'pref', 'atp'];

/** Agrupado por tipo, melhores primeiro; `limite` por grupo. */
export function buscarMencoes(
  cat: CatalogoMencoes,
  consulta: string,
  filtro: FiltroMencao,
  limite: number,
): ItemMencao[] {
  const q = semAcento(consulta.trim());
  const out: ItemMencao[] = [];
  for (const tipo of ORDEM_TIPOS) {
    if (filtro !== 'todos' && filtro !== tipo) continue;
    out.push(
      ...cat.itens
        .filter((i) => i.ref.tipo === tipo)
        .map((i) => ({ i, p: Math.max(pontuar(i.nome, q), pontuar(i.sub, q) > 1 ? 1 : 0) }))
        .filter((x) => x.p > 0)
        .sort((a, b) => b.p - a.p || a.i.nome.localeCompare(b.i.nome, 'pt-BR'))
        .slice(0, limite)
        .map((x) => x.i),
    );
  }
  return out;
}

/* ---------------------------------------------------------------------------
 * Resolução e detalhe
 * ------------------------------------------------------------------------- */

export type Resolvida =
  | { tipo: 'loc'; nome: string; info: InfoLoc }
  | { tipo: 'pref'; nome: string; info: InfoPref }
  | { tipo: 'atp'; nome: string; info: InfoAtp };

/**
 * O alvo atual da menção, ou `null` se sumiu. O `eprocId` vem antes do nome:
 * é ele que acompanha uma renomeação feita no Eproc.
 */
export function resolver(ref: RefMencao, cat: CatalogoMencoes): Resolvida | null {
  if (ref.tipo === 'atp') {
    const info = cat.atps.get(ref.chave);
    return info ? { tipo: 'atp', nome: info.nome, info } : null;
  }
  if (ref.tipo === 'loc') {
    const chave = (ref.eprocId && cat.locPorEproc.get(ref.eprocId)) || ref.chave;
    const info = cat.locs.get(chave);
    return info ? { tipo: 'loc', nome: info.nome, info } : null;
  }
  const chave = (ref.eprocId && cat.prefPorEproc.get(ref.eprocId)) || ref.chave;
  const info = cat.prefs.get(chave);
  return info ? { tipo: 'pref', nome: info.nome, info } : null;
}

/** Uma linha do detalhe. O valor é texto ou uma lista de outras menções. */
export interface LinhaDetalhe {
  label: string;
  valor: string | RefMencao[];
}

export interface DetalheMencao {
  titulo: string;
  linhas: LinhaDetalhe[];
}

const refLoc = (nome: string): RefMencao => refDe('loc', chaveMencaoNome(nome), nome);
const unicos = (xs: string[]) => [...new Set(xs)];

export function detalhar(r: Resolvida): DetalheMencao {
  if (r.tipo === 'loc') {
    const { info } = r;
    const setores = unicos(info.usos.flatMap((u) => (u.setor ? [`${u.setor.code} · ${u.setor.label}`] : [])));
    const jaCriado = info.naUnidade || info.usos.some((u) => u.jaCriado);
    const linhas: LinhaDetalhe[] = [
      ...(setores.length ? [{ label: 'Setor', valor: setores.join(', ') }] : []),
      { label: 'No Eproc', valor: info.sistema ? 'Localizador do sistema' : jaCriado ? 'Já existe' : 'A criar' },
      ...(info.descricao ? [{ label: 'Descrição', valor: info.descricao }] : []),
      { label: 'Planos', valor: unicos(info.usos.map((u) => u.planoNome)).join(', ') || 'Nenhum' },
    ];
    const entradas = unicos(info.usos.flatMap((u) => u.entradas));
    const saidas = unicos(info.usos.flatMap((u) => u.saidas));
    if (entradas.length) linhas.push({ label: 'Chega de', valor: entradas.map(refLoc) });
    if (saidas.length) linhas.push({ label: 'Sai para', valor: saidas.map(refLoc) });
    return { titulo: info.nome, linhas };
  }
  if (r.tipo === 'pref') {
    const { info } = r;
    const linhas: LinhaDetalhe[] = [
      { label: 'Tipo', valor: info.tipo ?? '—' },
      ...(info.grupo ? [{ label: 'Grupo', valor: info.grupo }] : []),
      { label: 'No Eproc', valor: info.naUnidade ? 'Existe na unidade' : 'Só nos planos' },
    ];
    if (info.atuaEm.length) linhas.push({ label: 'Atua em', valor: info.atuaEm.map(refLoc) });
    const leva = unicos(info.usos.map((u) => u.para));
    if (leva.length) linhas.push({ label: 'Leva para', valor: leva.map(refLoc) });
    return { titulo: info.nome, linhas };
  }
  const { info } = r;
  return {
    titulo: info.nome,
    linhas: [
      { label: 'Plano', valor: info.planoNome },
      { label: 'De', valor: [refLoc(info.de)] },
      { label: 'Para', valor: [refLoc(info.para)] },
      ...info.linhas.map((l) => ({ label: l.label, valor: l.valor })),
      { label: 'No Eproc', valor: info.jaCriado ? 'Já criada' : 'A criar' },
    ],
  };
}

/* ---------------------------------------------------------------------------
 * HTML
 * ------------------------------------------------------------------------- */

/** O `<span>` de uma menção. `contenteditable=false` faz dela um bloco só para o cursor. */
export function htmlMencao(ref: RefMencao, nome = ref.rotulo): string {
  const id = ref.eprocId ? ` data-eproc-id="${esc(ref.eprocId)}"` : '';
  return `<span class="mencao m-${ref.tipo}" contenteditable="false" data-tipo="${ref.tipo}" data-chave="${esc(ref.chave)}" data-rotulo="${esc(ref.rotulo)}"${id}>${esc(nome)}</span>`;
}

const TIPOS = new Set<string>(['loc', 'pref', 'atp']);

export function lerRef(el: Element): RefMencao | null {
  const tipo = el.getAttribute('data-tipo');
  const chave = el.getAttribute('data-chave');
  if (!tipo || !TIPOS.has(tipo) || !chave) return null;
  const eprocId = el.getAttribute('data-eproc-id');
  return refDe(tipo as TipoMencao, chave, el.getAttribute('data-rotulo') ?? chave, eprocId ?? undefined);
}

/**
 * Recalcula o texto das menções de `raiz` contra o catálogo. O alvo que sumiu
 * fica riscado e mostra o último nome conhecido. Devolve quantas mudaram.
 */
export function atualizarMencoes(raiz: ParentNode, cat: CatalogoMencoes): number {
  let mudou = 0;
  raiz.querySelectorAll('.mencao').forEach((el) => {
    const ref = lerRef(el);
    if (!ref) return;
    const r = resolver(ref, cat);
    el.classList.toggle('sumiu', r === null);
    el.setAttribute('title', r === null ? 'Não existe mais na unidade nem nos planos' : '');
    const texto = r ? r.nome : ref.rotulo;
    if (r && r.nome !== ref.rotulo) el.setAttribute('data-rotulo', r.nome);
    if (el.textContent !== texto) {
      el.textContent = texto;
      mudou++;
    }
  });
  return mudou;
}

export function htmlDetalhe(ref: RefMencao, cat: CatalogoMencoes): string {
  const r = resolver(ref, cat);
  if (!r) return '';
  const d = detalhar(r);
  const valor = (v: LinhaDetalhe['valor']) =>
    typeof v === 'string' ? esc(v).replace(/\n/g, '<br>') : v.map((x) => htmlMencao(x)).join(' ');
  const titulo = r.tipo === 'atp' ? `Regra de ATP ${htmlMencao(ref, r.nome)}` : htmlMencao(ref, r.nome);
  return `<div class="detalhe-mencao"><div class="dm-tit">${titulo}</div><dl>${d.linhas.map((l) => `<dt>${esc(l.label)}</dt><dd>${valor(l.valor)}</dd>`).join('')}</dl></div>`;
}

