import {
  excluirPlano,
  getAtivoId,
  importarPlano,
  listPlanos,
  setAtivo,
  sobrescreverPlano,
} from '@/infra/storage';
import type { SincronizarPlanoItem } from '@/infra/sync/syncSchema';
import {
  atualizarUltimaSincronizacao,
  findEntradaPorLocal,
  findEntradaPorRemoto,
  registrarEntrada,
  removerEntradaPorLocal,
} from '@/infra/sync/syncMap';

/**
 * Aplica o resultado de um `sincronizar` (pull) no silo da sessão corrente.
 * Usado tanto ao entrar numa lotação quanto pelo botão "Baixar do servidor" —
 * é a mesma operação, só muda o gatilho.
 *
 * Política: **o servidor manda**. Plano já conhecido é sobrescrito no lugar
 * (não duplica); plano que sumiu do servidor é apagado localmente (é o outro
 * lado da propagação de exclusões do push). Planos criados aqui e nunca
 * publicados não têm `remotoId` mapeado e são preservados — ninguém perde
 * rascunho por ter clicado em "Baixar".
 */

export interface ResumoSincronizacao {
  recebidos: number;
  atualizados: number;
  removidos: number;
}

export function aplicarSincronizacao(
  planos: SincronizarPlanoItem[],
  codigo: string,
): ResumoSincronizacao {
  const quando = new Date().toISOString();
  let recebidos = 0;
  let atualizados = 0;

  const idsLocaisAntes = new Set(listPlanos().map((p) => p.id));

  for (const item of planos) {
    const existente = findEntradaPorRemoto(item.remotoId);
    // A entrada do mapa pode apontar para um plano de outro silo (ou para um
    // que o usuário apagou por fora): só sobrescrevemos se o id realmente
    // existe aqui — caso contrário, importamos como novo.
    if (existente && idsLocaisAntes.has(existente.localId)) {
      sobrescreverPlano(existente.localId, item.plano);
      atualizarUltimaSincronizacao(item.remotoId, quando, item.atualizadoEm);
      atualizados += 1;
    } else {
      const { id } = importarPlano(item.plano);
      registrarEntrada({
        localId: id,
        remotoId: item.remotoId,
        workspaceCodigo: codigo,
        papel: 'assinante',
        ultimaSincronizacao: quando,
        remotoAtualizadoEm: item.atualizadoEm,
      });
      recebidos += 1;
    }
  }

  const remotosRecebidos = new Set(planos.map((p) => p.remotoId));
  let removidos = 0;
  for (const localId of idsLocaisAntes) {
    const entrada = findEntradaPorLocal(localId);
    if (!entrada) continue; // nunca publicado — rascunho local, preservar
    if (remotosRecebidos.has(entrada.remotoId)) continue;
    excluirPlano(localId);
    removerEntradaPorLocal(localId);
    removidos += 1;
  }

  garantirAtivoValido();

  return { recebidos, atualizados, removidos };
}

/**
 * O mesmo cálculo de `aplicarSincronizacao`, **sem aplicar nada**: responde
 * "o que mudaria se eu baixasse agora?".
 *
 * É o que sustenta a verificação de fundo do D-17. A extensão não baixa mais
 * sozinha — ela pergunta, compara e avisa; quem decide quando trazer é o
 * usuário, no botão "Baixar do servidor".
 *
 * Diferença que importa em relação a `aplicarSincronizacao`: lá todo plano
 * conhecido conta como "atualizado", porque o pull sobrescreve sem perguntar.
 * Aqui só conta quem tem carimbo de servidor **diferente** do que guardamos —
 * caso contrário toda verificação anunciaria mudança e a notificação viraria
 * ruído em poucas horas.
 *
 * Pressupõe o escopo já apontado para o silo da lotação, como o resto daqui.
 */
export function diffSincronizacao(
  planos: SincronizarPlanoItem[],
): ResumoSincronizacao {
  const idsLocais = new Set(listPlanos().map((p) => p.id));
  let recebidos = 0;
  let atualizados = 0;

  for (const item of planos) {
    const existente = findEntradaPorRemoto(item.remotoId);
    if (!existente || !idsLocais.has(existente.localId)) {
      recebidos += 1;
      continue;
    }
    // Comparação por igualdade, não por ordem: o carimbo é uma string opaca do
    // servidor, e "diferente do que tenho" é exatamente a pergunta.
    if (existente.remotoAtualizadoEm !== item.atualizadoEm) atualizados += 1;
  }

  const remotosRecebidos = new Set(planos.map((p) => p.remotoId));
  let removidos = 0;
  for (const localId of idsLocais) {
    const entrada = findEntradaPorLocal(localId);
    if (!entrada) continue; // rascunho nunca publicado — o servidor não o conhece
    if (!remotosRecebidos.has(entrada.remotoId)) removidos += 1;
  }

  return { recebidos, atualizados, removidos };
}

/**
 * Depois de importar/excluir em lote, o ponteiro de plano ativo pode estar
 * apontando para nada (silo recém-populado) ou para um plano excluído.
 * Fixa no mais recente do que sobrou.
 */
export function garantirAtivoValido(): void {
  const index = listPlanos();
  if (index.length === 0) return;
  const ativo = getAtivoId();
  if (ativo !== null && index.some((e) => e.id === ativo)) return;
  const maisRecente = [...index].sort((a, b) =>
    b.atualizadoEm.localeCompare(a.atualizadoEm),
  )[0];
  if (maisRecente) setAtivo(maisRecente.id);
}
