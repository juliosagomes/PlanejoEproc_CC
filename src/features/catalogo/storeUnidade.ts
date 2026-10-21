import { create } from 'zustand';
import type { CatalogoUnidade, LocalizadorUnidade, RegraAtpUnidade } from '@/domain';
import { aplicarColeta, type ResumoColeta } from '@/infra/eproc/aplicarColeta';
import { aplicarRegrasAtpNoCatalogo } from '@/infra/eproc/aplicarRegrasAtp';
import type { ProgressoRegrasAtp } from '@/infra/eproc/tipos';
import {
  loadCatalogoUnidadeAtiva,
  saveCatalogoUnidade,
} from '@/infra/storage';

/* ============================================================================
 * STORE DO CATÁLOGO DA UNIDADE
 *
 * O irmão automático do `store.ts` (catálogo do XLS). Mantém em memória o
 * catálogo da última unidade sincronizada e expõe `sincronizar`.
 *
 * **`catalogo` nasce `null`, não lido do storage.** O `store.ts` lê no topo do
 * módulo, e isso é um bug na extensão: `main.tsx` importa `App` — e com ele toda
 * a árvore de stores — *antes* de `inicializarPlataforma()` resolver, então a
 * leitura acontece contra um `localStorage` vazio em vez do espelho do
 * `chrome.storage`. Aqui a hidratação é explícita, chamada pelo `App` depois do
 * primeiro render.
 * ========================================================================== */

interface UnidadeState {
  catalogo: CatalogoUnidade | null;
  sincronizando: boolean;
  erro: string | null;
  ultimoResumo: ResumoColeta | null;
  /** Só false enquanto ninguém chamou `hidratar`. */
  hidratado: boolean;
  /** "Regra N de M" do detalhe completo das regras de ATP, enquanto corre. */
  progressoAtp: ProgressoRegrasAtp | null;
}

export type ResultadoRegraAtp =
  | { ok: true; regra: RegraAtpUnidade }
  | { ok: false; erro: string };

interface UnidadeActions {
  hidratar: () => void;
  /**
   * `detalheAtp` abre o formulário de cada regra de ATP, o que leva minutos.
   * Sem ele vem só a lista, e o detalhe lido antes é mantido (D-46).
   */
  sincronizar: (opcoes?: { detalheAtp?: boolean }) => Promise<void>;
  /** Traz só uma regra de ATP, com o detalhe, e a grava no catálogo (D-46). */
  sincronizarRegraAtp: (numero: number) => Promise<ResultadoRegraAtp>;
  resetMensagens: () => void;
}

export type UnidadeStore = UnidadeState & UnidadeActions;

export const useUnidadeStore = create<UnidadeStore>((set, get) => ({
  catalogo: null,
  sincronizando: false,
  erro: null,
  ultimoResumo: null,
  hidratado: false,
  progressoAtp: null,

  hidratar: () => {
    set({ catalogo: loadCatalogoUnidadeAtiva(), hidratado: true });
  },

  sincronizar: async (opcoes) => {
    set({ sincronizando: true, erro: null, ultimoResumo: null, progressoAtp: null });
    try {
      // Import tardio: `@/extension/unidade` toca `chrome.*`, e carregá-lo no
      // topo faria o `npm run dev` (e os testes) puxarem a ponte sem necessidade.
      const { coletarDaUnidade, coletarRegrasAtp } = await import('@/extension/unidade');
      const coleta = await coletarDaUnidade();
      if (!coleta.erro) {
        // As regras vêm numa injeção à parte. Se ela falha, a fonte fica
        // marcada e o catálogo anterior cobre a falta (comReserva).
        try {
          const atp = await coletarRegrasAtp(opcoes?.detalheAtp ? 'todas' : [], (p) =>
            set({ progressoAtp: p }),
          );
          coleta.fontes.regrasAtp = atp.lista;
          coleta.detalhesAtp = atp.detalhes;
          coleta.falhasAtp = atp.falhas;
        } catch (err) {
          coleta.fontes.regrasAtp = {
            status: 'falhou',
            fragmentos: [],
            motivo: err instanceof Error ? err.message : String(err),
          };
        }
      }
      const resultado = aplicarColeta(coleta, undefined, get().catalogo);
      if (!resultado.ok) {
        set({ sincronizando: false, erro: resultado.erro });
        return;
      }
      saveCatalogoUnidade(resultado.catalogo);
      set({
        catalogo: resultado.catalogo,
        ultimoResumo: resultado.resumo,
        sincronizando: false,
        erro: null,
        progressoAtp: null,
      });
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Erro inesperado ao sincronizar com a unidade. Verifique o console.';
      if (!(err instanceof Error)) console.error('[unidade] sincronização falhou', err);
      set({ sincronizando: false, erro: msg, progressoAtp: null });
    }
  },

  sincronizarRegraAtp: async (numero) => {
    const atual = get().catalogo;
    if (!atual) {
      return { ok: false, erro: 'Sincronize com a unidade primeiro: a regra é lida da mesma unidade.' };
    }
    try {
      const { coletarRegrasAtp } = await import('@/extension/unidade');
      const coleta = await coletarRegrasAtp([numero]);
      const falha = coleta.falhas[numero];
      const r = aplicarRegrasAtpNoCatalogo(atual, coleta);
      if (r.erro) return { ok: false, erro: r.erro };
      // Releitura: outra sincronização pode ter gravado no meio do caminho.
      const base = get().catalogo ?? atual;
      const catalogo = base === atual ? r.catalogo : { ...base, regrasAtp: r.catalogo.regrasAtp };
      saveCatalogoUnidade(catalogo);
      set({ catalogo });
      const regra = catalogo.regrasAtp?.find((x) => x.numero === numero);
      if (!regra) return { ok: false, erro: falha ?? `A regra ${numero} não existe no Eproc.` };
      if (falha) return { ok: false, erro: falha };
      return { ok: true, regra };
    } catch (err) {
      return { ok: false, erro: err instanceof Error ? err.message : String(err) };
    }
  },

  resetMensagens: () => set({ erro: null, ultimoResumo: null }),
}));

/** Localizadores da unidade (vazio se nunca sincronizou). */
export function selectLocalizadoresUnidade(state: UnidadeStore): LocalizadorUnidade[] {
  return state.catalogo?.localizadores ?? [];
}
