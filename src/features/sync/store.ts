import { create } from 'zustand';
import { useSessaoStore } from '@/features/sessao/store';
import { excluirPlano, listPlanos, loadPlano } from '@/infra/storage';
import {
  SyncError,
  publicar as publicarApi,
  sincronizar as sincronizarApi,
  type PlanoParaPublicar,
} from '@/infra/sync/client';
import {
  limparTombstones,
  listTombstones,
  registrarExclusaoLocal,
} from '@/infra/sync/lotacoes';
import {
  findEntradaPorLocal,
  registrarEntrada,
  removerEntradaPorLocal,
} from '@/infra/sync/syncMap';
import { aplicarSincronizacao, type ResumoSincronizacao } from './aplicar';

/* ============================================================================
 * STORE DE SINCRONIZAÇÃO
 *
 * Dois botões, sem escolhas intermediárias — a lotação É o conjunto:
 *
 *  - Baixar do servidor (pull): traz tudo da lotação, sobrescrevendo o local.
 *  - Enviar ao servidor (push): manda todos os planos da lotação e propaga as
 *    exclusões feitas aqui. Só existe com código de edição.
 *
 * A sessão corrente vem de `features/sessao/store` — esta store não decide em
 * qual lotação está, só age sobre ela.
 * ========================================================================== */

export interface ResumoPublicacao {
  enviados: number;
  removidos: number;
}

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

function sessaoLotacao() {
  const { sessao } = useSessaoStore.getState();
  return sessao?.tipo === 'lotacao' ? sessao : null;
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
    const sessao = sessaoLotacao();
    if (!sessao) return;

    set({ sincronizando: true, ultimoErro: null, ultimoPull: null, ultimoPush: null });
    try {
      const { planos } = await sincronizarApi(sessao.codigo);
      const resumo = aplicarSincronizacao(planos, sessao.codigo);
      set({ ultimoPull: resumo });
    } catch (err) {
      set({ ultimoErro: mensagemDeErro(err, 'Erro inesperado ao baixar do servidor.') });
    } finally {
      set({ sincronizando: false });
    }
  },

  enviarAoServidor: async () => {
    const sessao = sessaoLotacao();
    if (!sessao || sessao.permissao !== 'edicao') return;

    set({ publicando: true, ultimoErro: null, ultimoPull: null, ultimoPush: null });
    try {
      const entradas = listPlanos();
      // Plano ainda sem `remotoId` está sendo publicado pela primeira vez: o
      // UUID nasce aqui e é reenviado nas próximas vezes, para o servidor
      // atualizar no lugar em vez de duplicar.
      const payload: PlanoParaPublicar[] = entradas.map((e) => ({
        remotoId: findEntradaPorLocal(e.id)?.remotoId ?? crypto.randomUUID(),
        plano: loadPlano(e.id),
      }));
      const remover = listTombstones(sessao.workspaceId);

      await publicarApi(sessao.codigo, payload, remover);

      const quando = new Date().toISOString();
      entradas.forEach((entrada, i) => {
        registrarEntrada({
          localId: entrada.id,
          remotoId: payload[i]!.remotoId,
          workspaceCodigo: sessao.codigo,
          papel: 'dono',
          ultimaSincronizacao: quando,
        });
      });
      // Só limpa depois do sucesso: se a chamada falhar, as exclusões
      // continuam pendentes e vão junto na próxima tentativa.
      limparTombstones(sessao.workspaceId);

      set({ ultimoPush: { enviados: payload.length, removidos: remover.length } });
    } catch (err) {
      set({ ultimoErro: mensagemDeErro(err, 'Erro inesperado ao enviar ao servidor.') });
    } finally {
      set({ publicando: false });
    }
  },

  excluirPlanoDaSessao: (localId) => {
    const sessao = sessaoLotacao();
    if (sessao) {
      // A ordem importa: o tombstone precisa do `remotoId`, que só existe no
      // mapa até a linha seguinte.
      registrarExclusaoLocal(sessao.workspaceId, localId);
      removerEntradaPorLocal(localId);
    }
    excluirPlano(localId);
  },

  resetMensagens: () => set({ ultimoErro: null, ultimoPull: null, ultimoPush: null }),
}));
