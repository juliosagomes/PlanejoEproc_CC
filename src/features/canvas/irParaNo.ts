import { useCallback } from 'react';
import { useReactFlow } from 'reactflow';
import { useCanvasStore } from './store';

/**
 * Leva a câmera até um nó e o seleciona — o "ir para" do atalho (D-30). Nunca
 * afasta: se o usuário já está mais perto do que o zoom 1, fica onde está.
 */
export function useIrParaNo(): (id: string) => void {
  const { getNode, setCenter, getZoom } = useReactFlow();
  return useCallback(
    (id: string) => {
      const n = getNode(id);
      if (!n) return;
      const x = (n.positionAbsolute?.x ?? n.position.x) + (n.width ?? 180) / 2;
      const y = (n.positionAbsolute?.y ?? n.position.y) + (n.height ?? 50) / 2;
      setCenter(x, y, { zoom: Math.max(getZoom(), 1), duration: 400 });
      useCanvasStore.getState().setSelectedId(id);
    },
    [getNode, setCenter, getZoom],
  );
}

/**
 * Leva a câmera ao meio das duas pontas de uma transição e a seleciona: o
 * "ir para" da busca (D-43) e das entradas e saídas do localizador (D-44).
 */
export function useIrParaAresta(): (id: string, source: string, target: string) => void {
  const { getNode, setCenter, getZoom } = useReactFlow();
  return useCallback(
    (id: string, source: string, target: string) => {
      const centro = (noId: string) => {
        const n = getNode(noId);
        if (!n) return null;
        return {
          x: (n.positionAbsolute?.x ?? n.position.x) + (n.width ?? 180) / 2,
          y: (n.positionAbsolute?.y ?? n.position.y) + (n.height ?? 50) / 2,
        };
      };
      const a = centro(source);
      const b = centro(target);
      const alvo = a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : a ?? b;
      if (alvo) setCenter(alvo.x, alvo.y, { zoom: Math.max(getZoom(), 0.9), duration: 400 });
      useCanvasStore.getState().setSelectedId(id);
    },
    [getNode, setCenter, getZoom],
  );
}
