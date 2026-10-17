import { useMemo } from 'react';
import { useCanvasStore } from '@/features/canvas/store';
import { useUnidadeStore } from '@/features/catalogo/storeUnidade';
import { useSetoresStore } from '@/features/setores/store';
import { montarCatalogo, type CatalogoMencoes } from './mencoes';
import { todosOsPlanos } from './planos';

/**
 * O catálogo das menções, refeito quando a unidade é sincronizada, os setores
 * mudam ou o plano ativo muda. Os outros planos só mudam por troca de plano ou
 * pull — e os dois passam pelo plano ativo.
 */
export function useCatalogoMencoes(): CatalogoMencoes {
  const unidade = useUnidadeStore((s) => s.catalogo);
  const setores = useSetoresStore((s) => s.setores);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const planoNome = useCanvasStore((s) => s.planoNome);
  return useMemo(
    () => montarCatalogo({ planos: todosOsPlanos(), unidade, setores }),
    // `nodes`, `edges` e `planoNome` não entram na conta: são o gatilho de refazê-la.
    [unidade, setores, nodes, edges, planoNome],
  );
}
