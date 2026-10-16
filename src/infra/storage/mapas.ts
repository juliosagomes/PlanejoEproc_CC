import { entradaDoIndice, type Mapa, type MapaIndexEntry } from '@/domain';
import { getStorage } from '@/infra/plataforma/storageLike';
import { prefixo } from './escopo';
import { MapaSchema, MapasIndexSchema } from './schema';
import { BACKUP_KEY_PREFIX } from './storage';

/**
 * Persistência dos mapas descritivos (decisoes.md#D-39). Do silo, como o painel
 * (D-33), mas com **uma chave por mapa** e um índice ao lado:
 *
 *   modo local      →  planejoeproc:mapas:index
 *                      planejoeproc:mapa:<id>
 *   lotação <wsId>  →  planejoeproc:lot:<wsId>:mapas:index …
 *
 * As imagens viajam dentro do mapa. Numa chave só, cada tecla digitada num
 * mapa regravaria as imagens de todos os outros.
 *
 * Mapa irreconhecível vai para o backup, como o painel: é trabalho que só existe
 * aqui. O índice, ao contrário, é derivado — se não ler, é refeito a partir dos
 * mapas que ainda se pode abrir.
 */

export const MAPAS_INDEX_SUFIXO = 'mapas:index';

export function mapasIndexKey(): string | null {
  const p = prefixo();
  return p === null ? null : `${p}${MAPAS_INDEX_SUFIXO}`;
}

export function mapaKey(id: string): string | null {
  const p = prefixo();
  return p === null ? null : `${p}mapa:${id}`;
}

function lerIndice(): MapaIndexEntry[] {
  const storage = getStorage();
  const key = mapasIndexKey();
  if (!storage || key === null) return [];
  const raw = storage.getItem(key);
  if (raw === null) return [];
  try {
    const r = MapasIndexSchema.safeParse(JSON.parse(raw));
    if (r.success) return r.data;
  } catch {
    // cai no aviso abaixo
  }
  console.warn('[storage] Índice de mapas irreconhecível; será refeito na próxima gravação.');
  return [];
}

function gravarIndice(indice: MapaIndexEntry[]): void {
  const storage = getStorage();
  const key = mapasIndexKey();
  if (!storage || key === null) return;
  try {
    storage.setItem(key, JSON.stringify(indice));
  } catch (err) {
    console.warn('[storage] Falha ao salvar o índice de mapas.', err);
  }
}

/** Mais recente primeiro. */
export function listMapas(): MapaIndexEntry[] {
  return [...lerIndice()].sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm));
}

/** `null` quando não existe ou não pôde ser lido (e então foi para o backup). */
export function loadMapa(id: string): Mapa | null {
  const storage = getStorage();
  const key = mapaKey(id);
  if (!storage || key === null) return null;
  const raw = storage.getItem(key);
  if (raw === null) return null;
  try {
    const r = MapaSchema.safeParse(JSON.parse(raw));
    if (r.success) return r.data;
    console.warn('[storage] Mapa irreconhecível; movendo para backup.', r.error.issues);
  } catch (err) {
    console.warn('[storage] JSON do mapa corrompido; movendo para backup.', err);
  }
  try {
    storage.setItem(`${BACKUP_KEY_PREFIX}mapa:${id}:${new Date().toISOString().slice(0, 10)}`, raw);
    storage.removeItem(key);
    gravarIndice(lerIndice().filter((e) => e.id !== id));
  } catch {
    // Sem backup, o valor fica onde está: melhor ignorá-lo a cada leitura que apagá-lo.
  }
  return null;
}

/** Grava o mapa e atualiza a linha dele no índice. Devolve `false` se não gravou. */
export function saveMapa(mapa: Mapa): boolean {
  const storage = getStorage();
  const key = mapaKey(mapa.id);
  if (!storage || key === null) return false;
  try {
    storage.setItem(key, JSON.stringify(mapa));
  } catch (err) {
    console.warn('[storage] Falha ao salvar o mapa (quota?).', err);
    return false;
  }
  const indice = lerIndice().filter((e) => e.id !== mapa.id);
  gravarIndice([entradaDoIndice(mapa), ...indice]);
  return true;
}

export function excluirMapa(id: string): void {
  const storage = getStorage();
  const key = mapaKey(id);
  if (!storage || key === null) return;
  storage.removeItem(key);
  gravarIndice(lerIndice().filter((e) => e.id !== id));
}
