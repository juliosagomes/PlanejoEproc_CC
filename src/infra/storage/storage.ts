import { SCHEMA_VERSION, type Plano } from '@/domain';
import { PlanoSchema, PlansIndexSchema } from './schema';

/* ============================================================================
 * Chaves do localStorage
 *
 * Estrutura multi-plano:
 *  - INDEX_KEY    → array de metadados (id, nome, atualizadoEm) leve.
 *  - ACTIVE_KEY   → id do plano ativo (o que abre por padrão).
 *  - PLAN_KEY_PREFIX + id → payload completo de cada plano.
 *
 * A chave LEGACY_KEY é o formato antigo (single-plano). Mantemos como rede
 * de segurança por uma versão: a primeira execução pós-migração lê dela só
 * se o índice estiver ausente, importa para o novo formato e a deixa intacta.
 * ========================================================================== */

export const LEGACY_KEY = 'planejoeproc:plano';
export const INDEX_KEY = 'planejoeproc:plans:index';
export const ACTIVE_KEY = 'planejoeproc:plans:active';
export const PLAN_KEY_PREFIX = 'planejoeproc:plan:';

/**
 * Prefixo de chave para backups de dados que não puderam ser carregados
 * (JSON inválido ou shape irreconhecível). Sufixo é YYYY-MM-DD da falha.
 * Se duas falhas ocorrerem no mesmo dia, a segunda sobrescreve a primeira —
 * aceitável em beta.
 */
export const BACKUP_KEY_PREFIX = 'planejoeproc:plano:corrompido:';

export interface PlanIndexEntry {
  id: string;
  nome: string;
  /** ISO 8601 UTC. Usado para ordenar planos por uso recente na UI. */
  atualizadoEm: string;
}

export type PlansIndex = PlanIndexEntry[];

export function getPlanKey(id: string): string {
  return PLAN_KEY_PREFIX + id;
}

/** Conveniência para testes/UI: chave do plano ativo, ou null se não há ativo. */
export function getActivePlanKey(): string | null {
  const id = getAtivoId();
  return id === null ? null : getPlanKey(id);
}

export function planoVazio(): Plano {
  return {
    version: SCHEMA_VERSION,
    planoNome: 'Plano sem título',
    flowMode: 'organic',
    nodes: [],
    edges: [],
  };
}

/**
 * `localStorage` pode estar indisponível em alguns contextos (modo privado
 * estrito, iframe sem permissão, ambientes server-side). Detectamos com uma
 * gravação de teste em vez de só verificar `typeof`.
 */
function getStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const probe = '__planejoeproc_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback para ambientes sem WebCrypto (jsdom velho, runtimes exóticos).
  return 'p-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function moveToBackup(storage: Storage, sourceKey: string, raw: string): void {
  const backupKey = `${BACKUP_KEY_PREFIX}${todayIso()}`;
  try {
    storage.setItem(backupKey, raw);
  } catch {
    // Quota cheia ou outro erro: melhor logar e perder o backup do que travar.
    console.warn('[storage] Não foi possível salvar backup em', backupKey);
  }
  try {
    storage.removeItem(sourceKey);
  } catch {
    // ignore
  }
}

/* ============================================================================
 * Índice
 * ========================================================================== */

function readIndex(storage: Storage): PlansIndex {
  const raw = storage.getItem(INDEX_KEY);
  if (raw === null) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.warn('[storage] Índice de planos corrompido (JSON); movendo para backup.', err);
    moveToBackup(storage, INDEX_KEY, raw);
    return [];
  }

  const result = PlansIndexSchema.safeParse(parsed);
  if (!result.success) {
    console.warn(
      '[storage] Índice de planos com shape inválido; movendo para backup.',
      result.error.issues,
    );
    moveToBackup(storage, INDEX_KEY, raw);
    return [];
  }
  return result.data;
}

function writeIndex(storage: Storage, index: PlansIndex): void {
  try {
    storage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch (err) {
    console.warn('[storage] Falha ao gravar índice de planos (quota?).', err);
  }
}

/* ============================================================================
 * Migração one-shot
 *
 * Idempotente: só roda quando o índice multi-plano ainda não existe E a chave
 * legada tem um plano válido. Cria a primeira entrada do índice, marca como
 * ativo e mantém a chave legada (rede de segurança por uma versão).
 * ========================================================================== */

function migrarSeNecessario(storage: Storage): void {
  if (storage.getItem(INDEX_KEY) !== null) return;
  const legacyRaw = storage.getItem(LEGACY_KEY);
  if (legacyRaw === null) return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(legacyRaw);
  } catch {
    // Legado corrompido — nada a migrar; não removemos para preservar evidência.
    return;
  }
  const result = PlanoSchema.safeParse(parsed);
  if (!result.success) return;

  const id = newId();
  const plano = result.data;
  const entry: PlanIndexEntry = {
    id,
    nome: plano.planoNome.trim() || 'Plano migrado',
    atualizadoEm: nowIso(),
  };

  try {
    storage.setItem(getPlanKey(id), JSON.stringify(plano));
    writeIndex(storage, [entry]);
    storage.setItem(ACTIVE_KEY, id);
  } catch (err) {
    console.warn('[storage] Falha ao migrar plano legado.', err);
  }
}

