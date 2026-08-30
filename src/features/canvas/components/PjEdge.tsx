import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { getBezierPath, getSmoothStepPath, useReactFlow, type EdgeProps } from 'reactflow';
import type { DobraAresta, EdgeData, EdgeKind } from '@/domain';
import { cn } from '@/utils/cn';
import { useCanvasStore } from '../store';
import {
  centroDaDobra,
  dobraArrastavel,
  dobraComArrasto,
  segmentoDaDobra,
  OFFSET_SMOOTHSTEP,
} from '../dobra';

/**
 * Aresta custom do canvas — três variantes visuais por kind:
 *
 *   • atp     → linha cheia animada na cor `--aresta-atp` (azul).
 *   • pref    → linha cheia sólida na cor `--aresta-pref` (verde).
 *   • manual  → linha tracejada sutil na cor `--aresta-manual`.
 *
 * No modo `sharp` (Diagrama) o cotovelo é arrastável: o segmento central vira
 * alça, e onde ele para é gravado no plano. Toda a geometria mora em
 * `../dobra.ts`, que é puro e testado; aqui fica só o gesto. Ver
 * decisoes.md#D-21.
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

/**
 * Abaixo disto o gesto foi um clique, não um arrasto. Em px de tela, não do
 * canvas: é a firmeza da mão que está sendo medida, não distância no desenho.
 *
 * Não serve para preservar a seleção — essa continua vindo do `onEdgeClick`,
 * que o ReactFlow trata acima da alça. Serve para não gravar uma dobra (e
 * carimbar `atualizadoEm` no índice de planos) por causa de um clique parado.
 */
const LIMIAR_ARRASTO = 3;

interface Arrasto {
  clientX: number;
  clientY: number;
  zoom: number;
  inicial: DobraAresta | undefined;
  moveu: boolean;
  /**
   * A dobra mais recente do gesto. Fica aqui, e não só no state, porque o
   * `pointerup` pode chegar antes de o React re-renderizar — e aí o `preview`
   * lido do closure ainda seria o do render anterior, e o gesto se perderia.
   * O state existe para desenhar; esta ref é o que se grava.
   */
  atual: DobraAresta | null;
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
  const { flowToScreenPosition, getZoom } = useReactFlow();

  // Lido da store, e não mais de `document.body.dataset.flowMode`: a alça
  // precisa aparecer e sumir no instante em que o modo troca, e um atributo
  // escrito fora do React não dispara re-render.
  const flowMode = useCanvasStore((s) => s.flowMode);
  const somenteLeitura = useCanvasStore((s) => s.somenteLeitura);
  const setDobra = useCanvasStore((s) => s.setDobra);

  /**
   * Enquanto o ponteiro está pressionado a dobra vive aqui, não na store:
   * commitar a cada `pointermove` redesenharia o canvas inteiro e enfileiraria
   * dezenas de gravações debounced para um gesto só.
   */
  const [preview, setPreview] = useState<DobraAresta | null>(null);
  const arrasto = useRef<Arrasto | null>(null);

  const geo = { sourceX, sourceY, targetX, targetY };
  const dobra = preview ?? data?.dobra;

  const isSharp = flowMode === 'sharp';
  const args = { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition };
  const [path, labelX, labelY] = isSharp
    ? getSmoothStepPath({
        ...args,
        borderRadius: 4,
        offset: OFFSET_SMOOTHSTEP,
        ...centroDaDobra(geo, dobra),
      })
    : getBezierPath(args);

  const dasharray = kind === 'atp' ? '6 4' : style.strokeDasharray;
  const strokeWidth = selected ? style.strokeWidth + 0.7 : style.strokeWidth;

  const podeArrastar = isSharp && !somenteLeitura && dobraArrastavel(geo);
  const segmento = segmentoDaDobra(geo, dobra);
  const arrastando = preview !== null;
  const showTooltip = hovered && !arrastando && resumo.length > 0;

