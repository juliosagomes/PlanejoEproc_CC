import { OBSERVACOES_REGRAS_VERSION } from '@/domain';
import { getStorage } from '@/infra/plataforma/storageLike';
import { prefixo } from './escopo';
import { ObservacoesRegrasUnidadeSchema } from './schema';
import { BACKUP_KEY_PREFIX } from './storage';

/**
 * Observações das regras de ATP (decisoes.md#D-46). Uma chave por silo, como o
 * painel (D-33):
 *
 *   modo local      →  planejoeproc:observacoesAtp
 *   lotação <wsId>  →  planejoeproc:lot:<wsId>:observacoesAtp
 *
 * Valor irreconhecível vai para o backup: é texto do usuário que não existe em
 * nenhum outro lugar.
 */

function observacoesKey(): string | null {
  const p = prefixo();
  return p === null ? null : `${p}observacoesAtp`;
}

export function loadObservacoesRegras(): Record<string, string> {
  const storage = getStorage();
  const key = observacoesKey();
  if (!storage || key === null) return {};
  const raw = storage.getItem(key);
  if (raw === null) return {};
  try {
    const result = ObservacoesRegrasUnidadeSchema.safeParse(JSON.parse(raw));
    if (result.success) return result.data.itens;
    console.warn('[storage] Observações de ATP irreconhecíveis; movendo para backup.');
  } catch (err) {
    console.warn('[storage] JSON das observações de ATP corrompido; movendo para backup.', err);
  }
  try {
    storage.setItem(`${BACKUP_KEY_PREFIX}observacoesAtp:${new Date().toISOString().slice(0, 10)}`, raw);
    storage.removeItem(key);
  } catch {
    // Sem backup, o valor fica onde está: melhor ignorá-lo a cada leitura que apagá-lo.
  }
  return {};
}

export function saveObservacoesRegras(itens: Record<string, string>): void {
  const storage = getStorage();
  const key = observacoesKey();
  if (!storage || key === null) return;
  try {
    if (Object.keys(itens).length === 0) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify({ version: OBSERVACOES_REGRAS_VERSION, itens }));
  } catch (err) {
    console.warn('[storage] Falha ao salvar as observações de ATP.', err);
  }
}
