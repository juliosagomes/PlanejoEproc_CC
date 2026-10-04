import { useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent } from 'react';
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  useReactFlow,
  useStore,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { nomeEfetivo, type EdgeKind } from '@/domain';
import { NEW_NODE_DATATYPE } from '@/components/Sidebar';
import { useTemaStore } from '@/features/tema/store';
import { loadCamera, saveCamera } from '@/infra/storage';
import type { Tema } from '@/infra/storage/tema';
import { cn } from '@/utils/cn';
import { acharGemeos } from '../gemeos';
import { useIrParaNo } from '../irParaNo';
import { useCanvasStore } from '../store';
import { tamanhoNaTela } from '../grupoMudancas';
import { GrupoNode } from './GrupoNode';
import { LocalizadorNode } from './LocalizadorNode';
import { PjEdge } from './PjEdge';
import { SelecaoLoteBar } from './SelecaoLoteBar';

const nodeTypes = { localizador: LocalizadorNode, grupo: GrupoNode };

/**
 * Molduras ficam atrás dos localizadores mesmo selecionadas: o ReactFlow soma
 * 1000 ao zIndex do selecionado, e uma moldura erguida cobriria os membros.
 */
const Z_MOLDURA = -2000;
const edgeTypes = { pj: PjEdge };

/**
 * O ReactFlow recebe estas cores como texto e monta o id do marcador com elas,
 * então `var(--…)` não serve aqui. Os valores espelham os tokens `--aresta-*`
 * de `index.css` em cada tema (decisoes.md#D-34); mexeu lá, mexa aqui.
 */
const CORES_CANVAS: Record<Tema, { atp: string; pref: string; manual: string; miniCriado: string; miniPlanejado: string; mascara: string }> = {
  claro: {
    atp: 'oklch(0.55 0.15 265)',
    pref: 'oklch(0.55 0.14 155)',
    manual: 'oklch(0.65 0.01 270)',
    miniCriado: 'oklch(0.84 0.08 155)',
    miniPlanejado: '#D4D6DC',
    mascara: 'rgba(20,22,28,0.04)',
  },
  escuro: {
    atp: 'oklch(0.66 0.14 265)',
    pref: 'oklch(0.68 0.14 155)',
    manual: 'oklch(0.58 0.01 270)',
    miniCriado: 'oklch(0.5 0.1 155)',
    miniPlanejado: '#3a404a',
    mascara: 'rgba(0,0,0,0.25)',
  },
};

const corDoMarcador = (kind: EdgeKind | undefined, tema: Tema): string => {
  const c = CORES_CANVAS[tema];
  if (kind === 'atp') return c.atp;
  if (kind === 'pref') return c.pref;
  return c.manual;
};

interface FlowCanvasProps {
  /** Plano aberto. A câmera é lembrada por plano (`infra/storage/cameras.ts`). */
  planoId: string | null;
}

const ESPERA_SALVAR_CAMERA_MS = 300;
/**
 * O `fitView` só enquadra nós já medidos, e o plano recém-trocado ainda não foi
 * desenhado no mesmo quadro em que o id muda.
 */
const ESPERA_MEDIR_NOS_MS = 60;

