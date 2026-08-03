import type { Permissao } from '@/domain';
import { findEntradaPorLocal } from './syncMap';

/* ============================================================================
 * LOTAÇÕES CONHECIDAS + TOMBSTONES
 *
 * Duas responsabilidades, ambas globais ao navegador (fora do silo de planos,
 * mesmo padrão do catálogo do órgão — decisoes.md#D-7):
 *
 * 1. Lotações conhecidas: as que já foram abertas neste navegador, com o
 *    código guardado, para a tela de login oferecer reentrada em um clique.
 * 2. Tombstones: `remotoId`s de planos que o usuário excluiu dentro de uma
 *    lotação e que ainda precisam ser removidos do servidor no próximo push.
 *
 * Sobre guardar o código em claro: ele é um bearer-token (decisoes.md#D-8) e
 * fica legível para qualquer script rodando na página. É o preço de não
 * redigitar o código toda vez — decisão registrada em decisoes.md#D-9.
 * ========================================================================== */

export interface LotacaoConhecida {
  workspaceId: string;
  nome: string;
  /** Último código usado para entrar — de leitura ou de edição. */
  codigo: string;
  permissao: Permissao;
  ultimoAcesso: string;
}

const LOTACOES_KEY = 'planejoeproc:lotacoes';
const TOMBSTONES_KEY_PREFIX = 'planejoeproc:lot:';

function tombstonesKey(workspaceId: string): string {
  return `${TOMBSTONES_KEY_PREFIX}${workspaceId}:tombstones`;
}

function getStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const probe = '__planejoeproc_probe_lot__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}

function readList<T>(key: string): T[] {
  const storage = getStorage();
  if (!storage) return [];
  const raw = storage.getItem(key);
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeList<T>(key: string, lista: T[]): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(lista));
  } catch (err) {
    console.warn(`[sync] Falha ao gravar ${key}.`, err);
  }
}

/* ============================================================================
 * Lotações
 * ========================================================================== */

/** Ordenadas da mais recentemente acessada para a mais antiga. */
export function listLotacoes(): LotacaoConhecida[] {
  return readList<LotacaoConhecida>(LOTACOES_KEY).sort((a, b) =>
    b.ultimoAcesso.localeCompare(a.ultimoAcesso),
  );
}

export function findLotacao(workspaceId: string): LotacaoConhecida | undefined {
  return listLotacoes().find((l) => l.workspaceId === workspaceId);
}

/**
 * Upsert por `workspaceId`. Entrar com o código de edição numa lotação já
 * conhecida por leitura promove a permissão — mesmo silo, sem duplicar a
 * entrada. O caminho inverso (entrar por leitura numa que já se conhece por
 * edição) preserva a permissão maior: perder o código de edição guardado só
 * porque desta vez o usuário colou o de leitura seria uma regressão silenciosa.
 */
export function registrarLotacao(lotacao: LotacaoConhecida): void {
  const anterior = findLotacao(lotacao.workspaceId);
  const manterEdicao =
    anterior?.permissao === 'edicao' && lotacao.permissao === 'leitura';

  const entrada: LotacaoConhecida = manterEdicao
    ? { ...anterior, nome: lotacao.nome, ultimoAcesso: lotacao.ultimoAcesso }
    : lotacao;

  const resto = listLotacoes().filter((l) => l.workspaceId !== lotacao.workspaceId);
  writeList(LOTACOES_KEY, [...resto, entrada]);
}

/** Remove a lotação da lista de recentes. Não apaga os planos do silo. */
export function esquecerLotacao(workspaceId: string): void {
  writeList(
    LOTACOES_KEY,
    listLotacoes().filter((l) => l.workspaceId !== workspaceId),
  );
}

/* ============================================================================
 * Tombstones
 * ========================================================================== */

export function listTombstones(workspaceId: string): string[] {
  return readList<string>(tombstonesKey(workspaceId));
}

export function registrarTombstone(workspaceId: string, remotoId: string): void {
  const atuais = listTombstones(workspaceId);
  if (atuais.includes(remotoId)) return;
  writeList(tombstonesKey(workspaceId), [...atuais, remotoId]);
}

export function limparTombstones(workspaceId: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(tombstonesKey(workspaceId));
  } catch (err) {
    console.warn('[sync] Falha ao limpar tombstones.', err);
  }
}

/**
 * Marca a exclusão de um plano local para propagar no próximo push. No-op se
 * o plano nunca foi publicado (sem `remotoId` mapeado) — não há nada a
 * remover do servidor.
 */
export function registrarExclusaoLocal(workspaceId: string, localId: string): void {
  const entrada = findEntradaPorLocal(localId);
  if (!entrada) return;
  registrarTombstone(workspaceId, entrada.remotoId);
}
