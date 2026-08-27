import type { Permissao } from '@/domain';
import { listPlanos, loadPlano } from '@/infra/storage';
import { aplicarSincronizacao, type ResumoSincronizacao } from './aplicar';
import { publicar as publicarApi, sincronizar as sincronizarApi } from './client';
import type { PlanoParaPublicar } from './client';
import { limparTombstones, listTombstones } from './lotacoes';
import { marcarSincronizacao } from './sessaoPersistida';
import { findEntradaPorLocal, registrarEntrada } from './syncMap';

/* ============================================================================
 * OPERAÇÕES DE SINCRONIZAÇÃO — sem UI
 *
 * Pull e push, recebendo a lotação por parâmetro em vez de lê-la de uma store.
 * Existem separados de `features/sync/store.ts` porque o **service worker** da
 * extensão precisa executar exatamente esta lógica, e lá não há React, Zustand
 * nem DOM (decisoes.md#D-13).
 *
 * Pressupõem que o escopo de armazenamento já aponta para o silo da lotação
 * (`setEscopo({ tipo: 'lotacao', workspaceId })`) — quem chama é que sabe se
 * está trocando de sessão ou agindo sobre a corrente.
 * ========================================================================== */

export interface LotacaoAlvo {
  workspaceId: string;
  codigo: string;
  permissao: Permissao;
}

export interface ResumoPublicacao {
  enviados: number;
  removidos: number;
}

export type { ResumoSincronizacao };

/**
 * Traz tudo da lotação, sobrescrevendo o local. Política e garantias (o
 * servidor manda; rascunhos nunca publicados são preservados) estão em
 * `aplicar.ts`.
 */
export async function pull(alvo: LotacaoAlvo): Promise<ResumoSincronizacao> {
  const { planos } = await sincronizarApi(alvo.codigo);
  const resumo = aplicarSincronizacao(planos, alvo.codigo);
  marcarSincronizacao();
  return resumo;
}

/**
 * Manda todos os planos do silo e propaga as exclusões pendentes.
 *
 * Devolve `null` sem tocar na rede quando a permissão é de leitura — o servidor
 * recusaria de todo jeito, e falhar aqui evita gastar uma chamada da cota para
 * receber um erro previsível.
 */
export async function push(alvo: LotacaoAlvo): Promise<ResumoPublicacao | null> {
  if (alvo.permissao !== 'edicao') return null;

  const entradas = listPlanos();
  // Plano ainda sem `remotoId` está sendo publicado pela primeira vez: o UUID
  // nasce aqui e é reenviado nas próximas vezes, para o servidor atualizar no
  // lugar em vez de duplicar.
  const payload: PlanoParaPublicar[] = entradas.map((e) => ({
    remotoId: findEntradaPorLocal(e.id)?.remotoId ?? crypto.randomUUID(),
    plano: loadPlano(e.id),
  }));
  const remover = listTombstones(alvo.workspaceId);

  await publicarApi(alvo.codigo, payload, remover);

  const quando = new Date().toISOString();
  entradas.forEach((entrada, i) => {
    registrarEntrada({
      localId: entrada.id,
      remotoId: payload[i]!.remotoId,
      workspaceCodigo: alvo.codigo,
      papel: 'dono',
      ultimaSincronizacao: quando,
    });
  });
  // Só limpa depois do sucesso: se a chamada falhar, as exclusões continuam
  // pendentes e vão junto na próxima tentativa.
  limparTombstones(alvo.workspaceId);
  marcarSincronizacao();

  return { enviados: payload.length, removidos: remover.length };
}

/** `true` quando o pull trouxe alguma diferença — base para notificar. */
export function houveMudanca(resumo: ResumoSincronizacao): boolean {
  return resumo.recebidos + resumo.atualizados + resumo.removidos > 0;
}
