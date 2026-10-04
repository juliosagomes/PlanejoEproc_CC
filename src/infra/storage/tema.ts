import { getStorage } from '@/infra/plataforma/storageLike';

/**
 * Tema da interface (decisoes.md#D-34). Chave **global ao navegador**, como o
 * "já vi o tutorial": é preferência de quem usa este navegador, vale igual no
 * modo local e em qualquer lotação, e precisa ser lida antes de haver sessão —
 * a tela de entrada também é pintada por ela.
 */

export type Tema = 'escuro' | 'claro';

export const TEMA_KEY = 'planejoeproc:tema';

/** O escuro é o padrão: só o claro precisa estar gravado. */
export function loadTema(): Tema {
  try {
    return getStorage()?.getItem(TEMA_KEY) === 'claro' ? 'claro' : 'escuro';
  } catch {
    return 'escuro';
  }
}

export function saveTema(tema: Tema): void {
  try {
    getStorage()?.setItem(TEMA_KEY, tema);
  } catch (err) {
    console.warn('[storage] Falha ao salvar o tema.', err);
  }
}