  const onPointerDown = (e: ReactPointerEvent<Element>) => {
    if (!podeArrastar || e.button !== 0) return;
    // Não impede o pan — o d3-zoom escuta `mousedown`, que é outro evento;
    // quem barra o pan é a classe `nopan` no elemento. Isto aqui evita que o
    // ReactFlow inicie a seleção por área.
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    arrasto.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      zoom: getZoom(),
      inicial: data?.dobra,
      moveu: false,
      atual: null,
    };
  };

  const onPointerMove = (e: ReactPointerEvent<Element>) => {
    const inicio = arrasto.current;
    if (!inicio) return;
    const dxTela = e.clientX - inicio.clientX;
    const dyTela = e.clientY - inicio.clientY;
    if (
      !inicio.moveu &&
      Math.abs(dxTela) < LIMIAR_ARRASTO &&
      Math.abs(dyTela) < LIMIAR_ARRASTO
    ) {
      return;
    }
    inicio.moveu = true;
    // Deslocamento acumulado desde o `pointerdown`, e não a posição do cursor:
    // colar o segmento no ponteiro faria ele saltar assim que o usuário
    // agarrasse a linha alguns pixels fora do centro.
    const proxima = dobraComArrasto(geo, inicio.inicial, {
      dx: dxTela / inicio.zoom,
      dy: dyTela / inicio.zoom,
    });
    inicio.atual = proxima;
    setPreview(proxima);
  };

  const encerrar = (e: ReactPointerEvent<Element>, comitar: boolean) => {
    const inicio = arrasto.current;
    if (!inicio) return;
    arrasto.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (comitar && inicio.moveu && inicio.atual) setDobra(id, inicio.atual);
    setPreview(null);
  };

  const onDoubleClick = (e: { stopPropagation: () => void }) => {
    if (!podeArrastar) return;
    // O wrapper do FlowCanvas trata duplo clique como "criar localizador
    // aqui"; sem isto, resetar a dobra deixaria um nó solto para trás.
    e.stopPropagation();
    setDobra(id);
  };

  const handlers = podeArrastar
    ? {
        onPointerDown,
        onPointerMove,
        onPointerUp: (e: ReactPointerEvent<Element>) => encerrar(e, true),
        onPointerCancel: (e: ReactPointerEvent<Element>) => encerrar(e, false),
        onDoubleClick,
      }
    : {};

  // Sem isto o navegador reivindica o gesto para scroll/pinch no touch. Fora
  // do spread de `handlers` porque o rótulo tem estilo próprio a preservar.
  const touch = podeArrastar ? { touchAction: 'none' as const } : {};

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

      {podeArrastar && (
        <>
          {(hovered || selected || arrastando) && (
            <line
              className="edge-dobra-indicador"
              x1={segmento.x1}
              y1={segmento.y1}
              x2={segmento.x2}
              y2={segmento.y2}
              stroke={style.stroke}
            />
          )}
          {/* Depois da hit area geral de propósito: em SVG o último desenhado
              ganha o hit-test, e sobre o cotovelo o gesto é arrastar. Fica
              montada mesmo fora do hover — desmontá-la no meio do gesto
              perderia o pointer capture e travaria o arrasto. */}
          <line
            className={cn('edge-dobra', `orient-${segmento.orientacao}`, 'nodrag', 'nopan')}
            aria-hidden
            style={touch}
            x1={segmento.x1}
            y1={segmento.y1}
            x2={segmento.x2}
            y2={segmento.y2}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            {...handlers}
          />
        </>
      )}

      <foreignObject
        x={labelX - 60}
        y={labelY - 13}
        width={120}
        height={26}
        style={{ overflow: 'visible' }}
      >
        {/* `pointer-events: none` no wrapper: ele ocupa 120×26 mesmo onde é
            transparente, e sem isto engoliria o clique num raio bem maior que
            a pílula — inclusive sobre a alça. A pílula reativa o seu. */}
        <div className="flex justify-center" style={{ pointerEvents: 'none' }}>
          <div
            className={cn('edge-label', {
              [`arrastavel orient-${segmento.orientacao} nodrag nopan`]: podeArrastar,
            })}
            style={{ border: `1px solid ${style.stroke}`, color: style.stroke, ...touch }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            // A pílula fica exatamente sobre o cotovelo (o `labelX/labelY` da
            // lib é o meio do segmento), então precisa arrastar junto — senão
            // vira um buraco no meio da alça.
            {...handlers}
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
