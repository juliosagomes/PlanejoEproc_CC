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
  flagsPadrao,
  type AtpRule,
  type DefinicaoFlag,
  type DobraAresta,
  type EdgeData,
  type FlowMode,
  type LocalizadorData,
  type Plano,
  type Position,
  type PrefRule,
} from '@/domain';
import { flushPlataforma } from '@/infra/plataforma';
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
 * `[nodes, edges, planoNome, flowMode, flags]` (com igualdade rasa) e dispara
 * `criarSavePlanoDebounced()`. `selectedId` e `filtroFlags` mudam sem forçar
 * gravação.
 * ========================================================================== */

export type FlowNode = RFNode<LocalizadorData>;
export type FlowEdge = RFEdge<EdgeData>;

interface CanvasState {
  nodes: FlowNode[];
  edges: FlowEdge[];
  selectedId: string | null;
  planoNome: string;
  flowMode: FlowMode;
  /**
   * Espelho da lista de setores da **unidade** (decisoes.md#D-26). Quem é dona
   * dela é `features/setores/store.ts`; aqui ela existe para os componentes do
   * canvas lerem num lugar só, e para `getPlano()` gravar o retrato que viaja
   * dentro do plano exportado ou publicado.
   *
   * Continua no slice persistido de propósito: renomear um setor precisa
   * regravar o plano ativo com o retrato novo.
   */
  flags: DefinicaoFlag[];
  /**
   * Quais flags estão realçadas no canvas agora. Vazio = nada esmaecido.
   *
   * Não é persistido nem entra no `Plano`: é ajuste de visualização desta aba,
   * como o zoom. Gravá-lo faria "olhar o trabalho do Setor de Cálculo" virar
   * uma alteração do plano da unidade inteira.
   */
  filtroFlags: string[];
  /**
   * Sessão de visualização (código de leitura de uma lotação). Toda ação que
   * muda o conteúdo do plano vira no-op, e a persistência é desligada.
   *
   * O guarda mora aqui, e não só na UI, porque esconder botão não é garantia:
   * atalho de teclado, `EdgeDetailModal` já aberto quando a sessão trocou, ou
   * um componente novo que alguém esqueça de gatilhar continuariam gravando.
   * A UI ainda desabilita os controles — isto é a rede embaixo dela.
   *
   * Quem escreve é `features/sessao/store.ts`, no mesmo ponto em que fixa o
   * escopo de armazenamento.
   */
  somenteLeitura: boolean;
}

interface CanvasActions {
  // Integração com ReactFlow
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;

  // Mutações de domínio
  /** Devolve o id do nó criado, ou `''` quando a sessão é de visualização. */
  createNode: (position: Position) => string;
  updateNode: (id: string, patch: Partial<LocalizadorData>) => void;
  updateEdge: (id: string, patch: Partial<EdgeData>) => void;
  /**
   * Move (ou zera) a dobra manual da aresta no modo Diagrama.
   *
   * Ação própria em vez de `updateEdge(id, { dobra: undefined })` porque o
   * spread do `updateEdge` deixaria a chave presente valendo `undefined` —
   * some do JSON, mas fica no objeto em memória, e "restaurar automático" é
   * exatamente o caso em que essa sutileza morderia.
   */
  setDobra: (id: string, dobra?: DobraAresta) => void;
  deleteNode: (id: string) => void;
  deleteEdge: (id: string) => void;

  // Setores (decisoes.md#D-22, D-26)
  /** Atualiza o espelho. Chamada pela store de setores, dona da lista. */
  setFlags: (flags: DefinicaoFlag[]) => void;
  /** Tira o setor removido dos nós do plano aberto e do realce. */
  removerMarcacaoDeFlag: (id: string) => void;
  toggleFlagNoNo: (nodeId: string, flagId: string) => void;
  setFiltroFlags: (ids: string[]) => void;

  // Setters de estado simples
  setSelectedId: (id: string | null) => void;
  setPlanoNome: (nome: string) => void;
  setFlowMode: (mode: FlowMode) => void;
  setSomenteLeitura: (valor: boolean) => void;

  // Toggles de "já criado"
  toggleNodeCreated: (id: string) => void;
  toggleSubitemCreated: (edgeId: string, index: number) => void;

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
  return { nome: '', ja_criado: false, flags: [] };
}

