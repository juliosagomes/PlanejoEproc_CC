import { create } from 'zustand';
import type { CatalogoOrgao, LocalizadorOrgao } from '@/domain';
import {
  XlsParseError,
  parseLocalizadoresXls,
  type ParseStats,
} from '@/infra/catalogo/parseLocalizadoresXls';
import {
  clearCatalogoOrgao,
  loadCatalogoOrgao,
  saveCatalogoOrgao,
} from '@/infra/storage';

/* ============================================================================
 * STORE DO CATÁLOGO DO ÓRGÃO
 *
 * Pequena store global que mantém o catálogo carregado em memória, sincroniza
 * com o localStorage, e expõe `importarXls` / `limpar`. Separada da store do
 * canvas porque o catálogo é independente de plano (decisoes.md#D-7).
 *
 * `ultimoErro` é mensagem amigável para mostrar inline no modal de import;
 * `ultimasStats` mostra um resumo do último import bem-sucedido (ex.: "177
 * importados, 188 ignorados como sistema").
 * ========================================================================== */

interface CatalogoState {
  catalogo: CatalogoOrgao | null;
  ultimoErro: string | null;
  ultimasStats: ParseStats | null;
}

interface CatalogoActions {
  hidratar: () => void;
  importarXls: (file: File) => Promise<void>;
  limpar: () => void;
  resetMensagens: () => void;
}

export type CatalogoStore = CatalogoState & CatalogoActions;

/**
 * `catalogo` nasce `null` e é hidratado pelo `App` depois do primeiro render.
 *
 * Ler no topo do módulo — como era até aqui — não funciona na extensão:
 * `main.tsx` importa `App`, e com ele esta store, **antes** de
 * `inicializarPlataforma()` resolver. A leitura caía num `localStorage` vazio
 * enquanto `saveCatalogoOrgao` (chamado depois, já com a plataforma pronta)
 * gravava no espelho do `chrome.storage`: o catálogo importado sumia a cada
 * recarga da aba.
 */
export const useCatalogoStore = create<CatalogoStore>((set) => ({
  catalogo: null,
  ultimoErro: null,
  ultimasStats: null,

  hidratar: () => set({ catalogo: loadCatalogoOrgao() }),

  importarXls: async (file) => {
    try {
      const buffer = await file.arrayBuffer();
      const { catalogo, stats } = parseLocalizadoresXls(new Uint8Array(buffer));
      saveCatalogoOrgao(catalogo);
      set({ catalogo, ultimasStats: stats, ultimoErro: null });
    } catch (err) {
      const msg =
        err instanceof XlsParseError
          ? err.message
          : 'Erro inesperado ao processar o arquivo. Verifique o console.';
      if (!(err instanceof XlsParseError)) console.error('[catalogo] import falhou', err);
      set({ ultimoErro: msg });
    }
  },

  limpar: () => {
    clearCatalogoOrgao();
    set({ catalogo: null, ultimasStats: null, ultimoErro: null });
  },

  resetMensagens: () => set({ ultimoErro: null, ultimasStats: null }),
}));

/**
 * Seletor: lista de itens do catálogo (vazia se nada importado). Útil para a
 * autocomplete do nome do localizador (Fase C).
 */
export function selectItens(state: CatalogoStore): LocalizadorOrgao[] {
  return state.catalogo?.itens ?? [];
}
