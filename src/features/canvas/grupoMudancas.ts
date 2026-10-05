import type { NodeChange, Node as RFNode } from 'reactflow';
import {
  GRUPO_RECOLHIDO,
  reagruparSoltos,
  type GrupoLocalizadores,
  type LocalizadorData,
} from '@/domain';

/** Grupo como a store guarda: o do domínio mais a marca de seleção do ReactFlow. */
export type GrupoFlow = GrupoLocalizadores & { selected?: boolean };

type NoFlow = RFNode<LocalizadorData>;

const LARGURA_PADRAO = 180;
const ALTURA_PADRAO = 60;

/** Retângulo de um nó da store, com a medida que o ReactFlow escreveu (ou uma estimativa). */
export function retanguloDoNo(n: NoFlow) {
  return {
    id: n.id,
    x: n.position.x,
    y: n.position.y,
    largura: n.width ?? LARGURA_PADRAO,
    altura: n.height ?? ALTURA_PADRAO,
  };
}

/**
 * Aplica as mudanças que o ReactFlow mandou para os nós **de grupo** (D-31).
 *
 * - Arrastar a moldura (mudança de posição com `dragging`) leva os membros
 *   junto, pelo mesmo deslocamento.
 * - Redimensionar pelo canto (mudança de posição sem `dragging`, vinda do
 *   `NodeResizer`) move só a moldura — os membros ficam onde estão.
 * - Medidas com `resizing` viram largura e altura; medição comum é ignorada,
 *   porque o tamanho é nosso, não do conteúdo.
 */
export function aplicarMudancasGrupos(
  grupos: GrupoFlow[],
  nodes: NoFlow[],
  changes: NodeChange[],
): { grupos: GrupoFlow[]; nodes: NoFlow[] } {
  let gs = grupos;
  let ns = nodes;
  const atualizar = (id: string, f: (g: GrupoFlow) => GrupoFlow) => {
    gs = gs.map((g) => (g.id === id ? f(g) : g));
  };
  for (const c of changes) {
    if (c.type === 'select') {
      atualizar(c.id, (g) => ({ ...g, selected: c.selected }));
    } else if (c.type === 'remove') {
      gs = gs.filter((g) => g.id !== c.id);
    } else if (c.type === 'position' && c.position) {
      const g = gs.find((x) => x.id === c.id);
      if (!g) continue;
      const dx = c.position.x - g.position.x;
      const dy = c.position.y - g.position.y;
      if (dx === 0 && dy === 0) continue;
      const arrastando = c.dragging !== undefined;
      atualizar(c.id, (x) => ({ ...x, position: { ...c.position! } }));
      if (arrastando) {
        const membros = new Set(g.membros);
        ns = ns.map((n) =>
          membros.has(n.id)
            ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
            : n,
        );
      }
    } else if (c.type === 'dimensions' && c.dimensions && c.resizing !== undefined) {
      const { width, height } = c.dimensions;
      atualizar(c.id, (g) =>
        g.recolhido ? g : { ...g, largura: Math.max(width, 120), altura: Math.max(height, 80) },
      );
    }
  }
  return { grupos: gs, nodes: ns };
}

/**
 * Depois de soltar localizadores, decide de que grupo cada um passa a ser.
 * Só olha para os nós que terminaram um arrasto (`dragging: false`).
 */
export function reagruparAposArrasto(
  grupos: GrupoFlow[],
  nodes: NoFlow[],
  changes: NodeChange[],
): GrupoFlow[] {
  const soltos = new Set(
    changes.filter((c) => c.type === 'position' && c.dragging === false).map((c) => (c as { id: string }).id),
  );
  if (soltos.size === 0 || grupos.length === 0) return grupos;
  const resultado = reagruparSoltos(
    grupos,
    nodes.filter((n) => soltos.has(n.id)).map(retanguloDoNo),
  );
  // `reagruparSoltos` devolve o tipo do domínio; a marca de seleção é preservada.
  return resultado.map((g, i) => (g === grupos[i] ? grupos[i]! : { ...grupos[i]!, membros: g.membros }));
}

/** Tamanho da moldura na tela, que muda quando o grupo está recolhido. */
export function tamanhoNaTela(g: GrupoLocalizadores): { width: number; height: number } {
  return g.recolhido
    ? { width: GRUPO_RECOLHIDO.largura, height: GRUPO_RECOLHIDO.altura }
    : { width: g.largura, height: g.altura };
}

/**
 * Molduras ficam atrás dos localizadores mesmo selecionadas: o ReactFlow soma
 * 1000 ao zIndex do selecionado, e uma moldura erguida cobriria os membros.
 */
export const Z_MOLDURA = -2000;

/**
 * Os grupos como nós do ReactFlow.
 *
 * `width`/`height` vão no próprio nó, e não só no `style`. No ReactFlow 11 eles
 * são a medida que a lib escreve, e ela só sobrevive se o dono do estado
 * guardar a mudança `dimensions` — o que a store faz para os localizadores, mas
 * não para as molduras, cujo tamanho é nosso. Sem eles, cada render (o
 * `FlowCanvas` passa um array novo de nós) apagava a medida: a moldura ficava
 * com `visibility: hidden` até a próxima medição, as setas do grupo recolhido
 * sumiam (aresta sem medida não é desenhada) e o `NodeResizer` começava o
 * arrasto do zero.
 */
export function moldurasParaFlow(grupos: readonly GrupoFlow[], somenteLeitura: boolean) {
  return grupos.map((g) => {
    const tamanho = tamanhoNaTela(g);
    return {
      id: g.id,
      type: 'grupo' as const,
      position: g.position,
      data: { grupo: g },
      selected: !!g.selected,
      style: tamanho,
      width: tamanho.width,
      height: tamanho.height,
      zIndex: Z_MOLDURA,
      draggable: !somenteLeitura,
      connectable: false,
    };
  });
}
