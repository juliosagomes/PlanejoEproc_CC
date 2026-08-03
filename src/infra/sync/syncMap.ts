/**
 * Mapa local de sincronização: liga um plano local (`localId`, do
 * `localStorage` de `infra/storage`) a um plano remoto (`remotoId`, do
 * workspace no backend). Existe porque `Plano` (domain) não tem `id`
 * próprio — `localId` é gerado por instalação e não viaja no JSON.
 *
 * `remotoId` é um UUID gerado no cliente na primeira publicação, então já é
 * globalmente único: a chave de casamento entre pull/push é só `remotoId`,
 * sem precisar amarrar ao código usado (que pode ser leitura numa
 * sincronização e edição noutra, para o mesmo workspace).
 *
 * Vive fora do JSON do plano e fora do índice de planos — mesmo padrão do
 * catálogo do órgão (decisoes.md#D-7): dado de sincronização é global ao
 * navegador, não propriedade de um plano específico. O mapa não é dividido
 * por lotação porque `localId` já é um UUID único entre silos.
 *
 * As lotações conhecidas (e os tombstones de exclusão) vivem em `lotacoes.ts`.
 */

export type SyncPapel = 'dono' | 'assinante';

export interface SyncMapEntry {
  localId: string;
  remotoId: string;
  /** Código usado na última sincronização/publicação deste plano — só para exibição. */
  workspaceCodigo: string;
  /** 'dono' = publicado a partir deste navegador; 'assinante' = recebido via sincronizar. */
  papel: SyncPapel;
  ultimaSincronizacao: string;
}

const SYNC_MAP_KEY = 'planejoeproc:sync:map';

function getStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const probe = '__planejoeproc_probe_sync__';
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

export function listSyncMap(): SyncMapEntry[] {
  return readList<SyncMapEntry>(SYNC_MAP_KEY);
}

export function findEntradaPorRemoto(remotoId: string): SyncMapEntry | undefined {
  return listSyncMap().find((e) => e.remotoId === remotoId);
}

export function findEntradaPorLocal(localId: string): SyncMapEntry | undefined {
  return listSyncMap().find((e) => e.localId === localId);
}

/** Upsert por `remotoId` (chave estável) — substitui entrada anterior do mesmo plano. */
export function registrarEntrada(entrada: SyncMapEntry): void {
  const lista = listSyncMap().filter(
    (e) => e.remotoId !== entrada.remotoId && e.localId !== entrada.localId,
  );
  writeList(SYNC_MAP_KEY, [...lista, entrada]);
}

export function atualizarUltimaSincronizacao(remotoId: string, quando: string): void {
  const lista = listSyncMap().map((e) =>
    e.remotoId === remotoId ? { ...e, ultimaSincronizacao: quando } : e,
  );
  writeList(SYNC_MAP_KEY, lista);
}

/**
 * Descarta o vínculo de um plano local excluído. Chamado depois de gravar o
 * tombstone (`lotacoes.registrarExclusaoLocal`), que é quem precisa do
 * `remotoId` — a ordem importa.
 */
export function removerEntradaPorLocal(localId: string): void {
  writeList(
    SYNC_MAP_KEY,
    listSyncMap().filter((e) => e.localId !== localId),
  );
}
