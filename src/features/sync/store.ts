import { create } from 'zustand';
import { useSessaoStore } from '@/features/sessao/store';
import { excluirPlano } from '@/infra/storage';
import { SyncError } from '@/infra/sync/client';
import { registrarExclusaoLocal } from '@/infra/sync/lotacoes';
import {
  pull,
  push,
  type LotacaoAlvo,
  type ResumoPublicacao,
  type ResumoSincronizacao,
} from '@/infra/sync/operacoes';
import { removerEntradaPorLocal } from '@/infra/sync/syncMap';

/* ============================================================================
 * STORE DE SINCRONIZAÇÃO
 *
 * Dois botões, sem escolhas intermediárias — a lotação É o conjunto:
 *
 *  - Baixar do servidor (pull): traz tudo da lotação, sobrescrevendo o local.
 *  - Enviar ao servidor (push): manda todos os planos da lotação e propaga as
 *    exclusões feitas aqui. Só existe com código de edição.
 *
 * A lógica de verdade mora em `infra/sync/operacoes` (compartilhada com o
 * service worker da extensão — decisoes.md#D-13); esta store só resolve *qual*
 * lotação é a corrente e guarda o estado que a UI pinta.
 * ========================================================================== */

export type { ResumoPublicacao };

interface SyncState {
  publicando: boolean;
  sincronizando: boolean;
  ultimoErro: string | null;
  ultimoPull: ResumoSincronizacao | null;
  ultimoPush: ResumoPublicacao | null;
}

interface SyncActions {
  baixarDoServidor: () => Promise<void>;
  enviarAoServidor: () => Promise<void>;
  /** Exclui um plano da lotação marcando a exclusão para propagar no próximo push. */
  excluirPlanoDaSessao: (localId: string) => void;
  resetMensagens: () => void;
}

export type SyncStore = SyncState & SyncActions;

function alvoDaSessao(): LotacaoAlvo | null {
  const { sessao } = useSessaoStore.getState();
  if (sessao?.tipo !== 'lotacao') return null;
  return {
    workspaceId: sessao.workspaceId,
    codigo: sessao.codigo,
    permissao: sessao.permissao,
  };
}

function mensagemDeErro(err: unknown, fallback: string): string {
  if (err instanceof SyncError) return err.message;
  console.error('[sync]', fallback, err);
  return fallback;
}

export const useSyncStore = create<SyncStore>((set) => ({
  publicando: false,
  sincronizando: false,
  ultimoErro: null,
  ultimoPull: null,
  ultimoPush: null,

  baixarDoServidor: async () => {
    const alvo = alvoDaSessao();
    if (!alvo) return;

    set({ sincronizando: true, ultimoErro: null, ultimoPull: null, ultimoPush: null });
    try {
      set({ ultimoPull: await pull(alvo) });
    } catch (err) {
      set({ ultimoErro: mensagemDeErro(err, 'Erro inesperado ao baixar do servidor.') });
    } finally {
      set({ sincronizando: false });
    }
  },

  enviarAoServidor: async () => {
    const alvo = alvoDaSessao();
    if (!alvo) return;

    set({ publicando: true, ultimoErro: null, ultimoPull: null, ultimoPush: null });
    try {
      const resumo = await push(alvo);
      if (resumo) set({ ultimoPush: resumo });
    } catch (err) {
      set({ ultimoErro: mensagemDeErro(err, 'Erro inesperado ao enviar ao servidor.') });
    } finally {
      set({ publicando: false });
    }
  },

  excluirPlanoDaSessao: (localId) => {
    const alvo = alvoDaSessao();
    if (alvo) {
      // A ordem importa: o tombstone precisa do `remotoId`, que só existe no
      // mapa até a linha seguinte.
      registrarExclusaoLocal(alvo.workspaceId, localId);
      removerEntradaPorLocal(localId);
    }
    excluirPlano(localId);
  },

  resetMensagens: () => set({ ultimoErro: null, ultimoPull: null, ultimoPush: null }),
}));
