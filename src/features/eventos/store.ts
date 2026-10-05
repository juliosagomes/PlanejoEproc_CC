import { useMemo } from 'react';
import { create } from 'zustand';
import type { ConjuntoEvento, ConjuntoEventoPersonalizado } from '@/domain';
import { useCanvasStore } from '@/features/canvas/store';
import { loadConjuntosEvento, saveConjuntosEvento } from '@/infra/storage';
import { uid } from '@/utils/uid';
import { CONJUNTOS_PADRAO } from './conjuntos';

/* ============================================================================
 * CONJUNTOS DE EVENTOS DA UNIDADE (decisoes.md#D-29)
 *
 * Os padrão são fixos e calculados uma vez do catálogo embutido; aqui mora só a
 * lista que o usuário cria. Hidratada a cada troca de sessão, ao lado dos
 * setores, porque a chave é do silo.
 * ========================================================================== */

interface ConjuntosState {
  personalizados: ConjuntoEventoPersonalizado[];
}

interface ConjuntosActions {
  hidratar: () => void;
  /** Devolve o id, ou `''` em visualização ou com nome vazio. */
  criar: (rotulo: string, ids: readonly string[]) => string;
  atualizar: (id: string, patch: Partial<Omit<ConjuntoEventoPersonalizado, 'id'>>) => void;
  remover: (id: string) => void;
  limpar: () => void;
}

function travado(): boolean {
  return useCanvasStore.getState().somenteLeitura;
}

export const useConjuntosEventoStore = create<ConjuntosState & ConjuntosActions>((set, get) => {
  const aplicar = (personalizados: ConjuntoEventoPersonalizado[]) => {
    set({ personalizados });
    saveConjuntosEvento(personalizados);
  };
  return {
    personalizados: [],

    hidratar: () => set({ personalizados: loadConjuntosEvento() }),

    criar: (rotulo, ids) => {
      const nome = rotulo.trim();
      if (travado() || !nome) return '';
      const id = uid('ce');
      aplicar([...get().personalizados, { id, rotulo: nome, ids: [...new Set(ids)] }]);
      return id;
    },

    atualizar: (id, patch) => {
      if (travado()) return;
      aplicar(
        get().personalizados.map((c) =>
          c.id === id
            ? {
                ...c,
                ...(patch.rotulo !== undefined ? { rotulo: patch.rotulo.trim() || c.rotulo } : {}),
                ...(patch.ids ? { ids: [...new Set(patch.ids)] } : {}),
              }
            : c,
        ),
      );
    },

    remover: (id) => {
      if (travado()) return;
      aplicar(get().personalizados.filter((c) => c.id !== id));
    },

    limpar: () => set({ personalizados: [] }),
  };
});

/** Padrão primeiro, depois os da unidade — a ordem em que aparecem no menu e no resumo. */
export function useConjuntosEvento(): ConjuntoEvento[] {
  const personalizados = useConjuntosEventoStore((s) => s.personalizados);
  return useMemo(
    () => [
      ...CONJUNTOS_PADRAO,
      ...personalizados.map((p) => ({ id: p.id, rotulo: p.rotulo, ids: p.ids, personalizado: true })),
    ],
    [personalizados],
  );
}
