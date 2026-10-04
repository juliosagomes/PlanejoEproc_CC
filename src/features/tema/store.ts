import { create } from 'zustand';
import { loadTema, saveTema, type Tema } from '@/infra/storage/tema';

/**
 * Tema da interface (decisoes.md#D-34). O atributo `data-tema` no `<html>` é
 * quem pinta — os dois blocos de tokens de `index.css` respondem a ele. A store
 * existe para o que o CSS não alcança: as cores que o ReactFlow recebe como
 * string (pontas das setas, minimapa).
 */

export function aplicarTema(tema: Tema): void {
  document.documentElement.dataset.tema = tema;
}

interface TemaStore {
  tema: Tema;
  /** Lê a preferência gravada. Chamada depois que a plataforma de storage carrega. */
  hidratar: () => void;
  alternar: () => void;
}

export const useTemaStore = create<TemaStore>((set, get) => ({
  tema: 'escuro',
  hidratar: () => {
    const tema = loadTema();
    aplicarTema(tema);
    set({ tema });
  },
  alternar: () => {
    const tema: Tema = get().tema === 'escuro' ? 'claro' : 'escuro';
    aplicarTema(tema);
    saveTema(tema);
    set({ tema });
  },
}));
