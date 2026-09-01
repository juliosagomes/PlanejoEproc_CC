import { create } from 'zustand';
import {
  anotacaoVazia,
  anotacoesVazias,
  type AnotacaoRecurso,
  type AnotacoesCatalogo,
  type TipoRecurso,
} from '@/domain';
import { chaveAnotacao } from '@/infra/catalogo/chaveAnotacao';
import {
  clearAnotacoesCatalogo,
  loadAnotacoesCatalogo,
  saveAnotacoesCatalogo,
} from '@/infra/storage';

/* ============================================================================
 * STORE DAS ANOTAÇÕES DO CATÁLOGO (decisoes.md#D-25)
 *
 * Irmã de `store.ts` e `storeUnidade.ts`, e independente das duas de
 * propósito: as anotações são do usuário e sobrevivem a qualquer reimportação.
 * ========================================================================== */

interface AnotacoesState {
  anotacoes: AnotacoesCatalogo;
}

interface AnotacoesActions {
  hidratar: () => void;
  /** Grava (ou apaga, quando fica sem conteúdo) a anotação de um recurso. */
  definir: (
    tipo: TipoRecurso,
    nome: string,
    patch: Partial<Pick<AnotacaoRecurso, 'descricao' | 'orientacoes'>>,
  ) => void;
  limparTudo: () => void;
}

export type AnotacoesStore = AnotacoesState & AnotacoesActions;

/** Hidratada pelo `App` depois do primeiro render, como as outras duas stores. */
export const useAnotacoesStore = create<AnotacoesStore>((set, get) => ({
  anotacoes: anotacoesVazias(),

  hidratar: () => set({ anotacoes: loadAnotacoesCatalogo() }),

  definir: (tipo, nome, patch) => {
    const chave = chaveAnotacao(tipo, nome);
    const atual = get().anotacoes;
    const anterior = atual.itens[chave];
    const proximo: AnotacaoRecurso = {
      ...anterior,
      ...patch,
      atualizadoEm: new Date().toISOString(),
    };

    const itens = { ...atual.itens };
    // Anotação esvaziada é anotação apagada: deixá-la como registro em branco
    // encheria o storage de chaves mortas e ainda faria o catálogo marcar como
    // "anotado" um recurso que já não tem nada escrito.
    if (anotacaoVazia(proximo)) delete itens[chave];
    else itens[chave] = proximo;

    const anotacoes = { ...atual, itens };
    saveAnotacoesCatalogo(anotacoes);
    set({ anotacoes });
  },

  limparTudo: () => {
    clearAnotacoesCatalogo();
    set({ anotacoes: anotacoesVazias() });
  },
}));

/** A anotação de um recurso, ou `undefined` se não há nenhuma. */
export function buscarAnotacao(
  anotacoes: AnotacoesCatalogo,
  tipo: TipoRecurso,
  nome: string,
): AnotacaoRecurso | undefined {
  return anotacoes.itens[chaveAnotacao(tipo, nome)];
}

/**
 * Hook de conveniência para os pontos que só querem a anotação de um recurso —
 * a autocomplete do localizador e a linha do recurso no painel da aresta.
 */
export function useAnotacao(
  tipo: TipoRecurso,
  nome: string,
): AnotacaoRecurso | undefined {
  return useAnotacoesStore((s) => buscarAnotacao(s.anotacoes, tipo, nome));
}

/** Quantas anotações existem ao todo — o rodapé do modal usa para decidir se oferece "apagar". */
export function selectTotalAnotacoes(state: AnotacoesStore): number {
  return Object.keys(state.anotacoes.itens).length;
}
