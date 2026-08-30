import { SCHEMA_VERSION, flagsPadrao, type Plano } from '@/domain';
import { getStorage, type StorageLike } from '@/infra/plataforma/storageLike';
import { activeKey, indexKey, isEscopoLocal, planKey } from './escopo';
import { PlanoSchema, PlansIndexSchema } from './schema';

/* ============================================================================
 * Chaves de persistência
 *
 * As chaves de plano são derivadas do escopo corrente (ver `escopo.ts`), não
 * fixas: cada lotação tem seu próprio silo, e o modo local mantém o prefixo
 * histórico. Por isso `indexKey()`/`activeKey()`/`planKey()` são funções, e
 * todas devolvem `null` quando não há sessão ativa — nesse estado toda função
 * daqui é leitura vazia ou no-op.
 *
 * A chave LEGACY_KEY é o formato antigo (single-plano). Mantemos como rede
 * de segurança por uma versão: a primeira execução pós-migração lê dela só
 * se o índice estiver ausente, importa para o novo formato e a deixa intacta.
 * Como é anterior ao conceito de lotação, só migra para o escopo local.
 * ========================================================================== */

export const LEGACY_KEY = 'planejoeproc:plano';

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

/**
 * Chave do plano ativo no escopo corrente, ou null se não há ativo (nem
 * sessão). Conveniência para testes e para inspecionar o storage.
 */
export function getActivePlanKey(): string | null {
  const id = getAtivoId();
  return id === null ? null : planKey(id);
}

export function planoVazio(): Plano {
  return {
    version: SCHEMA_VERSION,
    planoNome: 'Plano sem título',
    flowMode: 'organic',
    flags: flagsPadrao(),
    nodes: [],
    edges: [],
  };
}

/**
 * Resolve, de uma vez, o storage e as chaves do escopo corrente. Devolve null
 * quando o storage está indisponível OU não há sessão ativa — os dois casos
 * em que nenhuma função pública daqui deve fazer nada.
 */
interface Ctx {
  storage: StorageLike;
  indexK: string;
  activeK: string;
}

