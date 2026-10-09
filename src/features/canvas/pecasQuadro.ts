import type { NodeChange } from 'reactflow';
import type { EntradaEvento, NotaQuadro } from '@/domain';

/* ============================================================================
 * Notas e entradas por evento no ReactFlow (decisoes.md#D-38)
 *
 * Como as molduras do D-31, moram fora de `nodes` e entram no desenho como nós
 * de tipo próprio. Diferente delas, não têm membros nem tamanho próprio: só
 * posição e seleção.
 * ========================================================================== */

/**
 * Campos de tela que o ReactFlow escreve e que não vão ao plano. A medida
 * precisa ser guardada: no ReactFlow 11 ela só sobrevive se o dono do estado a
 * devolver, e seta que sai de nó sem medida não é desenhada (ver
 * `moldurasParaFlow`).
 */
type DaTela = { selected?: boolean; width?: number; height?: number };

export type NotaFlow = NotaQuadro & DaTela;
export type EntradaFlow = EntradaEvento & DaTela;

type Peca = { id: string; position: { x: number; y: number } } & DaTela;

/** Aplica seleção, arrasto e remoção que o ReactFlow mandou para as peças de `itens`. */
export function aplicarMudancasPecas<T extends Peca>(itens: T[], changes: NodeChange[]): T[] {
  let out = itens;
  for (const c of changes) {
    if (c.type === 'select') {
      out = out.map((p) => (p.id === c.id && !!p.selected !== c.selected ? { ...p, selected: c.selected } : p));
    } else if (c.type === 'remove') {
      out = out.filter((p) => p.id !== c.id);
    } else if (c.type === 'dimensions' && c.dimensions) {
      const { width, height } = c.dimensions;
      out = out.map((p) =>
        p.id === c.id && (p.width !== width || p.height !== height) ? { ...p, width, height } : p,
      );
    } else if (c.type === 'position' && c.position) {
      const pos = c.position;
      out = out.map((p) =>
        p.id === c.id && (p.position.x !== pos.x || p.position.y !== pos.y)
          ? { ...p, position: { x: pos.x, y: pos.y } }
          : p,
      );
    }
  }
  return out;
}

/** Tira os campos de tela antes de gravar. */
export function paraPlano<T extends Peca>(itens: readonly T[]): Omit<T, keyof DaTela>[] {
  return itens.map(({ selected: _s, width: _w, height: _h, ...p }) => p);
}

export function pecasParaFlow(
  notas: readonly NotaFlow[],
  entradas: readonly EntradaFlow[],
  somenteLeitura: boolean,
) {
  return [
    ...notas.map((n) => ({
      id: n.id,
      type: 'nota' as const,
      position: n.position,
      data: { nota: n },
      selected: !!n.selected,
      ...(n.width !== undefined ? { width: n.width, height: n.height } : {}),
      draggable: !somenteLeitura,
      connectable: false,
    })),
    ...entradas.map((e) => ({
      id: e.id,
      type: 'entrada' as const,
      position: e.position,
      data: { entrada: e },
      selected: !!e.selected,
      ...(e.width !== undefined ? { width: e.width, height: e.height } : {}),
      draggable: !somenteLeitura,
    })),
  ];
}
