import { create } from 'zustand';
import {
  chaveLocalizador,
  painelVazio,
  type FilaTrabalho,
  type OrigemFila,
  type PainelUnidade,
} from '@/domain';
import { useCanvasStore } from '@/features/canvas/store';
import { loadPainel, savePainel } from '@/infra/storage';
import { uid } from '@/utils/uid';

/* ============================================================================
 * STORE DO PAINEL DA UNIDADE (decisoes.md#D-33)
 *
 * Dona das filas de trabalho, dos grupos de preferências e dos localizadores
 * deixados de fora. Como os setores (D-26), mora numa chave por silo e é
 * hidratada pela store de sessão a cada troca.
 *
 * Toda ação passa por `mudar`, que recusa em sessão de visualização (D-19) e
 * grava na hora — não há debounce: as mudanças são cliques, não digitação.
 * ========================================================================== */

export interface NovaFila {
  nome: string;
  origem: OrigemFila;
  setorId: string;
  grupoId?: string;
  ja_criado: boolean;
}

interface PainelState {
  painel: PainelUnidade;
}

interface PainelActions {
  hidratar: () => void;
  limpar: () => void;
  criarFila: (dados: NovaFila) => void;
  atualizarFila: (id: string, patch: Partial<Omit<FilaTrabalho, 'id'>>) => void;
  removerFila: (id: string) => void;
  /** `null` tira a fila do grupo. */
  definirGrupo: (filaId: string, grupoId: string | null) => void;
  incluirLocalizador: (filaId: string, nome: string) => void;
  tirarLocalizador: (filaId: string, nome: string) => void;
  deixarDeFora: (nome: string, motivo: string) => void;
  desfazerFora: (nome: string) => void;
  /**
   * Devolve o id do grupo com esse nome, criando-o se preciso — os nomes que
   * vêm do Eproc não podem duplicar o grupo que o usuário já criou à mão.
   * `''` para nome vazio ou sessão de visualização.
   */
  criarGrupo: (nome: string) => string;
  removerGrupo: (id: string) => void;
}

export type PainelStore = PainelState & PainelActions;

const mesmo = (a: string) => (b: string) => chaveLocalizador(a) === chaveLocalizador(b);

export const usePainelStore = create<PainelStore>((set, get) => {
  const mudar = (fn: (p: PainelUnidade) => PainelUnidade) => {
    if (useCanvasStore.getState().somenteLeitura) return;
    const painel = fn(get().painel);
    set({ painel });
    savePainel(painel);
  };
  const mudarFila = (id: string, fn: (f: FilaTrabalho) => FilaTrabalho) =>
    mudar((p) => ({ ...p, filas: p.filas.map((f) => (f.id === id ? fn(f) : f)) }));

  return {
    painel: painelVazio(),

    hidratar: () => set({ painel: loadPainel() ?? painelVazio() }),
    limpar: () => set({ painel: painelVazio() }),

    criarFila: (dados) => {
      const nome = dados.nome.trim();
      if (!nome) return;
      const { grupoId, ...resto } = dados;
      const fila: FilaTrabalho = {
        ...resto,
        nome,
        id: uid('fila'),
        localizadores: [],
        ...(grupoId ? { grupoId } : {}),
      };
      mudar((p) => ({ ...p, filas: [...p.filas, fila] }));
    },

    atualizarFila: (id, patch) => mudarFila(id, (f) => ({ ...f, ...patch })),

    removerFila: (id) => mudar((p) => ({ ...p, filas: p.filas.filter((f) => f.id !== id) })),

    definirGrupo: (filaId, grupoId) =>
      mudarFila(filaId, (f) => {
        const { grupoId: _, ...semGrupo } = f;
        return grupoId ? { ...semGrupo, grupoId } : semGrupo;
      }),

    incluirLocalizador: (filaId, nome) =>
      mudarFila(filaId, (f) =>
        f.localizadores.some(mesmo(nome)) ? f : { ...f, localizadores: [...f.localizadores, nome] },
      ),

    tirarLocalizador: (filaId, nome) =>
      mudarFila(filaId, (f) => ({
        ...f,
        localizadores: f.localizadores.filter((n) => !mesmo(nome)(n)),
      })),

    deixarDeFora: (nome, motivo) => {
      const m = motivo.trim();
      if (!m) return;
      mudar((p) => ({
        ...p,
        foraDasFilas: [...p.foraDasFilas.filter((f) => !mesmo(nome)(f.nome)), { nome, motivo: m }],
      }));
    },

    desfazerFora: (nome) =>
      mudar((p) => ({ ...p, foraDasFilas: p.foraDasFilas.filter((f) => !mesmo(nome)(f.nome)) })),

    criarGrupo: (nome) => {
      const n = nome.trim();
      if (!n || useCanvasStore.getState().somenteLeitura) return '';
      const existente = get().painel.grupos.find((g) => mesmo(n)(g.nome));
      if (existente) return existente.id;
      const id = uid('grupo');
      mudar((p) => ({ ...p, grupos: [...p.grupos, { id, nome: n }] }));
      return id;
    },

    removerGrupo: (id) =>
      mudar((p) => ({
        ...p,
        grupos: p.grupos.filter((g) => g.id !== id),
        filas: p.filas.map((f) => {
          if (f.grupoId !== id) return f;
          const { grupoId: _, ...semGrupo } = f;
          return semGrupo;
        }),
      })),
  };
});
