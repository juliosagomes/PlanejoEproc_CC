import { create } from 'zustand';
import type { CatalogoUnidade, LocalizadorUnidade } from '@/domain';
import { aplicarColeta, type ResumoColeta } from '@/infra/eproc/aplicarColeta';
import {
  loadCatalogoUnidadeAtiva,
  saveCatalogoUnidade,
} from '@/infra/storage';

/* ============================================================================
 * STORE DO CATÁLOGO DA UNIDADE
 *
 * O irmão automático do `store.ts` (catálogo do XLS). Mantém em memória o
 * catálogo da última unidade sincronizada e expõe `sincronizar`.
 *
 * **`catalogo` nasce `null`, não lido do storage.** O `store.ts` lê no topo do
 * módulo, e isso é um bug na extensão: `main.tsx` importa `App` — e com ele toda
 * a árvore de stores — *antes* de `inicializarPlataforma()` resolver, então a
 * leitura acontece contra um `localStorage` vazio em vez do espelho do
 * `chrome.storage`. Aqui a hidratação é explícita, chamada pelo `App` depois do
 * primeiro render.
 * ========================================================================== */

interface UnidadeState {
  catalogo: CatalogoUnidade | null;
  sincronizando: boolean;
  erro: string | null;
  ultimoResumo: ResumoColeta | null;
  /** Só false enquanto ninguém chamou `hidratar`. */
  hidratado: boolean;
}

interface UnidadeActions {
  hidratar: () => void;
  sincronizar: () => Promise<void>;
  resetMensagens: () => void;
}

export type UnidadeStore = UnidadeState & UnidadeActions;

export const useUnidadeStore = create<UnidadeStore>((set) => ({
  catalogo: null,
  sincronizando: false,
  erro: null,
  ultimoResumo: null,
  hidratado: false,

  hidratar: () => {
    set({ catalogo: loadCatalogoUnidadeAtiva(), hidratado: true });
  },

  sincronizar: async () => {
    set({ sincronizando: true, erro: null, ultimoResumo: null });
    try {
      // Import tardio: `@/extension/unidade` toca `chrome.*`, e carregá-lo no
      // topo faria o `npm run dev` (e os testes) puxarem a ponte sem necessidade.
      const { coletarDaUnidade } = await import('@/extension/unidade');
      const coleta = await coletarDaUnidade();
      const resultado = aplicarColeta(coleta);
      if (!resultado.ok) {
        set({ sincronizando: false, erro: resultado.erro });
        return;
      }
      saveCatalogoUnidade(resultado.catalogo);
      set({
        catalogo: resultado.catalogo,
        ultimoResumo: resultado.resumo,
        sincronizando: false,
        erro: null,
      });
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Erro inesperado ao sincronizar com a unidade. Verifique o console.';
      if (!(err instanceof Error)) console.error('[unidade] sincronização falhou', err);
      set({ sincronizando: false, erro: msg });
    }
  },

  resetMensagens: () => set({ erro: null, ultimoResumo: null }),
}));

/** Localizadores da unidade (vazio se nunca sincronizou). */
export function selectLocalizadoresUnidade(state: UnidadeStore): LocalizadorUnidade[] {
  return state.catalogo?.localizadores ?? [];
}
