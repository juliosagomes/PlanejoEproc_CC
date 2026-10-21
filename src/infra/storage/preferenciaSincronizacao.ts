import { getStorage } from '@/infra/plataforma/storageLike';

/**
 * Se a última sincronização pediu o detalhe completo das regras de ATP
 * (decisoes.md#D-46). Preferência de quem usa o navegador, global como o tema.
 */
export const DETALHE_ATP_KEY = 'planejoeproc:sincronizar:detalheAtp';

export function loadDetalheAtp(): boolean {
  try {
    return getStorage()?.getItem(DETALHE_ATP_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveDetalheAtp(detalhe: boolean): void {
  try {
    getStorage()?.setItem(DETALHE_ATP_KEY, detalhe ? '1' : '0');
  } catch (err) {
    console.warn('[storage] Falha ao salvar a preferência do detalhe de ATP.', err);
  }
}