function ctx(): Ctx | null {
  const storage = getStorage();
  if (!storage) return null;
  const indexK = indexKey();
  const activeK = activeKey();
  if (indexK === null || activeK === null) return null;
  return { storage, indexK, activeK };
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

function moveToBackup(storage: StorageLike, sourceKey: string, raw: string): void {
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

function readIndex(c: Ctx): PlansIndex {
  const raw = c.storage.getItem(c.indexK);
  if (raw === null) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.warn('[storage] Índice de planos corrompido (JSON); movendo para backup.', err);
    moveToBackup(c.storage, c.indexK, raw);
    return [];
  }

  const result = PlansIndexSchema.safeParse(parsed);
  if (!result.success) {
    console.warn(
      '[storage] Índice de planos com shape inválido; movendo para backup.',
      result.error.issues,
    );
    moveToBackup(c.storage, c.indexK, raw);
    return [];
  }
  return result.data;
}

function writeIndex(c: Ctx, index: PlansIndex): void {
  try {
    c.storage.setItem(c.indexK, JSON.stringify(index));
  } catch (err) {
    console.warn('[storage] Falha ao gravar índice de planos (quota?).', err);
  }
}

/* ============================================================================
 * Migração one-shot
 *
 * Idempotente: só roda no escopo local, quando o índice multi-plano ainda não
 * existe E a chave legada tem um plano válido. Cria a primeira entrada do
 * índice, marca como ativo e mantém a chave legada (rede de segurança por uma
 * versão).
 * ========================================================================== */

function migrarSeNecessario(c: Ctx): void {
  if (!isEscopoLocal()) return;
  if (c.storage.getItem(c.indexK) !== null) return;
  const legacyRaw = c.storage.getItem(LEGACY_KEY);
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
  const chave = planKey(id);
  if (chave === null) return;
  const entry: PlanIndexEntry = {
    id,
    nome: plano.planoNome.trim() || 'Plano migrado',
    atualizadoEm: nowIso(),
  };

  try {
    c.storage.setItem(chave, JSON.stringify(plano));
    writeIndex(c, [entry]);
    c.storage.setItem(c.activeK, id);
  } catch (err) {
    console.warn('[storage] Falha ao migrar plano legado.', err);
  }
}

/* ============================================================================
 * API pública
 * ========================================================================== */

export function listPlanos(): PlansIndex {
  const c = ctx();
  if (!c) return [];
  migrarSeNecessario(c);
  return readIndex(c);
}

export function getAtivoId(): string | null {
  const c = ctx();
  if (!c) return null;
  migrarSeNecessario(c);
  return c.storage.getItem(c.activeK);
}

export function setAtivo(id: string): void {
  const c = ctx();
  if (!c) return;
  const index = readIndex(c);
  if (!index.some((e) => e.id === id)) {
    console.warn('[storage] setAtivo: id não encontrado no índice', id);
    return;
  }
  try {
    c.storage.setItem(c.activeK, id);
  } catch (err) {
    console.warn('[storage] Falha ao gravar ativo.', err);
  }
}

/**
 * Carrega um plano. Sem argumento, carrega o ativo; se não há ativo (boot
 * fresco, silo novo, ou todos excluídos), retorna plano vazio sem efeitos
 * colaterais.
 *
 * Casos cobertos:
 *  - Sem sessão, storage indisponível ou nada salvo → plano vazio.
 *  - JSON inválido → backup em chave -corrompido- + plano vazio.
 *  - Shape inválido (não passa no Zod) → backup + plano vazio.
 *  - Plano v1 válido → retorna o plano.
 *
 * Sempre retorna um Plano. Nunca lança.
 */
export function loadPlano(id?: string): Plano {
  const c = ctx();
  if (!c) return planoVazio();
  migrarSeNecessario(c);

  const targetId = id ?? c.storage.getItem(c.activeK);
  if (targetId === null) return planoVazio();

  const key = planKey(targetId);
  if (key === null) return planoVazio();
  const raw = c.storage.getItem(key);
  if (raw === null) return planoVazio();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.warn(`[storage] JSON inválido em ${key}; movendo para backup.`, err);
    moveToBackup(c.storage, key, raw);
    return planoVazio();
  }

  const result = PlanoSchema.safeParse(parsed);
  if (!result.success) {
    console.warn(
      `[storage] Shape de plano irreconhecível em ${key}; movendo para backup.`,
      result.error.issues,
    );
    moveToBackup(c.storage, key, raw);
    return planoVazio();
  }
  return result.data;
}

/**
 * Persiste o plano no slot ativo do escopo corrente. Se não houver ativo
 * registrado (primeiro save após entrar num silo novo), cria a entrada
 * lazily — gera id, adiciona ao índice e marca como ativo. Falhas (quota,
 * storage indisponível) são logadas mas não propagadas — o usuário continua
 * trabalhando em memória.
 *
 * O nome do plano no índice é sincronizado com `plano.planoNome` a cada save,
 * de modo que renomes feitos pelo input do header se refletem no switcher.
 */
