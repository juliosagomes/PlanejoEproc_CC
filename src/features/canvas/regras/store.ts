import { create } from 'zustand';

/* ============================================================================
 * "Desenhar a partir da regra" (decisoes.md#D-47): o painel lateral com as
 * regras da unidade e a prévia pendente. Estado de tela, fora do plano.
 * ========================================================================== */

/** Tipo do `dataTransfer` ao arrastar uma regra da lista para o quadro. */
export const REGRA_ATP_DATATYPE = 'application/x-pj-regra-atp';

interface RegrasQuadroState {
  painelAberto: boolean;
  /** Regras na prévia, ou `null` sem prévia aberta. */
  previa: number[] | null;
  /**
   * Muda a cada prévia: os ids das peças novas saem dela, para a prévia e o
   * "Desenhar" falarem das mesmas peças.
   */
  semente: string;
  alternarPainel: (aberto?: boolean) => void;
  prever: (numeros: number[]) => void;
  fecharPrevia: () => void;
}

export const useRegrasQuadroStore = create<RegrasQuadroState>((set, get) => ({
  painelAberto: false,
  previa: null,
  semente: '',
  alternarPainel: (aberto) => set({ painelAberto: aberto ?? !get().painelAberto }),
  prever: (numeros) =>
    set({ previa: numeros, semente: Math.random().toString(36).slice(2, 8) }),
  fecharPrevia: () => set({ previa: null }),
}));
