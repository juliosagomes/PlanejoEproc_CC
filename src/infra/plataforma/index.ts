import {
  assinarMudancaExterna,
  chromeMirror,
  flushEspelho,
  hidratarEspelho,
} from './chromeMirror';
import { setStorageBackend, type StorageLike } from './storageLike';

/* ============================================================================
 * PLATAFORMA
 *
 * Único lugar do app (fora de `src/extension/`) que sabe se estamos rodando
 * como extensão do Chrome ou como página comum. Todo o resto lê e escreve
 * através de `infra/storage`, que não faz ideia.
 *
 *   com `chrome.*`  → chrome.storage.local|sync, atrás do espelho síncrono
 *   sem `chrome.*`  → localStorage
 *
 * O segundo caso não é um alvo de distribuição — a extensão é o único
 * (decisoes.md#D-15). É o caminho dos **testes** (jsdom não tem `chrome`) e do
 * **servidor de dev** (`npm run dev`, útil para trabalho de UI). Manter esse
 * fallback é o que permite os testes exercitarem `infra/storage` de verdade,
 * sem stub de `chrome.storage` em cada arquivo.
 * ========================================================================== */

/**
 * `chrome` existe (vazio) em páginas comuns do próprio Chrome, então testar o
 * objeto não basta: exigimos `chrome.storage.local`, que só é injetado em
 * contexto de extensão com a permissão `storage`.
 */
export function ehExtensao(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    typeof chrome.storage !== 'undefined' &&
    typeof chrome.storage.local !== 'undefined'
  );
}

/**
 * Prepara o backend de persistência. **Precisa ser aguardado antes do primeiro
 * render** (ou da primeira leitura, no service worker): na extensão, o espelho
 * nasce vazio e só depois da hidratação devolve os planos e as lotações
 * conhecidas.
 *
 * Fora da extensão é no-op — `getStorage()` já cai no `localStorage` sozinho.
 */
export async function inicializarPlataforma(): Promise<void> {
  if (!ehExtensao()) return;
  await hidratarEspelho();
  setStorageBackend(chromeMirror);
}

/**
 * Garante que as escritas pendentes tenham sido emitidas ao `chrome.storage`.
 * No-op fora da extensão (o `localStorage` já é síncrono de verdade).
 */
export function flushPlataforma(): void {
  if (!ehExtensao()) return;
  flushEspelho();
}

export { assinarMudancaExterna };
export type { StorageLike };