export function savePlano(plano: Plano): void {
  const c = ctx();
  if (!c) return;

  let id = c.storage.getItem(c.activeK);
  let index = readIndex(c);
  const nomeFinal = plano.planoNome || 'Plano sem título';

  if (id === null || !index.some((e) => e.id === id)) {
    id = newId();
    index = [...index, { id, nome: nomeFinal, atualizadoEm: nowIso() }];
    try {
      c.storage.setItem(c.activeK, id);
    } catch (err) {
      console.warn('[storage] Falha ao gravar ativo.', err);
      return;
    }
  } else {
    index = index.map((e) =>
      e.id === id ? { ...e, nome: nomeFinal, atualizadoEm: nowIso() } : e,
    );
  }

  const key = planKey(id);
  if (key === null) return;
  try {
    c.storage.setItem(key, JSON.stringify(plano));
    writeIndex(c, index);
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

  const c = ctx();
  const key = planKey(id);
  if (!c || key === null) return { id, plano };

  const entry: PlanIndexEntry = {
    id,
    nome: plano.planoNome,
    atualizadoEm: nowIso(),
  };
  const index = readIndex(c);
  try {
    c.storage.setItem(key, JSON.stringify(plano));
    writeIndex(c, [...index, entry]);
    c.storage.setItem(c.activeK, id);
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
  const c = ctx();
  const key = planKey(id);
  if (!c || key === null) return { id };

  const entry: PlanIndexEntry = {
    id,
    nome: plano.planoNome.trim() || 'Plano importado',
    atualizadoEm: nowIso(),
  };
  const index = readIndex(c);
  try {
    c.storage.setItem(key, JSON.stringify(plano));
    writeIndex(c, [...index, entry]);
    c.storage.setItem(c.activeK, id);
  } catch (err) {
    console.warn('[storage] Falha ao importar plano.', err);
  }
  return { id };
}

/**
 * Importa em lote uma lista de planos já validados (típico fluxo "Abrir
 * bundle…"). Cada plano recebe id novo e entra no índice; o último da lista
 * é marcado como ativo (espelha a ordem do bundle, que costuma vir mais
 * recente por último).
 *
 * Lista vazia é no-op — devolve `{ ids: [], ativoId: null }` sem tocar no
 * ativo atual. O caller é responsável por validar o shape antes de chamar.
 */
export function importarPlanos(plans: Plano[]): {
  ids: string[];
  ativoId: string | null;
} {
  if (plans.length === 0) return { ids: [], ativoId: null };
  const c = ctx();
  if (!c) return { ids: [], ativoId: null };

  const index = readIndex(c);
  const novasEntries: PlanIndexEntry[] = [];
  const ids: string[] = [];

  for (const plano of plans) {
    const id = newId();
    const key = planKey(id);
    if (key === null) continue;
    ids.push(id);
    novasEntries.push({
      id,
      nome: plano.planoNome.trim() || 'Plano importado',
      atualizadoEm: nowIso(),
    });
    try {
      c.storage.setItem(key, JSON.stringify(plano));
    } catch (err) {
      console.warn('[storage] Falha ao gravar plano importado.', err);
    }
  }

  writeIndex(c, [...index, ...novasEntries]);

  const ultimoId = ids[ids.length - 1] ?? null;
  if (ultimoId !== null) {
    try {
      c.storage.setItem(c.activeK, ultimoId);
    } catch (err) {
      console.warn('[storage] Falha ao gravar ativo após importação em lote.', err);
    }
  }

  return { ids, ativoId: ultimoId };
}

/**
 * Sobrescreve o payload de um plano já existente, mantendo o `id` local.
 * Usado pela sincronização: ao repetir o pull de um plano remoto já
 * conhecido, o local correspondente é atualizado no lugar em vez de gerar
 * uma entrada nova (o que `importarPlano` faria). Diferente de `savePlano`,
 * não toca a chave de ativo — o plano sobrescrito não precisa virar o ativo.
 * No-op silencioso se o id não existe no índice.
 */
export function sobrescreverPlano(id: string, plano: Plano): void {
  const c = ctx();
  if (!c) return;

  const index = readIndex(c);
  const entry = index.find((e) => e.id === id);
  if (!entry) return;

  const key = planKey(id);
  if (key === null) return;

  const nomeFinal = plano.planoNome.trim() || 'Plano sem título';
  const novoIndex = index.map((e) =>
    e.id === id ? { ...e, nome: nomeFinal, atualizadoEm: nowIso() } : e,
  );

  try {
    c.storage.setItem(key, JSON.stringify(plano));
    writeIndex(c, novoIndex);
  } catch (err) {
    console.warn('[storage] Falha ao sobrescrever plano.', err);
  }
}

/**
 * Duplica um plano existente: copia o payload, renomeia para "Cópia de…",
 * registra com novo id e ativa. Retorna null se o id de origem não existe.
 */
export function duplicarPlano(id: string): { id: string } | null {
  const c = ctx();
  if (!c) return null;

  const index = readIndex(c);
  const entry = index.find((e) => e.id === id);
  if (!entry) return null;

  const original = loadPlano(id);
  const novoId = newId();
  const key = planKey(novoId);
  if (key === null) return null;
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
    c.storage.setItem(key, JSON.stringify(novoPlano));
    writeIndex(c, [...index, novaEntry]);
    c.storage.setItem(c.activeK, novoId);
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
  const c = ctx();
  if (!c) return;
  const index = readIndex(c);
  const entry = index.find((e) => e.id === id);
  if (!entry) return;

  const nomeFinal = nome.trim() || 'Plano sem título';
  const novoIndex = index.map((e) =>
    e.id === id ? { ...e, nome: nomeFinal, atualizadoEm: nowIso() } : e,
  );

  const key = planKey(id);
  const raw = key === null ? null : c.storage.getItem(key);
  if (key !== null && raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw);
      const result = PlanoSchema.safeParse(parsed);
      if (result.success) {
        const atualizado: Plano = { ...result.data, planoNome: nomeFinal };
        c.storage.setItem(key, JSON.stringify(atualizado));
      }
    } catch {
      // Payload corrompido — sincronizamos só o índice; loadPlano lidará na
      // próxima leitura e mandará o original para backup.
    }
  }

  writeIndex(c, novoIndex);
}

