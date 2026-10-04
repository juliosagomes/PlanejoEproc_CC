import type { CorFlag } from './flags';
import type { Position } from './plano';

/* ============================================================================
 * GRUPOS DE LOCALIZADORES (decisoes.md#D-31)
 *
 * Moldura nomeada que organiza o **desenho**: mover a moldura move o que está
 * dentro, e recolhê-la troca os localizadores por um bloco só. Não diz nada ao
 * Eproc — não há grupo de localizador lá — e por isso não entra no checklist.
 *
 * Quem trabalha o quê continua sendo papel dos setores (D-22/D-26), que filtram
 * em vez de agrupar.
 * ========================================================================== */

export interface GrupoLocalizadores {
  id: string;
  rotulo: string;
  cor: CorFlag;
  /** Canto superior esquerdo, em coordenadas **absolutas** do canvas. */
  position: Position;
  largura: number;
  altura: number;
  /** Recolhido: os membros somem e as setas passam a chegar na moldura. */
  recolhido?: boolean;
  /**
   * Ids dos localizadores dentro. Explícito, e não calculado pela geometria a
   * cada render: com o grupo recolhido não há geometria, e o membro precisa
   * continuar sendo membro.
   */
  membros: string[];
}

/** Tamanho do bloco de um grupo recolhido. */
export const GRUPO_RECOLHIDO = { largura: 220, altura: 64 } as const;

/** Folga entre a moldura e os localizadores ao criar um grupo em volta deles. */
export const GRUPO_FOLGA = { lado: 20, topo: 40, base: 20 } as const;

export interface Retangulo {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

/** Moldura que envolve todos os retângulos, com a folga do rótulo no topo. */
export function molduraEnvolvendo(rets: readonly Retangulo[]): Retangulo | null {
  if (rets.length === 0) return null;
  const x0 = Math.min(...rets.map((r) => r.x)) - GRUPO_FOLGA.lado;
  const y0 = Math.min(...rets.map((r) => r.y)) - GRUPO_FOLGA.topo;
  const x1 = Math.max(...rets.map((r) => r.x + r.largura)) + GRUPO_FOLGA.lado;
  const y1 = Math.max(...rets.map((r) => r.y + r.altura)) + GRUPO_FOLGA.base;
  return { x: x0, y: y0, largura: x1 - x0, altura: y1 - y0 };
}

/**
 * Em qual grupo (expandido) cai um retângulo, pelo centro. Havendo moldura
 * dentro de moldura, ganha a menor — é a que o usuário está mirando.
 */
export function grupoQueContem(
  grupos: readonly GrupoLocalizadores[],
  r: Retangulo,
): GrupoLocalizadores | undefined {
  const cx = r.x + r.largura / 2;
  const cy = r.y + r.altura / 2;
  return grupos
    .filter(
      (g) =>
        !g.recolhido &&
        cx >= g.position.x &&
        cx <= g.position.x + g.largura &&
        cy >= g.position.y &&
        cy <= g.position.y + g.altura,
    )
    .sort((a, b) => a.largura * a.altura - b.largura * b.altura)[0];
}

/**
 * Recalcula a que grupo pertencem os nós que acabaram de ser soltos. Quem caiu
 * fora de toda moldura sai do grupo; quem caiu dentro entra (e sai do anterior).
 * Membros de grupo recolhido não são tocados — não estão na tela para serem
 * soltos em lugar nenhum.
 */
export function reagruparSoltos(
  grupos: readonly GrupoLocalizadores[],
  soltos: ReadonlyArray<{ id: string } & Retangulo>,
): GrupoLocalizadores[] {
  const destino = new Map<string, string | undefined>();
  for (const n of soltos) {
    const atual = grupos.find((g) => g.membros.includes(n.id));
    if (atual?.recolhido) continue;
    destino.set(n.id, grupoQueContem(grupos, n)?.id);
  }
  if (destino.size === 0) return [...grupos];
  return grupos.map((g) => {
    const membros = g.membros.filter((id) => !destino.has(id) || destino.get(id) === g.id);
    for (const [id, alvo] of destino) if (alvo === g.id && !membros.includes(id)) membros.push(id);
    return membros.length === g.membros.length && membros.every((m, i) => m === g.membros[i])
      ? g
      : { ...g, membros };
  });
}
