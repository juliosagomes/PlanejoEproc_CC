import { type CatalogoOrgao } from '@/domain';
import { CatalogoOrgaoSchema } from './schema';
import { BACKUP_KEY_PREFIX } from './storage';

/**
 * Persistência do catálogo de localizadores do órgão (decisoes.md#D-7).
 *
 * Mora numa chave própria do localStorage, fora do índice de planos. É um
 * recurso global do navegador: importou uma vez, todos os planos sugerem.
 * Não entra no JSON exportado de plano — viaja independente.
 */

export const CATALOGO_KEY = 'planejoeproc:catalogo:orgao';

function getStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const probe = '__planejoeproc_probe_cat__';
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
  const backupKey = `${BACKUP_KEY_PREFIX}orgao:${todayIso()}`;
  try {
    storage.setItem(backupKey, raw);
  } catch {
    console.warn('[storage] Não foi possível salvar backup do catálogo em', backupKey);
  }
  try {
    storage.removeItem(CATALOGO_KEY);
  } catch {
    // ignore
  }
}

/**
 * Lê o catálogo do localStorage. Retorna `null` quando não há catálogo
 * importado (estado normal antes do primeiro import). Em caso de corrupção,
 * move para chave de backup e também retorna `null` — o usuário re-importa.
 */
export function loadCatalogoOrgao(): CatalogoOrgao | null {
  const storage = getStorage();
  if (!storage) return null;

  const raw = storage.getItem(CATALOGO_KEY);
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.warn('[storage] JSON do catálogo corrompido; movendo para backup.', err);
    moveToBackup(storage, raw);
    return null;
  }

  const result = CatalogoOrgaoSchema.safeParse(parsed);
  if (!result.success) {
    console.warn(
      '[storage] Shape do catálogo irreconhecível; movendo para backup.',
      result.error.issues,
    );
    moveToBackup(storage, raw);
    return null;
  }
  return result.data;
}

/**
 * Sobrescreve o catálogo. Falhas (quota, storage indisponível) são logadas
 * mas não propagadas — o usuário re-importa se necessário.
 */
export function saveCatalogoOrgao(catalogo: CatalogoOrgao): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(CATALOGO_KEY, JSON.stringify(catalogo));
  } catch (err) {
    console.warn('[storage] Falha ao salvar catálogo (quota?).', err);
  }
}

/** Remove o catálogo. No-op se não havia nada salvo. */
export function clearCatalogoOrgao(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(CATALOGO_KEY);
  } catch (err) {
    console.warn('[storage] Falha ao limpar catálogo.', err);
  }
}
