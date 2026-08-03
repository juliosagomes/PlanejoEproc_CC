import {
  addEdge as rfAddEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge as RFEdge,
  type EdgeChange,
  type Node as RFNode,
  type NodeChange,
} from 'reactflow';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';
import {
  SCHEMA_VERSION,
  type AtpRule,
  type EdgeData,
  type FlowMode,
  type LocalizadorData,
  type Plano,
  type Position,
  type PrefRule,
} from '@/domain';
import { criarSavePlanoDebounced, planoVazio } from '@/infra/storage';
import { uid } from '@/utils/uid';

/* ============================================================================
 * STORE DO CANVAS
 *
 * Holds the ReactFlow `Node`/`Edge` shapes (ReactFlow precisa deles assim) e
 * mantém também `selectedId`, `planoNome`, `flowMode`. Conversão para o tipo
 * `Plano` (domain) acontece em `getPlano()` / `loadPlano(plano)`.
 *
 * Persistência: uma única assinatura observa o slice persistível
 * `[nodes, edges, planoNome, flowMode]` (com igualdade rasa) e dispara
 * `criarSavePlanoDebounced()`. `selectedId` muda sem forçar gravação.
 * ========================================================================== */

export type FlowNode = RFNode<LocalizadorData>;
export type FlowEdge = RFEdge<EdgeData>;

interface CanvasState {
  nodes: FlowNode[];
  edges: FlowEdge[];
  selectedId: string | null;
  planoNome: string;
  flowMode: FlowMode;
}

interface CanvasActions {
  // Integração com ReactFlow
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;

  // Mutações de domínio
  createNode: (position: Position) => string;
  updateNode: (id: string, patch: Partial<LocalizadorData>) => void;
  updateEdge: (id: string, patch: Partial<EdgeData>) => void;
  deleteNode: (id: string) => void;
  deleteEdge: (id: string) => void;

  // Setters de estado simples
  setSelectedId: (id: string | null) => void;
  setPlanoNome: (nome: string) => void;
  setFlowMode: (mode: FlowMode) => void;

  // Toggles de "já criado"
  toggleNodeCreated: (id: string) => void;
  toggleSubitemCreated: (edgeId: string, index: number) => void;
  toggleEdgeRuleCreated: (edgeId: string) => void;

  // Plano (domain) <-> store
  loadPlano: (plano: Plano) => void;
  getPlano: () => Plano;
}

export type CanvasStore = CanvasState & CanvasActions;

/* ============================================================================
 * Defaults — sempre criar dados novos por estes helpers para garantir shape
 * consistente. Nunca duplicar literais em chamadores.
 * ========================================================================== */

export function defaultLocalizadorData(): LocalizadorData {
  return { nome: '', ja_criado: false, flags: {} };
}

export function defaultEdgeData(): EdgeData {
  return { kind: 'manual', resumo: '', observacao: '', subitems: [] };
}

function defaultAtpRule(): AtpRule {
  return { implantar: false, ja_criado: false, nome: '' };
}

function defaultPrefRule(): PrefRule {
  return { implantar: false, ja_criado: false, nome: '' };
}

/* ============================================================================
 * Conversores entre o shape do domain e o shape que ReactFlow consome.
 * ========================================================================== */

function planoParaFlow(plano: Plano): {
  nodes: FlowNode[];
  edges: FlowEdge[];
  planoNome: string;
  flowMode: FlowMode;
} {
  return {
    nodes: plano.nodes.map((n) => ({
      id: n.id,
      type: 'localizador',
      position: n.position,
      data: n.data,
    })),
    edges: plano.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      targetHandle: e.targetHandle ?? null,
      type: 'pj',
      data: e.data,
    })),
    planoNome: plano.planoNome,
    flowMode: plano.flowMode,
  };
}

function flowParaPlano(state: CanvasState): Plano {
  return {
    version: SCHEMA_VERSION,
    planoNome: state.planoNome,
    flowMode: state.flowMode,
    nodes: state.nodes.map((n) => ({
      id: n.id,
      position: n.position,
      data: n.data,
    })),
    edges: state.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      targetHandle: e.targetHandle ?? null,
      data: e.data ?? defaultEdgeData(),
    })),
  };
}

/* ============================================================================
 * Estado inicial é um plano VAZIO — não uma leitura do localStorage.
 *
 * Qual plano carregar depende do silo da sessão (ver infra/storage/escopo.ts),
 * e a sessão só é escolhida na tela de login, depois deste módulo ser
 * importado. Quem carrega o plano de verdade é `features/sessao/store.ts`,
 * chamando a ação `loadPlano` logo após fixar o escopo.
 *
 * Tests resetam o estado via `useCanvasStore.setState(...)` em beforeEach.
 * ========================================================================== */

const inicial = planoParaFlow(planoVazio());

