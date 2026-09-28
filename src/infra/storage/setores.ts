import { type SetoresUnidade } from '@/domain';
import { getStorage, type StorageLike } from '@/infra/plataforma/storageLike';
import { prefixo } from './escopo';
import { SetoresUnidadeSchema } from './schema';
import { BACKUP_KEY_PREFIX } from './storage';

/**
 * Persistência dos setores da unidade (decisoes.md#D-26).
 *
 * Diferente dos catálogos (D-7, D-16), que são globais por navegador, a chave é
 * **derivada do escopo** — como o índice de planos. É isso que faz "a unidade":
 * cada lotação tem a sua lista, o modo local tem a dele, e entrar numa lotação
 * nunca mistura os setores de uma vara com os de outra.
 *
 *   modo local      →  planejoeproc:setores
 *   lotação <wsId>  →  planejoeproc:lot:<wsId>:setores
 *
 * Sem sessão ativa toda leitura devolve `null` e toda escrita é no-op, pela
 * mesma razão de `storage.ts`: o canvas em branco que existe antes do login não
 * pode sobrescrever a lista de ninguém.
 */

export const SETORES_KEY_SUFIXO = 'setores';

export function setoresKey(): string | null {
  const p = prefixo();
  return p === null ? null : `${p}${SETORES_KEY_SUFIXO}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function moveToBackup(storage: StorageLike, key: string, raw: string): void {
  const backupKey = `${BACKUP_KEY_PREFIX}setores:${todayIso()}`;
  try {
    storage.setItem(backupKey, raw);
  } catch {
    console.warn('[storage] Não foi possível salvar backup dos setores.');
  }
  try {
    storage.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * Lê a lista da unidade. `null` quando nunca foi gravada — é o estado normal
 * antes da primeira consolidação, e quem chama precisa distinguir isso de "lista
 * vazia de propósito", que é uma unidade sem setor nenhum.
 */
export function loadSetores(): SetoresUnidade | null {
  const storage = getStorage();
  if (!storage) return null;
  const key = setoresKey();
  if (key === null) return null;

  const raw = storage.getItem(key);
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.warn('[storage] JSON dos setores corrompido; movendo para backup.', err);
    moveToBackup(storage, key, raw);
    return null;
  }

  const result = SetoresUnidadeSchema.safeParse(parsed);
  if (!result.success) {
    console.warn(
      '[storage] Shape dos setores irreconhecível; movendo para backup.',
      result.error.issues,
    );
    moveToBackup(storage, key, raw);
    return null;
  }
  return result.data;
}

/** Sobrescreve a lista da unidade. Falhas (quota, storage indisponível) são logadas. */
export function saveSetores(setores: SetoresUnidade): void {
  const storage = getStorage();
  if (!storage) return;
  const key = setoresKey();
  if (key === null) return;
  try {
    storage.setItem(key, JSON.stringify(setores));
  } catch (err) {
    console.warn('[storage] Falha ao salvar setores (quota?).', err);
  }
}

/** Remove a lista da unidade corrente. No-op se não havia nada salvo. */
export function clearSetores(): void {
  const storage = getStorage();
  if (!storage) return;
  const key = setoresKey();
  if (key === null) return;
  try {
    storage.removeItem(key);
  } catch (err) {
    console.warn('[storage] Falha ao limpar setores.', err);
  }
}
