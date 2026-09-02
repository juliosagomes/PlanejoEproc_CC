import type { Plano } from '@/domain';

/**
 * Inventário do trabalho por setor: dado o conjunto de planos da unidade,
 * responde "o que este setor trabalha aqui?" (decisoes.md#D-26).
 *
 * Puro e sem storage de propósito — quem monta a entrada é o modal, que precisa
 * trocar o plano ativo pela versão viva da store do canvas. Ler o ativo do
 * storage mostraria o estado de até 300 ms atrás (o debounce) e ignoraria a
 * edição em curso.
 */

export interface PlanoDaUnidade {
  id: string;
  nome: string;
  plano: Plano;
}

export interface LocalizadorTrabalhado {
  planoId: string;
  planoNome: string;
  nodeId: string;
  /** Como o localizador aparece no canvas; vazio quando o nó ainda não foi batizado. */
  nome: string;
  jaCriado: boolean;
  sistema: boolean;
}

export interface UsoDoSetor {
  localizadores: number;
  planos: number;
}

/**
 * Setor id → localizadores marcados com ele, na ordem dos planos recebidos.
 *
 * Só entram setores que têm ao menos um localizador: quem consulta o mapa
 * distingue "setor sem uso" pela ausência, e a lista de setores continua sendo
 * a da unidade, não a das chaves daqui.
 *
 * Id de setor sem definição correspondente entra assim mesmo — é o mesmo
 * princípio do render do chip: id órfão é ignorado por quem pinta, não é erro.
 */
export function inventarioPorSetor(
  planos: readonly PlanoDaUnidade[],
): Map<string, LocalizadorTrabalhado[]> {
  const mapa = new Map<string, LocalizadorTrabalhado[]>();

  for (const { id: planoId, nome: planoNome, plano } of planos) {
    for (const node of plano.nodes) {
      // `Set` porque um plano gravado antes da consolidação pode ter o mesmo
      // setor duas vezes no nó, e a tela listaria o localizador em duplicata.
      for (const setorId of new Set(node.data.flags)) {
        const lista = mapa.get(setorId);
        const item: LocalizadorTrabalhado = {
          planoId,
          planoNome,
          nodeId: node.id,
          nome: node.data.nome,
          jaCriado: node.data.ja_criado,
          sistema: node.data.sistema ?? false,
        };
        if (lista) lista.push(item);
        else mapa.set(setorId, [item]);
      }
    }
  }

  return mapa;
}

/** Quantos localizadores e em quantos planos cada setor aparece. */
export function contarUso(
  inventario: ReadonlyMap<string, readonly LocalizadorTrabalhado[]>,
): Map<string, UsoDoSetor> {
  const contagem = new Map<string, UsoDoSetor>();
  for (const [setorId, itens] of inventario) {
    contagem.set(setorId, {
      localizadores: itens.length,
      planos: new Set(itens.map((i) => i.planoId)).size,
    });
  }
  return contagem;
}

/** Agrupa por plano, preservando a ordem de primeira aparição. */
export function agruparPorPlano(
  itens: readonly LocalizadorTrabalhado[],
): { planoId: string; planoNome: string; localizadores: LocalizadorTrabalhado[] }[] {
  const grupos = new Map<string, LocalizadorTrabalhado[]>();
  for (const item of itens) {
    const atual = grupos.get(item.planoId);
    if (atual) atual.push(item);
    else grupos.set(item.planoId, [item]);
  }
  return [...grupos].map(([planoId, localizadores]) => ({
    planoId,
    planoNome: localizadores[0]?.planoNome ?? '',
    localizadores,
  }));
}
