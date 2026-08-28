import { create } from 'zustand';
import type { Sessao } from '@/domain';
import { flushPersist, useCanvasStore } from '@/features/canvas/store';
import { aplicarSincronizacao, garantirAtivoValido } from '@/infra/sync/aplicar';
import {
  criarPlano,
  importarPlano,
  listPlanos,
  loadPlano,
  planoVazio,
  setEscopo,
} from '@/infra/storage';
import {
  SyncError,
  criarWorkspace as criarWorkspaceApi,
  sincronizar as sincronizarApi,
  type PlanoParaPublicar,
} from '@/infra/sync/client';
import {
  esquecerLotacao,
  listLotacoes,
  registrarLotacao,
  type LotacaoConhecida,
} from '@/infra/sync/lotacoes';
import {
  getUltimaLotacao,
  limparUltimaLotacao,
  setUltimaLotacao,
} from '@/infra/sync/sessaoPersistida';
import { registrarEntrada } from '@/infra/sync/syncMap';
import { lerPlanosLocais } from './planosLocais';

/* ============================================================================
 * STORE DE SESSÃO
 *
 * Dona do contexto em que o app roda: modo local ou uma lotação. É o único
 * lugar que chama `setEscopo` — todo o resto do app lê o silo já apontado.
 *
 * Sequência invariável ao trocar de contexto:
 *   1. flushPersist()  → grava o que estava pendente no silo que está saindo
 *   2. setEscopo(...)  → aponta para o silo novo
 *   3. loadPlano(...)  → traz o ativo do silo novo para o canvas
 *
 * Pular o passo 1 perde a última edição; inverter 2 e 3 grava no silo errado.
 * ========================================================================== */

export interface CodigosNovaLotacao {
  nome: string;
  codigoLeitura: string;
  codigoEdicao: string;
}

interface SessaoState {
  sessao: Sessao | null;
  entrando: boolean;
  erro: string | null;
  lotacoes: LotacaoConhecida[];
  /**
   * Códigos de uma lotação recém-criada. Ficam aqui porque o servidor não os
   * devolve nunca mais (não há endpoint de consulta — decisoes.md#D-8): a
   * tela precisa exibi-los enquanto o usuário não confirmar que anotou.
   */
  codigosNovaLotacao: CodigosNovaLotacao | null;
}

interface SessaoActions {
  entrarLocal: () => void;
  /** Resolve `true` quando entrou; `false` deixa a tela de login com `erro` preenchido. */
  entrarComCodigo: (codigo: string) => Promise<boolean>;
  /** `levarPlanosLocais` copia para a lotação nova os planos do modo local. */
  criarLotacao: (nome: string, levarPlanosLocais: boolean) => Promise<boolean>;
  sair: () => void;
  esquecer: (workspaceId: string) => void;
  resetMensagens: () => void;
  dispensarCodigos: () => void;
}

export type SessaoStore = SessaoState & SessaoActions;

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Traz o plano ativo do silo corrente para o canvas.
 *
 * Silo vazio (primeira entrada, ou lotação recém-criada) ganha um plano em
 * branco já registrado no índice, em vez de só carregar um `planoVazio()` na
 * memória: sem a entrada, o seletor de planos diria "nenhum plano salvo"
 * enquanto o usuário edita, até o primeiro save com debounce criá-la. Numa
 * sessão de visualização isso não vale — não há edição para acompanhar, e
 * criar plano seria a primeira escrita de um modo que promete não escrever.
 *
 * O `setSomenteLeitura` vem **antes** do `loadPlano`: a assinatura de
 * persistência dispara no carregamento, e ela decide olhando essa flag.
 */
function carregarAtivoNoCanvas(somenteLeitura: boolean): void {
  const canvas = useCanvasStore.getState();
  canvas.setSomenteLeitura(somenteLeitura);

  garantirAtivoValido();
  if (listPlanos().length === 0) {
    if (somenteLeitura) {
      canvas.loadPlano(planoVazio());
      return;
    }
    const { plano } = criarPlano();
    canvas.loadPlano(plano);
    return;
  }
  canvas.loadPlano(loadPlano());
}

function mensagemDeErro(err: unknown, fallback: string): string {
  if (err instanceof SyncError) return err.message;
  console.error('[sessao]', fallback, err);
  return fallback;
}

