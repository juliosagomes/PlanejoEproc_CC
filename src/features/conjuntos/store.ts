import { useMemo } from 'react';
import { create } from 'zustand';
import {
  CATALOGOS_COM_CONJUNTO,
  type CatalogoConjunto,
  type Conjunto,
  type ConjuntoPersonalizado,
} from '@/domain';
import { useCanvasStore } from '@/features/canvas/store';
import { loadConjuntos, saveConjuntos } from '@/infra/storage';
import { uid } from '@/utils/uid';
import { CATALOGOS_CONJUNTO } from './catalogos';

/* ============================================================================
 * CONJUNTOS DA UNIDADE (decisoes.md#D-29, D-41)
 *
 * Os padrão são fixos e calculados uma vez do catálogo embutido; aqui mora só a
 * lista que o usuário cria, uma por catálogo. Hidratada a cada troca de sessão,
 * ao lado dos setores, porque a chave é do silo.
 * ========================================================================== */

type PorCatalogo = Record<CatalogoConjunto, ConjuntoPersonalizado[]>;

interface ConjuntosState {
  personalizados: PorCatalogo;
}

interface ConjuntosActions {
  hidratar: () => void;
  /** Devolve o id, ou `''` em visualização ou com nome vazio. */
  criar: (catalogo: CatalogoConjunto, rotulo: string, ids: readonly string[]) => string;
  atualizar: (
    catalogo: CatalogoConjunto,
    id: string,
    patch: Partial<Omit<ConjuntoPersonalizado, 'id'>>,
  ) => void;
  remover: (catalogo: CatalogoConjunto, id: string) => void;
  limpar: () => void;
}

const vazio = (): PorCatalogo => ({ eventos: [], tiposPeticao: [], documentos: [] });

function travado(): boolean {
  return useCanvasStore.getState().somenteLeitura;
}

export const useConjuntosStore = create<ConjuntosState & ConjuntosActions>((set, get) => {
  const aplicar = (catalogo: CatalogoConjunto, itens: ConjuntoPersonalizado[]) => {
    set({ personalizados: { ...get().personalizados, [catalogo]: itens } });
    saveConjuntos(catalogo, itens);
  };
  return {
    personalizados: vazio(),

    hidratar: () => {
      const personalizados = vazio();
      for (const c of CATALOGOS_COM_CONJUNTO) personalizados[c] = loadConjuntos(c);
      set({ personalizados });
    },

    criar: (catalogo, rotulo, ids) => {
      const nome = rotulo.trim();
      if (travado() || !nome) return '';
      const id = uid('ce');
      aplicar(catalogo, [...get().personalizados[catalogo], { id, rotulo: nome, ids: [...new Set(ids)] }]);
      return id;
    },

    atualizar: (catalogo, id, patch) => {
      if (travado()) return;
      aplicar(
        catalogo,
        get().personalizados[catalogo].map((c) =>
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

    remover: (catalogo, id) => {
      if (travado()) return;
      aplicar(
        catalogo,
        get().personalizados[catalogo].filter((c) => c.id !== id),
      );
    },

    limpar: () => set({ personalizados: vazio() }),
  };
});

/** Padrão primeiro, depois os da unidade — a ordem em que aparecem no menu e no resumo. */
export function useConjuntos(catalogo: CatalogoConjunto): Conjunto[] {
  const personalizados = useConjuntosStore((s) => s.personalizados[catalogo]);
  return useMemo(
    () => [
      ...CATALOGOS_CONJUNTO[catalogo].padrao,
      ...personalizados.map((p) => ({ id: p.id, rotulo: p.rotulo, ids: p.ids, personalizado: true })),
    ],
    [catalogo, personalizados],
  );
}
