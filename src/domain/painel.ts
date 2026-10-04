import { TELAS_CONSULTA, type TelaConsulta } from './catalogoUnidade';
import type { Plano } from './plano';
import { normalizarRotulo } from './setores';

/**
 * Painel da unidade (decisoes.md#D-33): como o trabalho do dia a dia chega a
 * cada setor.
 *
 * O setor trabalha a partir de **filas de trabalho** — o que ele abre no Eproc
 * para saber o que fazer: uma consulta salva numa das três telas de relatório
 * (decisoes.md#D-37). O painel planeja essas filas e confere a **cobertura**:
 * todo localizador do setor está em alguma fila, ou foi deixado de fora com
 * motivo.
 *
 * Tudo aqui é da **unidade**, como os setores (D-26): uma chave por silo, que
 * vale para todos os planos.
 */
export const PAINEL_VERSION = 1 as const;

export type PainelVersion = typeof PAINEL_VERSION;

/** As telas do Eproc onde uma fila mora (decisoes.md#D-37). */
export type TelaFila = Exclude<TelaConsulta, 'semMovimentacao'>;

/**
 * Origens de antes, que o Eproc não tem como fila: a "preferência de consulta"
 * era a preferência da Movimentação Processual, que lança evento, e "Processos
 * sem Movimentação" não é tela de trabalho. Continuam aceitas para a fila
 * gravada abrir; o painel pede que se escolha a tela certa.
 */
export type OrigemLegada = 'preferencia' | 'semMovimentacao';

/** Onde a fila mora no Eproc. */
export type OrigemFila = TelaFila | OrigemLegada;

export const ORIGENS_FILA: Record<OrigemFila, string> = {
  ...TELAS_CONSULTA,
  preferencia: 'Preferência de consulta',
};

/** As origens que a fila nova oferece, na ordem do menu de quem trabalha. */
export const ORIGENS_FILA_NOVA: readonly TelaFila[] = [
  'relatorioGeral',
  'areaMinutas',
  'processosPorLocalizador',
];

export function ehTelaFila(origem: string): origem is TelaFila {
  return (ORIGENS_FILA_NOVA as readonly string[]).includes(origem);
}

export interface FilaTrabalho {
  id: string;
  /** Como aparece no Eproc. */
  nome: string;
  origem: OrigemFila;
  setorId: string;
  /**
   * Grupo de preferências. No Eproc toda consulta salva das três telas pode
   * estar num grupo (decisoes.md#D-37).
   */
  grupoId?: string;
  /**
   * Nomes dos localizadores que a fila olha, como aparecem nos planos. Por nome,
   * e não por id de nó, porque a fila é da unidade e o nó é de um plano: o mesmo
   * localizador existe em vários planos, com ids diferentes.
   */
  localizadores: string[];
  /** Marcado quando a fila já existe no Eproc. */
  ja_criado: boolean;
}

/**
 * Grupo de preferências do Eproc, reduzido ao que o painel planeja: um nome. O
 * Eproc agrupa preferências de qualquer tipo; o painel usa os grupos para as
 * filas. Os nomes que a sincronização traz entram como sugestão (D-37).
 */
export interface GrupoPreferencias {
  id: string;
  nome: string;
}

/** Localizador que nenhuma fila olha, de propósito. */
export interface LocalizadorForaDasFilas {
  nome: string;
  motivo: string;
}

export interface PainelUnidade {
  version: PainelVersion;
  filas: FilaTrabalho[];
  grupos: GrupoPreferencias[];
  foraDasFilas: LocalizadorForaDasFilas[];
}

export function painelVazio(): PainelUnidade {
  return { version: PAINEL_VERSION, filas: [], grupos: [], foraDasFilas: [] };
}

/** "Cumprir Despacho" e "cumprir  despacho" são o mesmo localizador. */
export const chaveLocalizador = normalizarRotulo;

/** Um localizador da unidade, visto através de todos os planos. */
export interface LocalizadorDaUnidade {
  /** Como aparece no primeiro plano que o traz. */
  nome: string;
  chave: string;
  /** União das marcações de setor em todos os planos. */
  setores: string[];
}

