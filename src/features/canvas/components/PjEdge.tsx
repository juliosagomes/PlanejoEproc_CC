import { useState } from 'react';
import { createPortal } from 'react-dom';
import { getBezierPath, getSmoothStepPath, useReactFlow, type EdgeProps } from 'reactflow';
import type { EdgeData, EdgeKind, FlowMode } from '@/domain';
import { cn } from '@/utils/cn';

/**
 * Aresta custom do canvas — três variantes visuais por kind:
 *
 *   • atp     → linha cheia animada na cor `--aresta-atp` (azul).
 *   • pref    → linha cheia sólida na cor `--aresta-pref` (verde).
 *   • manual  → linha tracejada sutil na cor `--aresta-manual`.
 *
 * O modo do canvas (`organic` = Bézier; `sharp` = step ortogonal) é lido de
 * `document.body.dataset.flowMode`. É um hack herdado do BETA_2 — funciona
 * porque todas as arestas compartilham o mesmo modo, e ReactFlow remontaria
 * o componente se o modo virasse prop da edge data. Se virar problema (ex.:
 * suporte a múltiplos canvases), trocar por context.
 */

type EdgeStyleSpec = {
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
};

const EDGE_STYLES: Record<EdgeKind, EdgeStyleSpec> = {
  atp: { stroke: 'var(--aresta-atp)', strokeWidth: 1.8 },
  pref: { stroke: 'var(--aresta-pref)', strokeWidth: 1.8 },
  manual: { stroke: 'var(--aresta-manual)', strokeWidth: 1.6, strokeDasharray: '4 4' },
};

const KIND_LABEL_CURTO: Record<EdgeKind, string> = {
  atp: 'ATP',
  pref: 'Pref.',
  manual: 'Manual',
};

function lerFlowMode(): FlowMode {
  if (typeof document === 'undefined') return 'organic';
  return document.body.dataset.flowMode === 'sharp' ? 'sharp' : 'organic';
}

export function PjEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  selected,
}: EdgeProps<EdgeData>) {
  const kind: EdgeKind = data?.kind ?? 'manual';
  const style = EDGE_STYLES[kind];
  const subitems = data?.subitems ?? [];
  const total = subitems.length;
  const concluidos = subitems.filter((s) => s.ja_criado).length;
  const resumo = data?.resumo?.trim() ?? '';

  const [hovered, setHovered] = useState(false);
  const showTooltip = hovered && resumo.length > 0;
  const { flowToScreenPosition } = useReactFlow();

  const mode = lerFlowMode();
  const args = { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition };
  const [path, labelX, labelY] =
    mode === 'sharp' ? getSmoothStepPath({ ...args, borderRadius: 4 }) : getBezierPath(args);

  const dasharray = kind === 'atp' ? '6 4' : style.strokeDasharray;
  const strokeWidth = selected ? style.strokeWidth + 0.7 : style.strokeWidth;

  return (
    <>
      <path
        id={id}
        d={path}
        fill="none"
        stroke={style.stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={dasharray}
        markerEnd={markerEnd}
      >
        {kind === 'atp' && (
          <animate
            attributeName="stroke-dashoffset"
            from="0"
            to="-20"
            dur="1s"
            repeatCount="indefinite"
          />
        )}
      </path>

      {/* Hit area transparente — facilita o clique sobre a aresta. */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={18}
        className="cursor-pointer"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />

      <foreignObject
        x={labelX - 60}
        y={labelY - 13}
        width={120}
        height={26}
        style={{ overflow: 'visible' }}
      >
        <div className="flex justify-center">
          <div
            className="edge-label"
            style={{ border: `1px solid ${style.stroke}`, color: style.stroke }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            {KIND_LABEL_CURTO[kind]}
            {total > 0 && (
              <span className={cn('badge-count', concluidos === total && 'complete')}>
                {concluidos}/{total}
              </span>
            )}
          </div>
        </div>
      </foreignObject>

      {showTooltip &&
        (() => {
          const screen = flowToScreenPosition({ x: labelX, y: labelY });
          return createPortal(
            <div
              className="edge-tooltip"
              style={{ left: screen.x, top: screen.y - 22 }}
            >
              {resumo}
            </div>,
            document.body,
          );
        })()}
    </>
  );
}