/**
 * Remove o plano. Se for o ativo, o próximo ativo é o mais recente do que
 * sobrou (por `atualizadoEm`); se a lista ficar vazia, a chave de ativo é
 * apagada.
 *
 * Não registra tombstone de sincronização: quem exclui deliberadamente (o
 * usuário, pelo switcher) passa por `features/sync/store.ts`, que marca a
 * exclusão para propagar; quem exclui por reflexo do servidor (pull de um
 * plano que sumiu lá) não deve marcar nada.
 */
export function excluirPlano(id: string): void {
  const c = ctx();
  if (!c) return;

  const index = readIndex(c);
  const novoIndex = index.filter((e) => e.id !== id);
  const key = planKey(id);

  try {
    if (key !== null) c.storage.removeItem(key);
    writeIndex(c, novoIndex);

    if (c.storage.getItem(c.activeK) === id) {
      const proximo = [...novoIndex].sort((a, b) =>
        b.atualizadoEm.localeCompare(a.atualizadoEm),
      )[0];
      if (proximo) {
        c.storage.setItem(c.activeK, proximo.id);
      } else {
        c.storage.removeItem(c.activeK);
      }
    }
  } catch (err) {
    console.warn('[storage] Falha ao excluir plano.', err);
  }
}

/**
 * Esvazia o silo do escopo corrente: todos os planos, o índice e o ponteiro de
 * ativo. É o "apagar todos" do modo local (decisoes.md#D-18).
 *
 * Percorre o índice em vez de varrer o storage por prefixo: o índice é a lista
 * autoritativa do silo, e uma varredura por prefixo apanharia chaves de outros
 * escopos (`planejoeproc:` é prefixo de `planejoeproc:lot:…`). Devolve quantos
 * planos saíram, para a UI poder confirmar o que fez.
 *
 * Não registra tombstone, pela mesma razão de `excluirPlano`: quem propaga
 * exclusão ao servidor é `features/sync/store.ts`.
 */
export function excluirTodosPlanos(): number {
  const c = ctx();
  if (!c) return 0;

  const index = readIndex(c);
  for (const entrada of index) {
    const key = planKey(entrada.id);
    if (key === null) continue;
    try {
      c.storage.removeItem(key);
    } catch (err) {
      console.warn('[storage] Falha ao apagar plano.', err);
    }
  }

  try {
    c.storage.removeItem(c.indexK);
    c.storage.removeItem(c.activeK);
  } catch (err) {
    console.warn('[storage] Falha ao limpar o índice de planos.', err);
  }

  return index.length;
}

/* ============================================================================
 * Debounced saver
 *
 * Mantém a assinatura antiga — o caller só passa o `Plano`. Internamente,
 * `savePlano` resolve o escopo e o id ativo (criando lazily se preciso).
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