/**
 * Os localizadores de todos os planos, um por nome. Atalhos (D-30) e nós sem
 * nome ficam de fora: o atalho é o mesmo localizador de outro nó, e o nó sem
 * nome ainda não é localizador nenhum.
 */
export function localizadoresDaUnidade(
  planos: readonly Pick<Plano, 'nodes'>[],
): LocalizadorDaUnidade[] {
  const porChave = new Map<string, { nome: string; chave: string; setores: Set<string> }>();
  for (const plano of planos) {
    for (const node of plano.nodes) {
      if (node.data.atalhoPara) continue;
      const nome = node.data.nome.trim();
      if (!nome) continue;
      const chave = chaveLocalizador(nome);
      const atual = porChave.get(chave);
      if (atual) node.data.flags.forEach((f) => atual.setores.add(f));
      else porChave.set(chave, { nome, chave, setores: new Set(node.data.flags) });
    }
  }
  return [...porChave.values()]
    .map((l) => ({ nome: l.nome, chave: l.chave, setores: [...l.setores] }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** `null` é "sem setor": os localizadores que ninguém marcou. */
export type RecorteSetor = string | null;

export function localizadoresDoSetor(
  locs: readonly LocalizadorDaUnidade[],
  setorId: RecorteSetor,
  setoresConhecidos: ReadonlySet<string>,
): LocalizadorDaUnidade[] {
  return setorId === null
    ? locs.filter((l) => !l.setores.some((s) => setoresConhecidos.has(s)))
    : locs.filter((l) => l.setores.includes(setorId));
}

export function filaOlha(fila: FilaTrabalho, chave: string): boolean {
  return fila.localizadores.some((n) => chaveLocalizador(n) === chave);
}

export type Situacao =
  /** `filas` são as do setor; `outras`, as de outros setores que também o olham. */
  | { tipo: 'coberto'; filas: FilaTrabalho[]; outras: FilaTrabalho[] }
  /** Só filas de outro setor olham para ele. */
  | { tipo: 'outroSetor'; filas: FilaTrabalho[] }
  | { tipo: 'fora'; motivo: string }
  | { tipo: 'descoberto' };

export function motivoFora(painel: PainelUnidade, chave: string): string | undefined {
  return painel.foraDasFilas.find((f) => chaveLocalizador(f.nome) === chave)?.motivo;
}

/**
 * A situação de um localizador visto de um setor. "Fora de propósito" vence
 * tudo: é a decisão explícita da unidade, mesmo que alguma fila ainda o olhe.
 */
export function situacaoNoSetor(
  loc: LocalizadorDaUnidade,
  setorId: RecorteSetor,
  painel: PainelUnidade,
): Situacao {
  const motivo = motivoFora(painel, loc.chave);
  if (motivo !== undefined) return { tipo: 'fora', motivo };
  const todas = painel.filas.filter((f) => filaOlha(f, loc.chave));
  if (todas.length === 0) return { tipo: 'descoberto' };
  if (setorId === null) return { tipo: 'coberto', filas: todas, outras: [] };
  const doSetor = todas.filter((f) => f.setorId === setorId);
  if (doSetor.length === 0) return { tipo: 'outroSetor', filas: todas };
  return { tipo: 'coberto', filas: doSetor, outras: todas.filter((f) => f.setorId !== setorId) };
}

export interface Cobertura {
  total: number;
  cobertos: number;
  fora: number;
  descobertos: number;
}

/** "Coberto só por fila de outro setor" conta como coberto: o processo é visto. */
export function contarCobertura(
  locs: readonly LocalizadorDaUnidade[],
  setorId: RecorteSetor,
  painel: PainelUnidade,
): Cobertura {
  const c: Cobertura = { total: locs.length, cobertos: 0, fora: 0, descobertos: 0 };
  for (const loc of locs) {
    const { tipo } = situacaoNoSetor(loc, setorId, painel);
    if (tipo === 'fora') c.fora++;
    else if (tipo === 'descoberto') c.descobertos++;
    else c.cobertos++;
  }
  return c;
}