export function defaultEdgeData(): EdgeData {
  return { kind: 'manual', resumo: '', observacao: '', subitems: [] };
}

export function defaultAtpRule(): AtpRule {
  return { implantar: false };
}

export function defaultPrefRule(): PrefRule {
  return { implantar: false };
}

/* ============================================================================
 * Conversores entre o shape do domain e o shape que ReactFlow consome.
 * ========================================================================== */

/**
 * `flags` fica de fora: a lista é da unidade, não do plano, e o retrato que vem
 * dentro dele já foi absorvido por `consolidarSetores` antes de chegar aqui.
 */
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
    flags: state.flags,
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
    flags: flagsPadrao(),
    filtroFlags: [],
    somenteLeitura: false,

    // Em visualização, filtramos em vez de ignorar: `dimensions` e `select` são
    // o ReactFlow medindo e destacando o que já está na tela, e barrá-las
    // quebraria o desenho das arestas. `position` e `remove` são edição.
    onNodesChange: (changes) => {
      const efetivas = get().somenteLeitura
        ? changes.filter((c) => c.type === 'dimensions' || c.type === 'select')
        : changes;
      if (efetivas.length === 0) return;
      set((s) => ({ nodes: applyNodeChanges(efetivas, s.nodes) as FlowNode[] }));
    },

    onEdgesChange: (changes) => {
      const efetivas = get().somenteLeitura
        ? changes.filter((c) => c.type === 'select')
        : changes;
      if (efetivas.length === 0) return;
      set((s) => ({ edges: applyEdgeChanges(efetivas, s.edges) as FlowEdge[] }));
    },

    onConnect: (connection) => {
      if (get().somenteLeitura) return;
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
      if (get().somenteLeitura) return '';
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

    updateNode: (id, patch) => {
      if (get().somenteLeitura) return;
      set((s) => ({
        nodes: s.nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, ...patch } } : n,
        ),
      }));
    },

    updateEdge: (id, patch) => {
      if (get().somenteLeitura) return;
      set((s) => ({
        edges: s.edges.map((e) =>
          e.id === id
            ? { ...e, data: { ...(e.data ?? defaultEdgeData()), ...patch } }
            : e,
        ),
      }));
    },

    // A dobra é conteúdo do plano — diferente do `flowMode`, que é só como o
    // plano é desenhado —, então respeita a trava de visualização.
    setDobra: (id, dobra) => {
      if (get().somenteLeitura) return;
      set((s) => ({
        edges: s.edges.map((e) => {
          if (e.id !== id) return e;
          const { dobra: _antiga, ...resto } = e.data ?? defaultEdgeData();
          return { ...e, data: dobra === undefined ? resto : { ...resto, dobra } };
        }),
      }));
    },

    deleteNode: (id) => {
      if (get().somenteLeitura) return;
      set((s) => ({
        nodes: s.nodes.filter((n) => n.id !== id),
        edges: s.edges.filter((e) => e.source !== id && e.target !== id),
        selectedId: s.selectedId === id ? null : s.selectedId,
      }));
    },

    deleteEdge: (id) => {
      if (get().somenteLeitura) return;
      set((s) => ({
        edges: s.edges.filter((e) => e.id !== id),
        selectedId: s.selectedId === id ? null : s.selectedId,
      }));
    },

    // Sem guarda de `somenteLeitura`: é a store de setores que decide se pode
    // mexer na lista; aqui o espelho só reflete o que ela resolveu, e em
    // visualização a lista chega calculada em memória, sem gravação.
    setFlags: (flags) => set({ flags }),

    // Limpar a marcação dos nós é parte da remoção, não faxina posterior: um id
    // órfão não aparece no chip, mas voltaria a valer se alguém criasse uma
    // flag nova reaproveitando o id — e a migração usa ids fixos justamente
    // para os quatro nomes históricos. Os outros planos do silo são varridos
    // pela store de setores, que é quem enxerga o silo inteiro.
    removerMarcacaoDeFlag: (id) => {
      if (get().somenteLeitura) return;
      set((s) => ({
        nodes: s.nodes.map((n) =>
          n.data.flags.includes(id)
            ? { ...n, data: { ...n.data, flags: n.data.flags.filter((x) => x !== id) } }
            : n,
        ),
        filtroFlags: s.filtroFlags.filter((x) => x !== id),
      }));
    },

    toggleFlagNoNo: (nodeId, flagId) => {
      if (get().somenteLeitura) return;
      set((s) => ({
        nodes: s.nodes.map((n) => {
          if (n.id !== nodeId) return n;
          const tem = n.data.flags.includes(flagId);
          return {
            ...n,
            data: {
              ...n.data,
              flags: tem
                ? n.data.flags.filter((x) => x !== flagId)
                : [...n.data.flags, flagId],
            },
          };
        }),
      }));
    },

    // Sem guarda: filtrar é olhar, não editar. Vale em visualização, como o
    // `flowMode`, e não é persistido.
    setFiltroFlags: (ids) => set({ filtroFlags: ids }),

    setSelectedId: (id) => set({ selectedId: id }),

    setPlanoNome: (nome) => {
      if (get().somenteLeitura) return;
      set({ planoNome: nome });
    },

    // Sem guarda de propósito: `flowMode` é como o plano é *desenhado* na tela,
    // não o que ele diz. Trocar Orgânico/Diagrama continua valendo em
    // visualização — e como a persistência está desligada nesse modo, a escolha
    // vive só nesta aba e não vira alteração no plano de ninguém.
    setFlowMode: (mode) => set({ flowMode: mode }),

    setSomenteLeitura: (valor) => set({ somenteLeitura: valor }),

    toggleNodeCreated: (id) => {
      if (get().somenteLeitura) return;
      set((s) => ({
        nodes: s.nodes.map((n) =>
          n.id === id
            ? { ...n, data: { ...n.data, ja_criado: !n.data.ja_criado } }
            : n,
        ),
      }));
    },

    toggleSubitemCreated: (edgeId, index) => {
      if (get().somenteLeitura) return;
      set((s) => ({
        edges: s.edges.map((e) => {
          if (e.id !== edgeId) return e;
          const data = e.data ?? defaultEdgeData();
          const subitems = data.subitems.map((sub, i) =>
            i === index ? { ...sub, ja_criado: !sub.ja_criado } : sub,
          );
          return { ...e, data: { ...data, subitems } };
        }),
      }));
    },

    // `flags` fica intacta: a lista é da unidade e vale para todos os planos do
    // silo, então trocar de plano não a troca. `filtroFlags` zera, sim — o
    // realce é sobre os nós que saíram da tela, e mantê-lo esmaeceria o plano
    // novo sem que nada explicasse por quê.
    loadPlano: (plano) => {
      const flow = planoParaFlow(plano);
      set({
        nodes: flow.nodes,
        edges: flow.edges,
        planoNome: flow.planoNome,
        flowMode: flow.flowMode,
        filtroFlags: [],
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
  (s) => [s.nodes, s.edges, s.planoNome, s.flowMode, s.flags] as const,
  () => {
    // Em visualização, o que sobra de mutação são as medições do ReactFlow e o
    // modo de desenho — nada que valha gravar, e gravar carimbaria
    // `atualizadoEm` no índice de uma lotação que não é nossa para mexer.
    const estado = useCanvasStore.getState();
    if (estado.somenteLeitura) return;
    debouncedSave(estado.getPlano());
  },
  { equalityFn: shallow },
);

/**
 * Forço a gravação de qualquer plano pendente. Usado em `beforeunload` (Fase 6)
 * e em testes que precisam observar o estado persistido sem esperar o debounce.
 *
 * O `flushPlataforma()` no fim é o que faz isso valer na extensão: o debounce
 * grava no espelho síncrono, e o espelho só emite o `chrome.storage.set` na
 * microtask seguinte — que pode nunca chegar num `beforeunload`.
 */
export function flushPersist(): void {
  // Numa sessão de visualização não há gravação legítima a forçar: o que
  // estivesse pendente foi agendado depois da trava ligar, ou seja, é
  // exatamente o que não deve ir para o disco. Descartar aqui fecha a última
  // fresta — a assinatura já não agenda nada, mas um save de milissegundos
  // antes da troca de sessão ainda chegaria vivo até este flush.
  if (useCanvasStore.getState().somenteLeitura) debouncedSave.cancel();
  else debouncedSave.flush();
  flushPlataforma();
}

/**
 * Cancela qualquer gravação pendente. Usado em testes para isolar cenários.
 */
export function cancelPersist(): void {
  debouncedSave.cancel();
}