export const useSessaoStore = create<SessaoStore>((set) => ({
  sessao: null,
  entrando: false,
  erro: null,
  lotacoes: listLotacoes(),
  codigosNovaLotacao: null,

  entrarLocal: () => {
    flushPersist();
    setEscopo({ tipo: 'local' });
    // Modo local é offline por definição: apagar a marca impede que o service
    // worker continue sincronizando uma lotação que o usuário deixou para trás.
    limparUltimaLotacao();
    carregarAtivoNoCanvas(false);
    set({ sessao: { tipo: 'local' }, erro: null, codigosNovaLotacao: null });
  },

  entrarComCodigo: async (codigo) => {
    const codigoLimpo = codigo.trim();
    if (!codigoLimpo) return false;

    set({ entrando: true, erro: null });
    try {
      // Sincroniza ANTES de trocar o escopo: só sabemos qual silo abrir
      // depois que o servidor devolve o `workspaceId`.
      const { workspaceId, nome, planos, permissao, codigoLeitura } =
        await sincronizarApi(codigoLimpo);

      flushPersist();
      setEscopo({ tipo: 'lotacao', workspaceId });
      aplicarSincronizacao(planos, codigoLimpo);
      carregarAtivoNoCanvas(permissao === 'leitura');

      registrarLotacao({
        workspaceId,
        nome,
        codigo: codigoLimpo,
        permissao,
        ultimoAcesso: nowIso(),
      });
      setUltimaLotacao(workspaceId);

      set({
        sessao: {
          tipo: 'lotacao',
          workspaceId,
          nome,
          codigo: codigoLimpo,
          codigoLeitura,
          permissao,
        },
        lotacoes: listLotacoes(),
        codigosNovaLotacao: null,
      });
      return true;
    } catch (err) {
      set({ erro: mensagemDeErro(err, 'Erro inesperado ao entrar na lotação.') });
      return false;
    } finally {
      set({ entrando: false });
    }
  },

  criarLotacao: async (nome, levarPlanosLocais) => {
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) return false;

    set({ entrando: true, erro: null });
    try {
      flushPersist();

      // Os `remotoId` são gerados aqui e reenviados nas publicações seguintes,
      // para o servidor fazer upsert no lugar (mesma convenção do push).
      const paraLevar: PlanoParaPublicar[] = levarPlanosLocais
        ? lerPlanosLocais().map((plano) => ({ remotoId: crypto.randomUUID(), plano }))
        : [];

      const { workspaceId, codigoLeitura, codigoEdicao } = await criarWorkspaceApi(
        nomeLimpo,
        paraLevar,
      );

      setEscopo({ tipo: 'lotacao', workspaceId });

      // A lotação nasce vazia no silo local; os planos levados são importados
      // aqui com o mesmo `remotoId` que foi ao servidor, então o próximo push
      // atualiza no lugar em vez de duplicar.
      const quando = nowIso();
      for (const item of paraLevar) {
        const { id } = importarPlano(item.plano);
        registrarEntrada({
          localId: id,
          remotoId: item.remotoId,
          workspaceCodigo: codigoEdicao,
          papel: 'dono',
          ultimaSincronizacao: quando,
        });
      }
      carregarAtivoNoCanvas(false);

      registrarLotacao({
        workspaceId,
        nome: nomeLimpo,
        codigo: codigoEdicao,
        permissao: 'edicao',
        ultimoAcesso: quando,
      });
      setUltimaLotacao(workspaceId);

      set({
        sessao: {
          tipo: 'lotacao',
          workspaceId,
          nome: nomeLimpo,
          codigo: codigoEdicao,
          codigoLeitura,
          permissao: 'edicao',
        },
        lotacoes: listLotacoes(),
        codigosNovaLotacao: { nome: nomeLimpo, codigoLeitura, codigoEdicao },
      });
      return true;
    } catch (err) {
      set({ erro: mensagemDeErro(err, 'Erro inesperado ao criar a lotação.') });
      return false;
    } finally {
      set({ entrando: false });
    }
  },

  sair: () => {
    flushPersist();
    setEscopo(null);
    limparUltimaLotacao();
    // Canvas em branco: com escopo null nenhuma escrita acontece, então isto
    // não apaga nada — só evita que os nós da sessão anterior apareçam por
    // trás da tela de login.
    useCanvasStore.getState().setSomenteLeitura(false);
    useCanvasStore.getState().loadPlano(planoVazio());
    set({
      sessao: null,
      erro: null,
      codigosNovaLotacao: null,
      lotacoes: listLotacoes(),
    });
  },

  esquecer: (workspaceId) => {
    esquecerLotacao(workspaceId);
    // Sem o código guardado não há como sincronizar; deixar a marca apontando
    // para ela faria o service worker tentar e falhar a cada alarme.
    if (getUltimaLotacao() === workspaceId) limparUltimaLotacao();
    set({ lotacoes: listLotacoes() });
  },

  resetMensagens: () => set({ erro: null }),

  dispensarCodigos: () => set({ codigosNovaLotacao: null }),
}));

/** Conveniência para quem só precisa saber se pode publicar. */
export function selectPodeEditar(s: SessaoStore): boolean {
  return s.sessao?.tipo === 'lotacao' && s.sessao.permissao === 'edicao';
}

export type { LotacaoConhecida };
