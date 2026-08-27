import { type CatalogoUnidade } from '@/domain';
import { getStorage, type StorageLike } from '@/infra/plataforma/storageLike';
import { CatalogoUnidadeSchema } from './schema';
import { BACKUP_KEY_PREFIX } from './storage';

/**
 * Persistência do catálogo lido da unidade no Eproc.
 *
 * Como o catálogo do XLS (decisoes.md#D-7), vive fora do silo de planos: é
 * propriedade do usuário/unidade, não do plano. Diferente dele, é **uma chave
 * por unidade** — um host do Eproc serve todas as varas do tribunal, e chavear
 * só por host faria a coleta de uma unidade sobrescrever a da outra em silêncio.
 *
 * `ativa` guarda só a chave da última unidade coletada, para o editor saber qual
 * catálogo carregar sem precisar da aba do Eproc aberta.
 */
const PREFIXO = 'planejoeproc:catalogo:unidade:';
const ATIVA_KEY = `${PREFIXO}ativa`;

export const CATALOGO_UNIDADE_PREFIXO = PREFIXO;

export function catalogoUnidadeKey(chave: string): string {
  return `${PREFIXO}${chave}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function moveToBackup(storage: StorageLike, key: string, raw: string): void {
  const backupKey = `${BACKUP_KEY_PREFIX}unidade:${todayIso()}`;
  try {
    storage.setItem(backupKey, raw);
  } catch {
    console.warn('[storage] Não foi possível salvar backup do catálogo da unidade.');
  }
  try {
    storage.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * Lê o catálogo de uma unidade. `null` quando nunca foi coletado — estado normal
 * antes do primeiro uso. Corrupção vai para backup e também devolve `null`: o
 * usuário sincroniza de novo, que é barato.
 */
export function loadCatalogoUnidade(chave: string): CatalogoUnidade | null {
  const storage = getStorage();
  if (!storage) return null;

  const key = catalogoUnidadeKey(chave);
  const raw = storage.getItem(key);
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.warn('[storage] JSON do catálogo da unidade corrompido.', err);
    moveToBackup(storage, key, raw);
    return null;
  }

  const result = CatalogoUnidadeSchema.safeParse(parsed);
  if (!result.success) {
    console.warn(
      '[storage] Shape do catálogo da unidade irreconhecível.',
      result.error.issues,
    );
    moveToBackup(storage, key, raw);
    return null;
  }
  return result.data;
}

/** Chave da última unidade coletada, ou `null`. */
export function getUnidadeAtiva(): string | null {
  const storage = getStorage();
  if (!storage) return null;
  return storage.getItem(ATIVA_KEY);
}

/** Catálogo da última unidade coletada. */
export function loadCatalogoUnidadeAtiva(): CatalogoUnidade | null {
  const chave = getUnidadeAtiva();
  return chave ? loadCatalogoUnidade(chave) : null;
}

/**
 * Grava o catálogo e marca a unidade como ativa. Falhas (quota, storage
 * indisponível) são logadas mas não propagadas — a coleta é repetível.
 */
export function saveCatalogoUnidade(catalogo: CatalogoUnidade): void {
  const storage = getStorage();
  if (!storage) return;
  const chave = catalogo.unidade.chave;
  try {
    storage.setItem(catalogoUnidadeKey(chave), JSON.stringify(catalogo));
    storage.setItem(ATIVA_KEY, chave);
  } catch (err) {
    console.warn('[storage] Falha ao salvar catálogo da unidade (quota?).', err);
  }
}

/** Remove o catálogo de uma unidade. Limpa `ativa` se era ela. */
export function clearCatalogoUnidade(chave: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(catalogoUnidadeKey(chave));
    if (storage.getItem(ATIVA_KEY) === chave) storage.removeItem(ATIVA_KEY);
  } catch (err) {
    console.warn('[storage] Falha ao limpar catálogo da unidade.', err);
  }
}
