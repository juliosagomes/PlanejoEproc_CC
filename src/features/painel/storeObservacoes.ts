import { create } from 'zustand';
import { definirObservacao } from '@/domain';
import { useCanvasStore } from '@/features/canvas/store';
import { loadObservacoesRegras, saveObservacoesRegras } from '@/infra/storage';

/* ============================================================================
 * OBSERVAÇÕES DAS REGRAS DE ATP (decisoes.md#D-46)
 *
 * Hidratada a cada troca de sessão, como o painel, porque a chave é do silo.
 * ========================================================================== */

interface ObservacoesState {
  itens: Record<string, string>;
}

interface ObservacoesActions {
  hidratar: () => void;
  definir: (numero: number, texto: string) => void;
}

export const useObservacoesRegrasStore = create<ObservacoesState & ObservacoesActions>((set, get) => ({
  itens: {},

  hidratar: () => set({ itens: loadObservacoesRegras() }),

  definir: (numero, texto) => {
    if (useCanvasStore.getState().somenteLeitura) return;
    const itens = definirObservacao(get().itens, numero, texto);
    set({ itens });
    saveObservacoesRegras(itens);
  },
}));
