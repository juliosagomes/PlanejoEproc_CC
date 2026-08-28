import { useMemo, useRef, useState, type DragEvent, type MouseEvent } from 'react';
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';

import type { EdgeKind } from '@/domain';
import { NEW_NODE_DATATYPE } from '@/components/Sidebar';
import { cn } from '@/utils/cn';
import { useCanvasStore } from '../store';
import { LocalizadorNode } from './LocalizadorNode';
import { PjEdge } from './PjEdge';

const nodeTypes = { localizador: LocalizadorNode };
const edgeTypes = { pj: PjEdge };

const corDoMarcador = (kind: EdgeKind | undefined): string => {
  if (kind === 'atp') return 'oklch(0.55 0.15 265)';
  if (kind === 'pref') return 'oklch(0.55 0.14 155)';
  return 'oklch(0.65 0.01 270)';
};

export function FlowCanvas() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const [arrastando, setArrastando] = useState(false);

  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const selectedId = useCanvasStore((s) => s.selectedId);
  const somenteLeitura = useCanvasStore((s) => s.somenteLeitura);
  const onNodesChange = useCanvasStore((s) => s.onNodesChange);
  const onEdgesChange = useCanvasStore((s) => s.onEdgesChange);
  const onConnect = useCanvasStore((s) => s.onConnect);
  const setSelectedId = useCanvasStore((s) => s.setSelectedId);
  const createNode = useCanvasStore((s) => s.createNode);

  const decoratedNodes = useMemo(
    () => nodes.map((n) => ({ ...n, selected: n.id === selectedId })),
    [nodes, selectedId],
  );
  const decoratedEdges = useMemo(
    () =>
      edges.map((e) => ({
        ...e,
        selected: e.id === selectedId,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: corDoMarcador(e.data?.kind),
          width: 14,
          height: 14,
        },
      })),
    [edges, selectedId],
  );

  const isEmpty = nodes.length === 0;

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (somenteLeitura) return;
    if (!Array.from(e.dataTransfer.types).includes(NEW_NODE_DATATYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!arrastando) setArrastando(true);
  };
  const onDragLeave = () => setArrastando(false);
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    if (somenteLeitura) return;
    e.preventDefault();
    setArrastando(false);
    if (!Array.from(e.dataTransfer.types).includes(NEW_NODE_DATATYPE)) return;
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    createNode(position);
  };

  const onPaneDoubleClick = (e: MouseEvent) => {
    if (somenteLeitura) return;
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    createNode(position);
  };

  return (
    <div
      ref={wrapperRef}
      className={cn('relative flex-1 bg-fundo', arrastando && 'canvas-drag-over')}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <ReactFlow
        nodes={decoratedNodes}
        edges={decoratedEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, n) => setSelectedId(n.id)}
        onEdgeClick={(_, e) => setSelectedId(e.id)}
        onPaneClick={() => setSelectedId(null)}
        onDoubleClick={onPaneDoubleClick}
        // Arrastar nó e puxar aresta são as duas edições que acontecem no
        // próprio canvas; selecionar continua, senão não haveria como abrir o
        // painel de detalhes para *ver* o que está ali.
        nodesDraggable={!somenteLeitura}
        nodesConnectable={!somenteLeitura}
        edgesUpdatable={!somenteLeitura}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ type: 'pj' }}
        minZoom={0.4}
        maxZoom={1.8}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      >
        <Background gap={20} size={1} color="var(--grade-ponto)" />
        <Controls showInteractive={false} position="bottom-left" />
        <MiniMap
          pannable
          zoomable
          style={{
            width: 140,
            height: 90,
            background: 'var(--superficie)',
            border: '1px solid var(--borda)',
            borderRadius: 6,
          }}
          maskColor="rgba(20,22,28,0.04)"
          nodeColor={(n) =>
            (n.data as { ja_criado?: boolean } | undefined)?.ja_criado
              ? 'oklch(0.84 0.08 155)'
              : '#D4D6DC'
          }
        />
      </ReactFlow>

      {isEmpty && (
        <div className="empty-state">
          <div className="empty-card">
            <div className="text-[13px] font-semibold mb-1">Quadro vazio</div>
            <div className="text-xs text-texto-2 leading-relaxed">
              {somenteLeitura ? (
                <>
                  Este plano não tem nenhum localizador. Você está numa sessão de
                  visualização, então não há o que criar aqui.
                </>
              ) : (
                <>
                  Arraste <strong>Novo localizador</strong> da barra lateral, ou clique
                  duas vezes no canvas para criar um nó.
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
