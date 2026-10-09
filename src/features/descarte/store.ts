import { create } from 'zustand';
import { ehDestinoDescarte } from '@/domain';
import { useCanvasStore } from '@/features/canvas/store';
import { loadDestinosDescarte, saveDestinosDescarte } from '@/infra/storage';

/* ============================================================================
 * DESTINOS DE DESCARTE DA UNIDADE (decisoes.md#D-38)
 *
 * Hidratada a cada troca de sessão, ao lado dos setores, porque a chave é do
 * silo. Guarda nomes, como as filas do painel (D-33): o destino é um
 * localizador da unidade, não um nó de algum plano.
 * ========================================================================== */

interface DescarteState {
  nomes: string[];
}

interface DescarteActions {
  hidratar: () => void;
  /** Devolve `false` quando não acrescentou (vazio, repetido ou visualização). */
  adicionar: (nome: string) => boolean;
  remover: (nome: string) => void;
}

function travado(): boolean {
  return useCanvasStore.getState().somenteLeitura;
}

export const useDescarteStore = create<DescarteState & DescarteActions>((set, get) => {
  const aplicar = (nomes: string[]) => {
    set({ nomes });
    saveDestinosDescarte(nomes);
  };
  return {
    nomes: [],

    hidratar: () => set({ nomes: loadDestinosDescarte() }),

    // O `trim` não apaga o nome invisível da unidade: o U+200E é caractere de
    // formatação, não espaço, e continua lá para bater com o do Eproc.
    adicionar: (nome) => {
      const limpo = nome.trim();
      if (travado() || limpo === '' || ehDestinoDescarte(limpo, get().nomes)) return false;
      aplicar([...get().nomes, limpo]);
      return true;
    },

    remover: (nome) => {
      if (travado()) return;
      aplicar(get().nomes.filter((n) => n !== nome));
    },
  };
});