/* ============================================================================
 * API pública
 * ========================================================================== */

export function listPlanos(): PlansIndex {
  const storage = getStorage();
  if (!storage) return [];
  migrarSeNecessario(storage);
  return readIndex(storage);
}

export function getAtivoId(): string | null {
  const storage = getStorage();
  if (!storage) return null;
  migrarSeNecessario(storage);
  return storage.getItem(ACTIVE_KEY);
}

export function setAtivo(id: string): void {
  const storage = getStorage();
  if (!storage) return;
  const index = readIndex(storage);
  if (!index.some((e) => e.id === id)) {
    console.warn('[storage] setAtivo: id não encontrado no índice', id);
    return;
  }
  try {
    storage.setItem(ACTIVE_KEY, id);
  } catch (err) {
    console.warn('[storage] Falha ao gravar ativo.', err);
  }
}

/**
 * Carrega um plano. Sem argumento, carrega o ativo; se não há ativo (boot
 * fresco ou todos excluídos), retorna plano vazio sem efeitos colaterais.
 *
 * Casos cobertos:
 *  - localStorage indisponível ou nada salvo → plano vazio.
 *  - JSON inválido → backup em chave -corrompido- + plano vazio.
 *  - Shape inválido (não passa no Zod) → backup + plano vazio.
 *  - Plano v1 válido → retorna o plano.
 *
 * Sempre retorna um Plano. Nunca lança.
 */
export function loadPlano(id?: string): Plano {
  const storage = getStorage();
  if (!storage) return planoVazio();
  migrarSeNecessario(storage);

  const targetId = id ?? storage.getItem(ACTIVE_KEY);
  if (targetId === null) return planoVazio();

  const key = getPlanKey(targetId);
  const raw = storage.getItem(key);
  if (raw === null) return planoVazio();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.warn(`[storage] JSON inválido em ${key}; movendo para backup.`, err);
    moveToBackup(storage, key, raw);
    return planoVazio();
  }

  const result = PlanoSchema.safeParse(parsed);
  if (!result.success) {
    console.warn(
      `[storage] Shape de plano irreconhecível em ${key}; movendo para backup.`,
      result.error.issues,
    );
    moveToBackup(storage, key, raw);
    return planoVazio();
  }
  return result.data;
}

/**
 * Persiste o plano no slot ativo. Se não houver ativo registrado (primeiro
 * save após boot fresco), cria a entrada lazily — gera id, adiciona ao índice
 * e marca como ativo. Falhas (quota, storage indisponível) são logadas mas
 * não propagadas — o usuário continua trabalhando em memória.
 *
 * O nome do plano no índice é sincronizado com `plano.planoNome` a cada save,
 * de modo que renomes feitos pelo input do header se refletem no switcher.
 */
export function savePlano(plano: Plano): void {
  const storage = getStorage();
  if (!storage) return;

  let id = storage.getItem(ACTIVE_KEY);
  let index = readIndex(storage);
  const nomeFinal = plano.planoNome || 'Plano sem título';

  if (id === null || !index.some((e) => e.id === id)) {
    id = newId();
    index = [...index, { id, nome: nomeFinal, atualizadoEm: nowIso() }];
    try {
      storage.setItem(ACTIVE_KEY, id);
    } catch (err) {
      console.warn('[storage] Falha ao gravar ativo.', err);
      return;
    }
  } else {
    index = index.map((e) =>
      e.id === id ? { ...e, nome: nomeFinal, atualizadoEm: nowIso() } : e,
    );
  }

  try {
    storage.setItem(getPlanKey(id), JSON.stringify(plano));
    writeIndex(storage, index);
  } catch (err) {
    console.warn('[storage] Falha ao salvar plano (quota?).', err);
  }
}

/**
 * Cria um novo plano vazio (com nome opcional), adiciona ao índice e marca
 * como ativo. Retorna o id e o payload já gerados.
 */
export function criarPlano(nome?: string): { id: string; plano: Plano } {
  const id = newId();
  const plano: Plano = { ...planoVazio(), planoNome: nome ?? 'Plano sem título' };

  const storage = getStorage();
  if (!storage) return { id, plano };

  const entry: PlanIndexEntry = {
    id,
    nome: plano.planoNome,
    atualizadoEm: nowIso(),
  };
  const index = readIndex(storage);
  try {
    storage.setItem(getPlanKey(id), JSON.stringify(plano));
    writeIndex(storage, [...index, entry]);
    storage.setItem(ACTIVE_KEY, id);
  } catch (err) {
    console.warn('[storage] Falha ao criar plano.', err);
  }
  return { id, plano };
}

/**
 * Importa um plano já validado (típico fluxo "Abrir de arquivo…"): gera id
 * novo, registra no índice e ativa. O caller é responsável por validar o
 * shape com `PlanoSchema` antes de chamar.
 */
