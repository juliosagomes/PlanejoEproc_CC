import { create } from 'zustand';
import {
  SETORES_VERSION,
  proximaCor,
  sugerirCode,
  setoresPadrao,
  type DefinicaoFlag,
} from '@/domain';
import { useCanvasStore } from '@/features/canvas/store';
import {
  consolidarSetores,
  getAtivoId,
  listPlanos,
  loadPlano,
  saveSetores,
  sobrescreverPlano,
} from '@/infra/storage';
import { uid } from '@/utils/uid';

/* ============================================================================
 * STORE DOS SETORES DA UNIDADE (decisoes.md#D-26)
 *
 * Dona da lista que antes morava dentro de cada plano. Mora numa chave por
 * escopo, então "a unidade" é o silo da sessão: uma lotação, ou o modo local.
 *
 * A store do canvas guarda um **espelho** dela (`flags`), atualizado aqui a cada
 * mudança. O import é de mão única — `features/setores` conhece o canvas, nunca
 * o contrário — e é isso que evita o ciclo: o canvas só precisa de um array já
 * pronto para pintar os chips e gravar o retrato dentro do plano.
 * ========================================================================== */

interface SetoresState {
  setores: DefinicaoFlag[];
}

interface SetoresActions {
  /** Consolida o silo e espelha no canvas. Chamada a cada troca de sessão e a cada plano que chega de fora. */
  hidratar: (somenteLeitura: boolean) => void;
  /** Cria com sigla e cor sugeridas. Devolve o id, ou `''` quando não pode escrever. */
  criar: (label: string) => string;
  atualizar: (id: string, patch: Partial<Omit<DefinicaoFlag, 'id'>>) => void;
  /** Remove a definição **e** a marcação dela em todos os planos do silo. */
  remover: (id: string) => void;
  /** Volta ao estado de "sem sessão" — o `sair()` da store de sessão. */
  limpar: () => void;
}

export type SetoresStore = SetoresState & SetoresActions;

/**
 * Grava a lista e espelha no canvas. O espelho entra no slice persistido do
 * canvas, então a assinatura de lá regrava o plano ativo com o retrato novo —
 * é assim que renomear um setor chega ao JSON exportado sem código extra.
 */
function aplicar(setores: DefinicaoFlag[], persistir: boolean): void {
  if (persistir) saveSetores({ version: SETORES_VERSION, itens: setores });
  useCanvasStore.getState().setFlags(setores);
}

/** `true` quando a sessão corrente não pode escrever (visualização — D-19). */
function travado(): boolean {
  return useCanvasStore.getState().somenteLeitura;
}

export const useSetoresStore = create<SetoresStore>((set, get) => ({
  setores: setoresPadrao().itens,

  hidratar: (somenteLeitura) => {
    const setores = consolidarSetores({ somenteLeitura });
    set({ setores });
    useCanvasStore.getState().setFlags(setores);
  },

  criar: (label) => {
    if (travado()) return '';
    const nome = label.trim();
    if (!nome) return '';
    const id = uid('f');
    const setores = [
      ...get().setores,
      { id, code: sugerirCode(nome), label: nome, cor: proximaCor(get().setores) },
    ];
    set({ setores });
    aplicar(setores, true);
    return id;
  },

  atualizar: (id, patch) => {
    if (travado()) return;
    const setores = get().setores.map((f) => (f.id === id ? { ...f, ...patch } : f));
    set({ setores });
    aplicar(setores, true);
  },

  remover: (id) => {
    if (travado()) return;
    const setores = get().setores.filter((f) => f.id !== id);
    set({ setores });
    aplicar(setores, true);

    // O plano aberto passa pela store do canvas, e não por `sobrescreverPlano`:
    // ele pode ter edições ainda não gravadas, e escrever por baixo do canvas as
    // perderia no próximo save com debounce.
    useCanvasStore.getState().removerMarcacaoDeFlag(id);

    const ativo = getAtivoId();
    for (const entrada of listPlanos()) {
      if (entrada.id === ativo) continue;
      const plano = loadPlano(entrada.id);
      const usa = plano.nodes.some((n) => n.data.flags.includes(id));
      if (!usa) continue;
      sobrescreverPlano(entrada.id, {
        ...plano,
        flags: setores,
        nodes: plano.nodes.map((n) =>
          n.data.flags.includes(id)
            ? { ...n, data: { ...n.data, flags: n.data.flags.filter((x) => x !== id) } }
            : n,
        ),
      });
    }
  },

  limpar: () => {
    const setores = setoresPadrao().itens;
    set({ setores });
    aplicar(setores, false);
  },
}));
