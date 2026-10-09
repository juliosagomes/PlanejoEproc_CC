import { DESCARTE_VERSION } from '@/domain';
import { getStorage } from '@/infra/plataforma/storageLike';
import { prefixo } from './escopo';
import { DestinosDescarteUnidadeSchema } from './schema';

/**
 * Destinos de descarte da unidade (decisoes.md#D-38). Uma chave por silo, como
 * os setores (D-26) e os conjuntos de eventos (D-29):
 *
 *   modo local      →  planejoeproc:descarte
 *   lotação <wsId>  →  planejoeproc:lot:<wsId>:descarte
 *
 * Valor irreconhecível vira lista vazia, sem backup: os planos não dependem
 * dela para abrir — as regras penduradas guardam o destino escolhido.
 */

function descarteKey(): string | null {
  const p = prefixo();
  return p === null ? null : `${p}descarte`;
}

export function loadDestinosDescarte(): string[] {
  const key = descarteKey();
  const raw = key === null ? null : (getStorage()?.getItem(key) ?? null);
  if (raw === null) return [];
  try {
    const parsed = DestinosDescarteUnidadeSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data.nomes : [];
  } catch {
    return [];
  }
}

export function saveDestinosDescarte(nomes: readonly string[]): void {
  const key = descarteKey();
  if (key === null) return;
  try {
    if (nomes.length === 0) getStorage()?.removeItem(key);
    else getStorage()?.setItem(key, JSON.stringify({ version: DESCARTE_VERSION, nomes }));
  } catch (err) {
    console.warn('[storage] Falha ao salvar destinos de descarte.', err);
  }
}
