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
