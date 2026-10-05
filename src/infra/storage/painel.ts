import { type PainelUnidade } from '@/domain';
import { getStorage } from '@/infra/plataforma/storageLike';
import { prefixo } from './escopo';
import { PainelUnidadeSchema } from './schema';
import { BACKUP_KEY_PREFIX } from './storage';

/**
 * Persistência do painel da unidade (decisoes.md#D-33). Uma chave por silo, como
 * os setores (D-26):
 *
 *   modo local      →  planejoeproc:painel
 *   lotação <wsId>  →  planejoeproc:lot:<wsId>:painel
 *
 * Valor irreconhecível vai para o backup, e não para o lixo como nos conjuntos
 * de eventos: aqui há trabalho que só existe nesta chave — as filas planejadas e
 * os motivos de "fora de propósito" não estão em plano nenhum.
 */

export const PAINEL_KEY_SUFIXO = 'painel';

export function painelKey(): string | null {
  const p = prefixo();
  return p === null ? null : `${p}${PAINEL_KEY_SUFIXO}`;
}

/** `null` quando nunca foi gravado, ou quando o gravado não pôde ser lido. */
export function loadPainel(): PainelUnidade | null {
  const storage = getStorage();
  const key = painelKey();
  if (!storage || key === null) return null;
  const raw = storage.getItem(key);
  if (raw === null) return null;

  try {
    const result = PainelUnidadeSchema.safeParse(JSON.parse(raw));
    if (result.success) return result.data;
    console.warn('[storage] Painel irreconhecível; movendo para backup.', result.error.issues);
  } catch (err) {
    console.warn('[storage] JSON do painel corrompido; movendo para backup.', err);
  }
  try {
    storage.setItem(`${BACKUP_KEY_PREFIX}painel:${new Date().toISOString().slice(0, 10)}`, raw);
    storage.removeItem(key);
  } catch {
    // Sem backup, o valor fica onde está: melhor ignorá-lo a cada leitura que apagá-lo.
  }
  return null;
}

export function savePainel(painel: PainelUnidade): void {
  const storage = getStorage();
  const key = painelKey();
  if (!storage || key === null) return;
  try {
    storage.setItem(key, JSON.stringify(painel));
  } catch (err) {
    console.warn('[storage] Falha ao salvar o painel (quota?).', err);
  }
}
