import { SCHEMA_VERSION, type Plano } from '@/domain';
import { PlanoSchema } from './schema';

/** Chave única do plano no localStorage. */
export const STORAGE_KEY = 'planejoeproc:plano';

/**
 * Prefixo de chave para backups de dados que não puderam ser carregados
 * (JSON inválido ou shape irreconhecível). Sufixo é YYYY-MM-DD da falha.
 * Se duas falhas ocorrerem no mesmo dia, a segunda sobrescreve a primeira —
 * aceitável em beta.
 */
export const BACKUP_KEY_PREFIX = 'planejoeproc:plano:corrompido:';

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

function moveToBackup(storage: Storage, raw: string): void {
  const backupKey = `${BACKUP_KEY_PREFIX}${todayIso()}`;
  try {
    storage.setItem(backupKey, raw);
  } catch {
    // Quota cheia ou outro erro: melhor logar e perder o backup do que travar.
    console.warn('[storage] Não foi possível salvar backup em', backupKey);
  }
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Carrega o plano do localStorage. Casos cobertos:
 *  - localStorage indisponível ou chave ausente → plano vazio.
 *  - JSON inválido → backup em chave -corrompido- + plano vazio.
 *  - Shape inválido (não passa no Zod) → backup + plano vazio.
 *  - Plano v1 válido → retorna o plano.
 *
 * Sempre retorna um Plano. Nunca lança.
 */
export function loadPlano(): Plano {
  const storage = getStorage();
  if (!storage) return planoVazio();

  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return planoVazio();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.warn('[storage] JSON inválido em localStorage; movendo para backup.', err);
    moveToBackup(storage, raw);
    return planoVazio();
  }

  const result = PlanoSchema.safeParse(parsed);
  if (!result.success) {
    console.warn(
      '[storage] Shape de plano irreconhecível em localStorage; movendo para backup.',
      result.error.issues,
    );
    moveToBackup(storage, raw);
    return planoVazio();
  }

  return result.data;
}

/**
 * Persiste o plano no localStorage. Falhas (quota cheia, storage indisponível)
 * são logadas mas não propagadas — o usuário continua trabalhando em memória.
 */
export function savePlano(plano: Plano): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(plano));
  } catch (err) {
    console.warn('[storage] Falha ao salvar plano (quota?).', err);
  }
}

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
