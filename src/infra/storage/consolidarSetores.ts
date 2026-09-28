import {
  SETORES_VERSION,
  fundirSetores,
  setoresPadrao,
  type DefinicaoFlag,
  type Localizador,
  type Plano,
} from '@/domain';
import { loadSetores, saveSetores } from './setores';
import { listPlanos, loadPlano, sobrescreverPlano } from './storage';

/**
 * Reúne, numa lista só, os setores da unidade e os retratos guardados dentro de
 * cada plano do silo (decisoes.md#D-26).
 *
 * Uma função só faz dois trabalhos que são o mesmo trabalho:
 *
 * - **Migração.** Na primeira execução depois do D-26 não há chave de setores, e
 *   cada plano traz a lista que era dele. Fundidas por rótulo, "Setor de
 *   Cálculo" criado em dois planos vira um setor só, e os nós dos dois passam a
 *   apontar para o id sobrevivente.
 * - **Absorção.** Todo plano que entra de fora — arquivo importado, pull da
 *   lotação — traz o retrato da unidade de origem. É por aí que a lista se
 *   propaga entre colegas, sem endpoint novo no Apps Script.
 *
 * Idempotente **e econômica**: só grava quando algo mudou de fato. Reescrever
 * plano à toa carimbaria `atualizadoEm` no índice e faria a publicação seguinte
 * anunciar mudança em tudo.
 *
 * Pressupõe o escopo já apontado para o silo (ver `escopo.ts`).
 */

export interface OpcoesConsolidacao {
  /**
   * Sessão de visualização (D-19): o cálculo acontece igual, mas em memória.
   * Ver quem trabalha o quê é leitura; consolidar a lista da lotação de outra
   * pessoa seria a primeira escrita de um modo que promete não escrever.
   */
  somenteLeitura: boolean;
}

/** Aplica o remapeamento de ids nos nós. Devolve `null` quando nada mudou. */
function remapearNos(
  nodes: readonly Localizador[],
  remap: ReadonlyMap<string, string>,
): Localizador[] | null {
  if (remap.size === 0) return null;

  let mudou = false;
  const novos = nodes.map((n) => {
    if (!n.data.flags.some((id) => remap.has(id))) return n;
    mudou = true;
    // `Set` para o caso de o remapeamento colidir dois ids no mesmo
    // sobrevivente: o nó marcado com "Cálculo" e "CALCULO" fica com um chip só.
    const flags = [...new Set(n.data.flags.map((id) => remap.get(id) ?? id))];
    return { ...n, data: { ...n.data, flags } };
  });

  return mudou ? novos : null;
}

/** `true` quando o retrato guardado no plano já não corresponde à lista. */
function retratoDefasado(plano: Plano, lista: readonly DefinicaoFlag[]): boolean {
  if (plano.flags.length !== lista.length) return true;
  return plano.flags.some((f, i) => {
    const alvo = lista[i];
    return (
      alvo === undefined ||
      f.id !== alvo.id ||
      f.code !== alvo.code ||
      f.label !== alvo.label ||
      f.cor !== alvo.cor
    );
  });
}

export function consolidarSetores({ somenteLeitura }: OpcoesConsolidacao): DefinicaoFlag[] {
  const gravada = loadSetores();
  let lista: DefinicaoFlag[] = gravada?.itens ?? setoresPadrao().itens;
  let listaMudou = gravada === null;

  // Primeira passada: funde tudo, para só então saber qual é a lista final. Sem
  // isso, o plano reescrito no começo do laço levaria um retrato já obsoleto
  // quando o plano seguinte trouxesse um setor novo.
  const entradas = listPlanos();
  const planos = entradas.map((e) => ({ id: e.id, plano: loadPlano(e.id) }));
  const remapPorPlano = new Map<string, Map<string, string>>();

  for (const { id, plano } of planos) {
    const { itens, remap } = fundirSetores(lista, plano.flags);
    if (itens.length !== lista.length) listaMudou = true;
    lista = itens;
    if (remap.size > 0) remapPorPlano.set(id, remap);
  }

  if (somenteLeitura) return lista;

  for (const { id, plano } of planos) {
    const nodes = remapearNos(plano.nodes, remapPorPlano.get(id) ?? new Map());
    const precisaRetrato = retratoDefasado(plano, lista);
    if (nodes === null && !precisaRetrato) continue;
    sobrescreverPlano(id, {
      ...plano,
      flags: lista,
      nodes: nodes ?? plano.nodes,
    });
  }

  if (listaMudou) saveSetores({ version: SETORES_VERSION, itens: lista });

  return lista;
}
