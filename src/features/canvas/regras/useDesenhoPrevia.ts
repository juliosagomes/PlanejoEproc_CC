import { useMemo } from 'react';
import { useUnidadeStore } from '@/features/catalogo/storeUnidade';
import { useDescarteStore } from '@/features/descarte/store';
import { planejarDesenho, type Desenho } from '../desenharRegra';
import { useCanvasStore } from '../store';
import { useRegrasQuadroStore } from './store';

/** O desenho que a prévia mostra e que o "Desenhar" aplica. `null` sem prévia. */
export function useDesenhoPrevia(): Desenho | null {
  const previa = useRegrasQuadroStore((s) => s.previa);
  const semente = useRegrasQuadroStore((s) => s.semente);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const entradas = useCanvasStore((s) => s.entradas);
  const catalogo = useUnidadeStore((s) => s.catalogo);
  const descarte = useDescarteStore((s) => s.nomes);

  return useMemo(() => {
    if (!previa || !catalogo?.regrasAtp) return null;
    const regras = previa
      .map((n) => catalogo.regrasAtp?.find((r) => r.numero === n))
      .filter((r) => r !== undefined);
    let i = 0;
    return planejarDesenho(
      { nodes, edges, entradas },
      regras,
      {
        descarte,
        sistema: catalogo.localizadores.filter((l) => l.sistema).map((l) => l.sigla),
        gerarId: (p) => `${p}_${semente}_${(i += 1)}`,
      },
    );
  }, [previa, semente, nodes, edges, entradas, catalogo, descarte]);
}