export const useCanvasStore = create<CanvasStore>()(
  subscribeWithSelector((set, get) => ({
    nodes: inicial.nodes,
    edges: inicial.edges,
    selectedId: null,
    planoNome: inicial.planoNome,
    flowMode: inicial.flowMode,

    onNodesChange: (changes) =>
      set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) as FlowNode[] })),

    onEdgesChange: (changes) =>
      set((s) => ({ edges: applyEdgeChanges(changes, s.edges) as FlowEdge[] })),

    onConnect: (connection) => {
      if (!connection.source || !connection.target) return;
      const novaAresta: FlowEdge = {
        id: uid('e'),
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle ?? null,
        targetHandle: connection.targetHandle ?? null,
        type: 'pj',
        data: defaultEdgeData(),
      };
      set((s) => ({ edges: rfAddEdge(novaAresta, s.edges) as FlowEdge[] }));
    },

    createNode: (position) => {
      const id = uid('n');
      set((s) => ({
        nodes: [
          ...s.nodes,
          { id, type: 'localizador', position, data: defaultLocalizadorData() },
        ],
        selectedId: id,
      }));
      return id;
    },

    updateNode: (id, patch) =>
      set((s) => ({
        nodes: s.nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, ...patch } } : n,
        ),
      })),

    updateEdge: (id, patch) =>
      set((s) => ({
        edges: s.edges.map((e) =>
          e.id === id
            ? { ...e, data: { ...(e.data ?? defaultEdgeData()), ...patch } }
            : e,
        ),
      })),

    deleteNode: (id) =>
      set((s) => ({
        nodes: s.nodes.filter((n) => n.id !== id),
        edges: s.edges.filter((e) => e.source !== id && e.target !== id),
        selectedId: s.selectedId === id ? null : s.selectedId,
      })),

    deleteEdge: (id) =>
      set((s) => ({
        edges: s.edges.filter((e) => e.id !== id),
        selectedId: s.selectedId === id ? null : s.selectedId,
      })),

    setSelectedId: (id) => set({ selectedId: id }),
    setPlanoNome: (nome) => set({ planoNome: nome }),
    setFlowMode: (mode) => set({ flowMode: mode }),

    toggleNodeCreated: (id) =>
      set((s) => ({
        nodes: s.nodes.map((n) =>
          n.id === id
            ? { ...n, data: { ...n.data, ja_criado: !n.data.ja_criado } }
            : n,
        ),
      })),

    toggleSubitemCreated: (edgeId, index) =>
      set((s) => ({
        edges: s.edges.map((e) => {
          if (e.id !== edgeId) return e;
          const data = e.data ?? defaultEdgeData();
          const subitems = data.subitems.map((sub, i) =>
            i === index ? { ...sub, ja_criado: !sub.ja_criado } : sub,
          );
          return { ...e, data: { ...data, subitems } };
        }),
      })),

    toggleEdgeRuleCreated: (edgeId) =>
      set((s) => ({
        edges: s.edges.map((e) => {
          if (e.id !== edgeId) return e;
          const data = e.data ?? defaultEdgeData();
          if (data.kind === 'manual') return e;
          if (data.kind === 'atp') {
            const rule = data.atp ?? defaultAtpRule();
            return {
              ...e,
              data: { ...data, atp: { ...rule, ja_criado: !rule.ja_criado } },
            };
          }
          const rule = data.pref ?? defaultPrefRule();
          return {
            ...e,
            data: { ...data, pref: { ...rule, ja_criado: !rule.ja_criado } },
          };
        }),
      })),

    loadPlano: (plano) => {
      const flow = planoParaFlow(plano);
      set({
        nodes: flow.nodes,
        edges: flow.edges,
        planoNome: flow.planoNome,
        flowMode: flow.flowMode,
        selectedId: null,
      });
    },

    getPlano: () => flowParaPlano(get()),
  })),
);

/* ============================================================================
 * Persistência reativa.
 *
 * A assinatura observa apenas o slice persistível; mudanças de seleção não
 * disparam gravação. `shallow` compara o array elemento-a-elemento, então
 * trocar `nodes` ou `edges` por novas referências (o que toda mutação faz)
 * é detectado.
 * ========================================================================== */

const debouncedSave = criarSavePlanoDebounced();

useCanvasStore.subscribe(
  (s) => [s.nodes, s.edges, s.planoNome, s.flowMode] as const,
  () => debouncedSave(useCanvasStore.getState().getPlano()),
  { equalityFn: shallow },
);

/**
 * Forço a gravação de qualquer plano pendente. Usado em `beforeunload` (Fase 6)
 * e em testes que precisam observar o estado persistido sem esperar o debounce.
 */
export function flushPersist(): void {
  debouncedSave.flush();
}

/**
 * Cancela qualquer gravação pendente. Usado em testes para isolar cenários.
 */
export function cancelPersist(): void {
  debouncedSave.cancel();
}
