/* ============================================================================
 * STORAGE LIKE — a fronteira entre o app e o mecanismo de persistência
 *
 * Todo o `infra/storage/` e `infra/sync/` é **síncrono** e sempre foi. Isso não
 * é acidente: `savePlano` é chamado pela subscription da store do canvas, que
 * não pode esperar promessa nenhuma sem virar máquina de estados.
 *
 * Quando o app roda como extensão, o mecanismo por baixo passa a ser o
 * `chrome.storage`, que é assíncrono. Em vez de propagar `async` por toda a
 * árvore (canvas, sessão, catálogo, sync e os testes), mantemos a API síncrona
 * e trocamos só o *backend* — ver `chromeMirror.ts` (decisoes.md#D-12).
 *
 * O projeto usa exatamente três operações. Não é `Storage` do DOM porque não
 * precisamos de `length`/`key()`/`clear()`, e exigi-las obrigaria o espelho a
 * imitar coisas que ninguém chama.
 * ========================================================================== */

export interface StorageLike {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
  removeItem(chave: string): void;
}

const PROBE_KEY = '__planejoeproc_probe__';

/**
 * Backend injetado por `inicializarPlataforma()`. `null` = ninguém injetou,
 * então caímos no `localStorage`. A detecção é em **runtime**, não por `define`
 * de build: o mesmo bundle serve os dois alvos, e os testes (jsdom, sem
 * `chrome`) continuam exercitando o caminho do `localStorage` sem stub algum.
 */
let backend: StorageLike | null = null;

export function setStorageBackend(s: StorageLike | null): void {
  backend = s;
}

/**
 * `localStorage` pode estar indisponível em alguns contextos (modo privado
 * estrito, iframe sem permissão, ambientes server-side). Detectamos com uma
 * gravação de teste em vez de só verificar `typeof`.
 */
function localStorageDisponivel(): StorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    localStorage.setItem(PROBE_KEY, '1');
    localStorage.removeItem(PROBE_KEY);
    return localStorage;
  } catch {
    return null;
  }
}

/**
 * O storage do escopo corrente, ou `null` quando não há nenhum utilizável —
 * caso em que toda função de `infra/storage` vira leitura vazia ou no-op.
 */
export function getStorage(): StorageLike | null {
  if (backend !== null) return backend;
  return localStorageDisponivel();
}