export function FlowCanvas({ planoId }: FlowCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, setViewport, fitView } = useReactFlow();
  const [arrastando, setArrastando] = useState(false);
  const tema = useTemaStore((s) => s.tema);

  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const filtroFlags = useCanvasStore((s) => s.filtroFlags);
  const somenteLeitura = useCanvasStore((s) => s.somenteLeitura);
  const onNodesChange = useCanvasStore((s) => s.onNodesChange);
  const onEdgesChange = useCanvasStore((s) => s.onEdgesChange);
  const onConnect = useCanvasStore((s) => s.onConnect);
  const setSelectedId = useCanvasStore((s) => s.setSelectedId);
  const createNode = useCanvasStore((s) => s.createNode);
  const grupos = useCanvasStore((s) => s.grupos);

  // Membro de grupo recolhido some da tela; as setas dele passam a chegar na
  // moldura (D-31).
  const recolhidoDe = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of grupos) if (g.recolhido) for (const id of g.membros) m.set(id, g.id);
    return m;
  }, [grupos]);
  const molduras = useMemo(
    () =>
      grupos.map((g) => ({
        id: g.id,
        type: 'grupo',
        position: g.position,
        data: { grupo: g },
        selected: !!g.selected,
        style: tamanhoNaTela(g),
        zIndex: Z_MOLDURA,
        draggable: !somenteLeitura,
        connectable: false,
      })),
    [grupos, somenteLeitura],
  );

  // Trocar de plano não remonta o ReactFlow, e o `defaultViewport` só vale na
  // montagem: sem isto o plano novo abria onde a câmera estava no anterior.
  // Plano nunca aberto nesta máquina começa enquadrado.
  useEffect(() => {
    if (planoId === null) return;
    const salva = loadCamera(planoId);
    const t = window.setTimeout(() => {
      if (salva) setViewport(salva);
      else if (useCanvasStore.getState().nodes.length > 0) fitView({ padding: 0.2, maxZoom: 1 });
      else setViewport({ x: 0, y: 0, zoom: 1 });
    }, ESPERA_MEDIR_NOS_MS);
    return () => window.clearTimeout(t);
  }, [planoId, setViewport, fitView]);

  // Grava a partir da transformação, e não do `onMoveEnd`: este só dispara em
  // gesto do usuário, e o "enquadrar" dos controles ficaria sem gravar.
  // Enquanto a câmera ainda é a do plano anterior (a troca acabou de acontecer
  // e a restauração não foi aplicada), nada é gravado — senão o plano novo
  // herdaria a câmera do velho.
  const transform = useStore((s) => s.transform);
  const transformNaTroca = useRef<readonly number[] | null>(null);
  const planoDaTroca = useRef<string | null>(null);
  if (planoDaTroca.current !== planoId) {
    planoDaTroca.current = planoId;
    transformNaTroca.current = transform;
  }
  useEffect(() => {
    if (planoId === null) return;
    // Por valor: o ReactFlow recria o array ao iniciar, com os mesmos números.
    const naTroca = transformNaTroca.current;
    if (naTroca && naTroca.every((v, i) => v === transform[i])) return;
    transformNaTroca.current = null;
    const [x, y, zoom] = transform;
    const t = window.setTimeout(() => saveCamera(planoId, { x, y, zoom }), ESPERA_SALVAR_CAMERA_MS);
    return () => window.clearTimeout(t);
  }, [transform, planoId]);

  /**
   * Realce por setor (decisoes.md#D-22): com o filtro ligado, o que não é do
   * setor escolhido recua para o fundo. Nada é escondido — o nó continua na
   * tela, clicável e arrastável, porque o fluxo só faz sentido inteiro; o que
   * muda é para onde o olho vai.
   *
   * `esmaecidos` é o conjunto dos nós fora do filtro; a aresta acompanha quando
   * qualquer uma das pontas está fora, senão sobrariam setas nítidas ligando
   * cartões apagados.
   */
  const foraDoFiltro = useMemo(() => {
    if (filtroFlags.length === 0) return null;
    const fora = new Set<string>();
    for (const n of nodes) {
      if (!n.data.flags.some((id) => filtroFlags.includes(id))) fora.add(n.id);
    }
    return fora;
  }, [nodes, filtroFlags]);

  /**
   * Cópias do mesmo localizador. Passar o mouse num nó que tem cópia acende as
   * outras e recua o resto, pelo mesmo esmaecimento do filtro por setor —
   * enquanto dura o hover, ele manda; ao sair, o filtro volta.
   */
  // O atalho conta como cópia do alvo (D-30): passar o mouse num acende o outro.
  const gemeos = useMemo(
    () => acharGemeos(nodes.map((n) => ({ id: n.id, data: { nome: nomeEfetivo(nodes, n.id) } }))),
    [nodes],
  );
  const irParaNo = useIrParaNo();
  const [hoverId, setHoverId] = useState<string | null>(null);
  const grupoHover = useMemo(() => {
    const chave = hoverId === null ? undefined : gemeos.chaveDe.get(hoverId);
    return chave === undefined ? null : new Set(gemeos.grupos.get(chave));
  }, [hoverId, gemeos]);

  const esmaecidos = useMemo(() => {
    if (!grupoHover) return foraDoFiltro;
    return new Set(nodes.filter((n) => !grupoHover.has(n.id)).map((n) => n.id));
  }, [nodes, grupoHover, foraDoFiltro]);

  const decoratedNodes = useMemo(
    () =>
      nodes.map((n) => {
        const chave = gemeos.chaveDe.get(n.id);
        const copias = chave === undefined ? 0 : (gemeos.grupos.get(chave)?.length ?? 0);
        return {
          ...n,
          // Só troca a identidade de `data` quando há o que acrescentar, para
          // não re-renderizar todos os nós a cada mudança da lista.
          ...(copias > 1 ? { data: { ...n.data, copias } } : {}),
          selected: !!n.selected,
          hidden: recolhidoDe.has(n.id),
          className: cn(
            esmaecidos?.has(n.id) && 'pj-esmaecido',
            grupoHover?.has(n.id) && 'pj-gemeo',
          ) || undefined,
        };
      }),
    [nodes, esmaecidos, gemeos, grupoHover, recolhidoDe],
  );
  const decoratedEdges = useMemo(
    () =>
      edges.map((e) => {
        const origem = recolhidoDe.get(e.source);
        const destino = recolhidoDe.get(e.target);
        return {
        ...e,
        ...(origem ? { source: origem, sourceHandle: null } : {}),
        ...(destino ? { target: destino, targetHandle: null } : {}),
        // Dentro do mesmo grupo recolhido a seta não tem onde aparecer.
        hidden: origem !== undefined && origem === destino,
        selected: !!e.selected,
        className:
          esmaecidos?.has(e.source) || esmaecidos?.has(e.target)
            ? 'pj-esmaecido'
            : undefined,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: corDoMarcador(e.data?.kind, tema),
          width: 14,
          height: 14,
        },
      };
      }),
    [edges, esmaecidos, recolhidoDe, tema],
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

  // O handler mora no wrapper, então recebe o duplo clique de qualquer
  // descendente — inclusive de um nó ou de uma aresta, onde criar um
  // localizador solto por baixo nunca foi a intenção. Só o fundo cria.
  const onPaneDoubleClick = (e: MouseEvent) => {
    if (somenteLeitura) return;
    const alvo = e.target as Element | null;
    if (!alvo?.classList.contains('react-flow__pane')) return;
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
        nodes={[...molduras, ...decoratedNodes]}
        edges={decoratedEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        // Selecionar é com o ReactFlow (clique, Ctrl+clique, Shift+arrastar em
        // caixa); a store deriva `selectedId` das marcas que ele escreve. Um
        // `onNodeClick` que selecionasse por conta própria desfaria o Ctrl+clique.
        onNodeDoubleClick={(e, n) => {
          const alvo = (n.data as { atalhoPara?: string } | undefined)?.atalhoPara;
          if (alvo) irParaNo(alvo);
          // Dentro da moldura o fundo é dela, e o duplo clique que cria
          // localizador no fundo do canvas criaria aqui também — já membro.
          if (n.type === 'grupo' && !somenteLeitura && !(n.data as { grupo: { recolhido?: boolean } }).grupo.recolhido) {
            createNode(screenToFlowPosition({ x: e.clientX, y: e.clientY }));
          }
        }}
        onNodeMouseEnter={(_, n) => setHoverId(n.id)}
        onNodeMouseLeave={() => setHoverId(null)}
        onNodeDragStart={() => setHoverId(null)}
        onPaneClick={() => setSelectedId(null)}
        onDoubleClick={onPaneDoubleClick}
        // Arrastar nó e puxar aresta são as duas edições que acontecem no
        // próprio canvas; selecionar continua, senão não haveria como abrir o
        // painel de detalhes para *ver* o que está ali.
        // O duplo clique tem um efeito só: criar um localizador onde o cursor
        // está. Com o zoom do ReactFlow ligado, o mesmo gesto também aproximava
        // a tela, e o nó recém-criado saía de onde o usuário mirou.
        zoomOnDoubleClick={false}
        // O Delete é do App, que sabe confirmar apagar em lote e ignora o foco
        // em campos de texto. O padrão do ReactFlow (Backspace) apagaria sem
        // perguntar, e Backspace é "voltar" para quem vem do Mac.
        deleteKeyCode={null}
        multiSelectionKeyCode={['Control', 'Meta']}
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
          maskColor={CORES_CANVAS[tema].mascara}
          nodeColor={(n) =>
            (n.data as { ja_criado?: boolean } | undefined)?.ja_criado
              ? CORES_CANVAS[tema].miniCriado
              : CORES_CANVAS[tema].miniPlanejado
          }
        />
      </ReactFlow>

      <SelecaoLoteBar />

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
