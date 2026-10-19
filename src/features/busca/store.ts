import { create } from 'zustand';

/**
 * Se a paleta do Ctrl+K está aberta. Store própria porque quem abre (a barra
 * no topo do quadro, dentro do `FlowCanvas`) e quem desenha (a paleta, no
 * `App`, que conhece os comandos) não são pai e filho.
 */
interface BuscaState {
  aberta: boolean;
  abrir: () => void;
  fechar: () => void;
  alternar: () => void;
}

export const useBuscaStore = create<BuscaState>((set) => ({
  aberta: false,
  abrir: () => set({ aberta: true }),
  fechar: () => set({ aberta: false }),
  alternar: () => set((s) => ({ aberta: !s.aberta })),
}));