export function importarPlano(plano: Plano): { id: string } {
  const id = newId();
  const storage = getStorage();
  if (!storage) return { id };

  const entry: PlanIndexEntry = {
    id,
    nome: plano.planoNome.trim() || 'Plano importado',
    atualizadoEm: nowIso(),
  };
  const index = readIndex(storage);
  try {
    storage.setItem(getPlanKey(id), JSON.stringify(plano));
    writeIndex(storage, [...index, entry]);
    storage.setItem(ACTIVE_KEY, id);
  } catch (err) {
    console.warn('[storage] Falha ao importar plano.', err);
  }
  return { id };
}

/**
 * Duplica um plano existente: copia o payload, renomeia para "Cópia de…",
 * registra com novo id e ativa. Retorna null se o id de origem não existe.
 */
export function duplicarPlano(id: string): { id: string } | null {
  const storage = getStorage();
  if (!storage) return null;

  const index = readIndex(storage);
  const entry = index.find((e) => e.id === id);
  if (!entry) return null;

  const original = loadPlano(id);
  const novoId = newId();
  const novoPlano: Plano = {
    ...original,
    planoNome: `Cópia de ${original.planoNome}`,
  };
  const novaEntry: PlanIndexEntry = {
    id: novoId,
    nome: novoPlano.planoNome,
    atualizadoEm: nowIso(),
  };

  try {
    storage.setItem(getPlanKey(novoId), JSON.stringify(novoPlano));
    writeIndex(storage, [...index, novaEntry]);
    storage.setItem(ACTIVE_KEY, novoId);
  } catch (err) {
    console.warn('[storage] Falha ao duplicar plano.', err);
    return null;
  }
  return { id: novoId };
}

/**
 * Renomeia um plano. Atualiza tanto o `nome` no índice quanto o `planoNome`
 * dentro do payload, mantendo as duas representações sincronizadas. No-op
 * silencioso se o id não existe.
 */
export function renomearPlano(id: string, nome: string): void {
  const storage = getStorage();
  if (!storage) return;
  const index = readIndex(storage);
  const entry = index.find((e) => e.id === id);
  if (!entry) return;

  const nomeFinal = nome.trim() || 'Plano sem título';
  const novoIndex = index.map((e) =>
    e.id === id ? { ...e, nome: nomeFinal, atualizadoEm: nowIso() } : e,
  );

  const raw = storage.getItem(getPlanKey(id));
  if (raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw);
      const result = PlanoSchema.safeParse(parsed);
      if (result.success) {
        const atualizado: Plano = { ...result.data, planoNome: nomeFinal };
        storage.setItem(getPlanKey(id), JSON.stringify(atualizado));
      }
    } catch {
      // Payload corrompido — sincronizamos só o índice; loadPlano lidará na
      // próxima leitura e mandará o original para backup.
    }
  }

  writeIndex(storage, novoIndex);
}

/**
 * Remove o plano. Se for o ativo, o próximo ativo é o mais recente do que
 * sobrou (por `atualizadoEm`); se a lista ficar vazia, ACTIVE_KEY é apagado.
 */
export function excluirPlano(id: string): void {
  const storage = getStorage();
  if (!storage) return;

  const index = readIndex(storage);
  const novoIndex = index.filter((e) => e.id !== id);

  try {
    storage.removeItem(getPlanKey(id));
    writeIndex(storage, novoIndex);

    if (storage.getItem(ACTIVE_KEY) === id) {
      const proximo = [...novoIndex].sort((a, b) =>
        b.atualizadoEm.localeCompare(a.atualizadoEm),
      )[0];
      if (proximo) {
        storage.setItem(ACTIVE_KEY, proximo.id);
      } else {
        storage.removeItem(ACTIVE_KEY);
      }
    }
  } catch (err) {
    console.warn('[storage] Falha ao excluir plano.', err);
  }
}

/* ============================================================================
 * Debounced saver
 *
 * Mantém a assinatura antiga — o caller só passa o `Plano`. Internamente,
 * `savePlano` resolve o id ativo (criando lazily se preciso).
 * ========================================================================== */

export interface DebouncedSaver {
  /** Agenda um save com o plano fornecido, substituindo qualquer pendente. */
  (plano: Plano): void;
  /** Escreve imediatamente o plano pendente (se houver) e cancela o timer. */
  flush(): void;
  /** Descarta o plano pendente sem escrever. */
  cancel(): void;
}

/**
 * Cria um saver com debounce: chamadas próximas (< delayMs) coalescem em
 * uma única gravação no final do intervalo. `flush()` força a gravação
 * imediatamente; `cancel()` descarta sem escrever.
 *
 * Default 300ms — equilibra responsividade percebida e número de gravações
 * durante drag/edição contínuos.
 */
export function criarSavePlanoDebounced(delayMs = 300): DebouncedSaver {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let pending: Plano | null = null;

  const debounced = ((plano: Plano) => {
    pending = plano;
    if (timeoutId !== null) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      timeoutId = null;
      if (pending) {
        savePlano(pending);
        pending = null;
      }
    }, delayMs);
  }) as DebouncedSaver;

  debounced.flush = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (pending) {
      savePlano(pending);
      pending = null;
    }
  };

  debounced.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    pending = null;
  };

  return debounced;
}
