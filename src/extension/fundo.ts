import { findLotacao } from '@/infra/sync/lotacoes';
import type { LotacaoAlvo, ResumoSincronizacao } from '@/infra/sync/operacoes';
import { getUltimaLotacao } from '@/infra/sync/sessaoPersistida';

/* ============================================================================
 * DECISÕES DA SINCRONIZAÇÃO DE FUNDO
 *
 * Separadas de `background.ts` porque lá o módulo registra listeners de
 * `chrome.*` assim que é importado — o que torna o arquivo inteiro impossível
 * de carregar num teste. Aqui não há `chrome`: só storage (que o jsdom cobre) e
 * funções puras.
 * ========================================================================== */

/**
 * A lotação a sincronizar em segundo plano é **a última aberta**, não todas as
 * conhecidas: sincronizar N lotações a cada alarme multiplicaria o consumo da
 * cota do Apps Script para trazer planos que o usuário não está olhando
 * (apps-script/README.md, decisoes.md#D-13).
 *
 * `null` quando não há o que fazer: modo local, nunca entrou numa lotação, ou
 * a lotação foi esquecida — e aí o código de acesso foi embora junto.
 */
export function alvoDeFundo(): LotacaoAlvo | null {
  const workspaceId = getUltimaLotacao();
  if (workspaceId === null) return null;
  const conhecida = findLotacao(workspaceId);
  if (!conhecida) return null;
  return {
    workspaceId,
    codigo: conhecida.codigo,
    permissao: conhecida.permissao,
  };
}

/** Corpo da notificação. Vazio quando nada mudou — nesse caso não notificamos. */
export function textoDoResumo(r: ResumoSincronizacao): string {
  const partes: string[] = [];
  if (r.recebidos > 0) partes.push(`${r.recebidos} plano(s) novo(s)`);
  if (r.atualizados > 0) partes.push(`${r.atualizados} atualizado(s)`);
  if (r.removidos > 0) partes.push(`${r.removidos} removido(s)`);
  return partes.join(' · ');
}
