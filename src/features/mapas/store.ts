import { create } from 'zustand';
import {
  MAPA_VERSION,
  type FormatoMapa,
  type Mapa,
  type MapaIndexEntry,
} from '@/domain';
import { useCanvasStore } from '@/features/canvas/store';
import { excluirMapa, listMapas, loadMapa, saveMapa } from '@/infra/storage';
import { uid } from '@/utils/uid';
import { elementoTexto, htmlTitulo } from './gerar';

/* ============================================================================
 * STORE DOS MAPAS DESCRITIVOS (decisoes.md#D-39)
 *
 * Guarda o índice e o mapa aberto. Como o painel (D-33), é do silo e é
 * hidratada pela store de sessão a cada troca.
 *
 * A edição é digitação, não clique: as mudanças do mapa aberto esperam um
 * pouco antes de ir ao storage, e `flushMapas` força a gravação na troca de
 * mapa, de sessão e no `beforeunload`.
 *
 * Em sessão de visualização (D-19) nada aqui grava: o mapa abre para ler e
 * imprimir.
 * ========================================================================== */

const ESPERA_GRAVAR_MS = 500;

interface MapasState {
  indice: MapaIndexEntry[];
  aberto: Mapa | null;
  /** Localizadores escolhidos no quadro, à espera do diálogo de geração. */
  pedidoGeracao: string[] | null;
}

interface MapasActions {
  hidratar: () => void;
  limpar: () => void;
  abrir: (id: string) => void;
  criar: (formato: FormatoMapa) => void;
  /** Grava e abre um mapa já montado (o gerado a partir do fluxo). */
  adicionar: (mapa: Mapa) => void;
  /** Aplica uma mudança ao mapa aberto. */
  mudar: (fn: (m: Mapa) => Mapa) => void;
  renomear: (nome: string) => void;
  /** Devolve o mapa excluído, para o "desfazer". */
  excluir: (id: string) => Mapa | null;
  restaurar: (mapa: Mapa) => void;
  pedirGeracao: (ids: string[]) => void;
  fecharGeracao: () => void;
}

export type MapasStore = MapasState & MapasActions;

const agora = () => new Date().toISOString();
const somenteLeitura = () => useCanvasStore.getState().somenteLeitura;

let pendente: Mapa | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

/** Grava o mapa aberto que estiver esperando o debounce. */
export function flushMapas(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  if (pendente && !somenteLeitura()) saveMapa(pendente);
  pendente = null;
}

function agendar(mapa: Mapa, aoGravar: () => void): void {
  pendente = mapa;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    flushMapas();
    aoGravar();
  }, ESPERA_GRAVAR_MS);
}

export function mapaNovo(formato: FormatoMapa, nome: string): Mapa {
  const base = { version: MAPA_VERSION, id: uid('mapa'), nome, criadoEm: agora(), atualizadoEm: agora() };
  const convite = 'Escreva aqui. Digite @ para mencionar um localizador, uma preferência ou uma regra de ATP.';
  if (formato === 'retrato') {
    return { ...base, formato, html: `<h1>${nome}</h1><p>${convite}</p>` };
  }
  return {
    ...base,
    formato,
    slides: [
      {
        id: uid('slide'),
        elementos: [
          elementoTexto(48, 36, 1026, 80, htmlTitulo('Título do slide')),
          elementoTexto(48, 150, 700, 300, convite),
        ],
      },
    ],
  };
}

export const useMapasStore = create<MapasStore>((set, get) => {
  const refrescarIndice = () => set({ indice: listMapas() });

  return {
    indice: [],
    aberto: null,
    pedidoGeracao: null,

    hidratar: () => {
      flushMapas();
      const indice = listMapas();
      const primeiro = indice[0];
      set({ indice, aberto: primeiro ? loadMapa(primeiro.id) : null, pedidoGeracao: null });
    },

    limpar: () => {
      flushMapas();
      set({ indice: [], aberto: null, pedidoGeracao: null });
    },

    abrir: (id) => {
      if (get().aberto?.id === id) return;
      flushMapas();
      // Um mapa que não pôde ser lido foi para o backup; o índice precisa saber.
      set({ aberto: loadMapa(id), indice: listMapas() });
    },

    criar: (formato) => {
      if (somenteLeitura()) return;
      get().adicionar(mapaNovo(formato, formato === 'retrato' ? 'Documento sem título' : 'Mapa sem título'));
    },

    adicionar: (mapa) => {
      if (somenteLeitura()) return;
      flushMapas();
      saveMapa(mapa);
      set({ aberto: mapa, indice: listMapas() });
    },

    mudar: (fn) => {
      const atual = get().aberto;
      if (!atual || somenteLeitura()) return;
      const novo = { ...fn(atual), atualizadoEm: agora() };
      set({ aberto: novo });
      agendar(novo, refrescarIndice);
    },

    renomear: (nome) => {
      get().mudar((m) => ({ ...m, nome }));
    },

    excluir: (id) => {
      if (somenteLeitura()) return null;
      if (get().aberto?.id === id) {
        if (timer) clearTimeout(timer);
        timer = null;
        pendente = null;
      } else {
        flushMapas();
      }
      const mapa = get().aberto?.id === id ? get().aberto : loadMapa(id);
      excluirMapa(id);
      const indice = listMapas();
      const aberto = get().aberto?.id === id ? (indice[0] ? loadMapa(indice[0].id) : null) : get().aberto;
      set({ indice, aberto });
      return mapa;
    },

    restaurar: (mapa) => get().adicionar(mapa),

    pedirGeracao: (ids) => set({ pedidoGeracao: ids }),
    fecharGeracao: () => set({ pedidoGeracao: null }),
  };
});
