import { anotacoesVazias, type AnotacoesCatalogo } from '@/domain';
import { getStorage, type StorageLike } from '@/infra/plataforma/storageLike';
import { AnotacoesCatalogoSchema } from './schema';
import { BACKUP_KEY_PREFIX } from './storage';

/**
 * Persistência das anotações do catálogo (decisoes.md#D-25).
 *
 * Chave própria, global por navegador, na mesma forma de `catalogo.ts`. Separar
 * é o ponto: reimportar o XLS ou ressincronizar a unidade troca o catálogo
 * inteiro, e a anotação precisa atravessar isso.
 */

export const ANOTACOES_KEY = 'planejoeproc:catalogo:anotacoes';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function moveToBackup(storage: StorageLike, raw: string): void {
  const backupKey = `${BACKUP_KEY_PREFIX}anotacoes:${todayIso()}`;
  try {
    storage.setItem(backupKey, raw);
  } catch {
    console.warn('[storage] Não foi possível salvar backup das anotações em', backupKey);
  }
  try {
    storage.removeItem(ANOTACOES_KEY);
  } catch {
    // ignore
  }
}

/**
 * Lê as anotações. Devolve o objeto vazio — nunca `null` — porque "nada
 * anotado" é o estado normal, e o chamador não deveria ter que distinguir isso
 * de "storage indisponível". Em caso de corrupção, move para backup e devolve
 * vazio: o usuário reescreve o que perdeu, e o texto antigo continua no backup.
 */
export function loadAnotacoesCatalogo(): AnotacoesCatalogo {
  const storage = getStorage();
  if (!storage) return anotacoesVazias();

  const raw = storage.getItem(ANOTACOES_KEY);
  if (raw === null) return anotacoesVazias();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.warn('[storage] JSON das anotações corrompido; movendo para backup.', err);
    moveToBackup(storage, raw);
    return anotacoesVazias();
  }

  const result = AnotacoesCatalogoSchema.safeParse(parsed);
  if (!result.success) {
    console.warn(
      '[storage] Shape das anotações irreconhecível; movendo para backup.',
      result.error.issues,
    );
    moveToBackup(storage, raw);
    return anotacoesVazias();
  }
  return result.data;
}

/** Sobrescreve as anotações. Falhas (quota, storage indisponível) são logadas. */
export function saveAnotacoesCatalogo(anotacoes: AnotacoesCatalogo): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(ANOTACOES_KEY, JSON.stringify(anotacoes));
  } catch (err) {
    console.warn('[storage] Falha ao salvar anotações (quota?).', err);
  }
}

/** Remove todas as anotações. No-op se não havia nada salvo. */
export function clearAnotacoesCatalogo(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(ANOTACOES_KEY);
  } catch (err) {
    console.warn('[storage] Falha ao limpar anotações.', err);
  }
}
