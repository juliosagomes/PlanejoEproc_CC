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
import {
  CORES_FLAG,
  SCHEMA_VERSION,
  alvoReal,
  flagsPadrao,
  molduraEnvolvendo,
  reagruparSoltos,
  type GrupoLocalizadores,
  type AcaoPreferencialPlanejada,
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
import {
  aplicarMudancasGrupos,
  reagruparAposArrasto,
  retanguloDoNo,
  type GrupoFlow,
} from './grupoMudancas';

/* ============================================================================
 * STORE DO CANVAS
 *
 * Holds the ReactFlow `Node`/`Edge` shapes (ReactFlow precisa deles assim) e
 * mantém também `selectedId`, `planoNome`, `flowMode`.
 *
 * Seleção: a verdade é o campo `selected` de cada nó e aresta, que o próprio
 * ReactFlow escreve (clique, Ctrl+clique, Shift+arrastar em caixa).
 * `selectedId` é derivado — o item quando há **exatamente um** selecionado, que
 * é quando faz sentido abrir o painel de detalhes; com dois ou mais ele é
 * `null` e o canvas mostra a barra de ações em lote. Conversão para o tipo
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
  /**
   * Molduras de grupo (decisoes.md#D-31). Fora de `nodes` de propósito: o resto
   * do app lê `nodes` como "os localizadores", e misturar molduras ali faria
   * cada filtro precisar lembrar de pulá-las. O `FlowCanvas` junta as duas
   * listas na hora de desenhar.
   */
  grupos: GrupoFlow[];
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

  // Ações preferenciais planejadas (decisoes.md#D-28)
  /** Vincula uma preferência ao localizador. Devolve o id, ou `''` em visualização. */
  addAcaoPreferencial: (nodeId: string, nome: string, ja_criado?: boolean) => string;
  updateAcaoPreferencial: (
    nodeId: string,
    acaoId: string,
    patch: Partial<Omit<AcaoPreferencialPlanejada, 'id'>>,
  ) => void;
  removeAcaoPreferencial: (nodeId: string, acaoId: string) => void;

  // Atalhos (decisoes.md#D-30)
  /**
   * Cria um atalho para o localizador `alvoId`, logo abaixo dele, e o seleciona.
   * Devolve o id, ou `''` em visualização ou alvo inexistente.
   */
  criarAtalho: (alvoId: string) => string;

  // Grupos (decisoes.md#D-31)
  /** Cria uma moldura em volta dos nós e a seleciona. Devolve o id, ou `''`. */
  criarGrupo: (nodeIds: string[]) => string;
  atualizarGrupo: (
    id: string,
    patch: Partial<Pick<GrupoLocalizadores, 'rotulo' | 'cor' | 'recolhido'>>,
  ) => void;
  /** Desfaz a moldura; os localizadores ficam onde estão. */
  removerGrupo: (id: string) => void;

  // Seleção múltipla (Card 7)
  /** Apaga os nós e arestas selecionados, e as arestas que tocam nos nós. */
  deleteSelecao: () => void;
  /** Reposiciona vários nós de uma vez (alinhar). Ids ausentes são ignorados. */
  moverNos: (posicoes: Record<string, Position>) => void;
  /** Liga ou desliga um setor em vários nós de uma vez. */
  marcarFlagEmLote: (nodeIds: string[], flagId: string, ligar: boolean) => void;

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
  grupos: GrupoFlow[];
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
    grupos: plano.grupos ?? [],
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
    // Ausente, e não `[]`, quando não há grupo: plano sem moldura não muda de forma.
    ...(state.grupos.length > 0
      ? { grupos: state.grupos.map(({ selected: _s, ...g }) => g) }
      : {}),
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

/** Marca como selecionados exatamente os itens de `ids`, preservando identidade dos que não mudam. */
function comSelecao<T extends { id: string; selected?: boolean }>(
  itens: T[],
  ids: ReadonlySet<string>,
): T[] {
  return itens.map((i) => (!!i.selected === ids.has(i.id) ? i : { ...i, selected: ids.has(i.id) }));
}

/** Tira os ids de todo grupo, preservando a identidade dos grupos que não mudam. */
function semMembros(grupos: GrupoFlow[], ids: ReadonlySet<string>): GrupoFlow[] {
  return grupos.map((g) =>
    g.membros.some((m) => ids.has(m)) ? { ...g, membros: g.membros.filter((m) => !ids.has(m)) } : g,
  );
}

function unicoSelecionado(
  nodes: FlowNode[],
  edges: FlowEdge[],
  grupos: GrupoFlow[] = [],
): string | null {
  const ns = nodes.filter((n) => n.selected);
  const es = edges.filter((e) => e.selected);
  const gs = grupos.filter((g) => g.selected);
  if (ns.length + es.length + gs.length !== 1) return null;
  return ns[0]?.id ?? es[0]?.id ?? gs[0]?.id ?? null;
}

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
    grupos: [],

    // Em visualização, filtramos em vez de ignorar: `dimensions` e `select` são
    // o ReactFlow medindo e destacando o que já está na tela, e barrá-las
    // quebraria o desenho das arestas. `position` e `remove` são edição.
    onNodesChange: (changes) => {
      const efetivas = get().somenteLeitura
        ? changes.filter((c) => c.type === 'dimensions' || c.type === 'select')
        : changes;
      if (efetivas.length === 0) return;
      set((s) => {
        // As molduras chegam no mesmo fluxo que os localizadores; cada uma vai
        // para o seu lado.
        const idsGrupo = new Set(s.grupos.map((g) => g.id));
        const deGrupo = efetivas.filter((c) => 'id' in c && idsGrupo.has(c.id));
        const deNo = efetivas.filter((c) => !('id' in c && idsGrupo.has(c.id)));
        let nodes = deNo.length > 0 ? (applyNodeChanges(deNo, s.nodes) as FlowNode[]) : s.nodes;
        let grupos = s.grupos;
        if (deGrupo.length > 0) ({ grupos, nodes } = aplicarMudancasGrupos(grupos, nodes, deGrupo));
        grupos = reagruparAposArrasto(grupos, nodes, deNo);
        if (!efetivas.some((c) => c.type === 'select' || c.type === 'remove')) {
          return { nodes, grupos };
        }
        return { nodes, grupos, selectedId: unicoSelecionado(nodes, s.edges, grupos) };
      });
    },

    onEdgesChange: (changes) => {
      const efetivas = get().somenteLeitura
        ? changes.filter((c) => c.type === 'select')
        : changes;
      if (efetivas.length === 0) return;
      set((s) => {
        const edges = applyEdgeChanges(efetivas, s.edges) as FlowEdge[];
        if (!efetivas.some((c) => c.type === 'select')) return { edges };
        return { edges, selectedId: unicoSelecionado(s.nodes, edges, s.grupos) };
      });
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
      set((s) => {
        const novo: FlowNode = {
          id,
          type: 'localizador',
          position,
          data: defaultLocalizadorData(),
          selected: true,
        };
        return {
          nodes: [...comSelecao(s.nodes, new Set()), novo],
          edges: comSelecao(s.edges, new Set()),
          // Nó criado dentro de uma moldura já nasce membro dela.
          grupos: comSelecao(
            reagruparSoltos(s.grupos, [retanguloDoNo(novo)]) as GrupoFlow[],
            new Set(),
          ),
          selectedId: id,
        };
      });
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
      if (get().grupos.some((g) => g.id === id)) {
        get().removerGrupo(id);
        return;
      }
      set((s) => ({
        grupos: semMembros(s.grupos, new Set([id])),
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

    criarAtalho: (alvoId) => {
      if (get().somenteLeitura) return '';
      const alvo = alvoReal(get().nodes, alvoId);
      const no = get().nodes.find((n) => n.id === alvo);
      if (!alvo || !no) return '';
      const id = uid('n');
      set((s) => ({
        nodes: [
          ...comSelecao(s.nodes, new Set()),
          {
            id,
            type: 'localizador',
            position: { x: no.position.x + 40, y: no.position.y + 110 },
            data: { nome: '', ja_criado: false, flags: [], atalhoPara: alvo },
            selected: true,
          },
        ],
        edges: comSelecao(s.edges, new Set()),
        selectedId: id,
      }));
      return id;
    },

    addAcaoPreferencial: (nodeId, nome, ja_criado = false) => {
      if (get().somenteLeitura) return '';
      const id = uid('ap');
      set((s) => ({
        nodes: s.nodes.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  acoesPreferenciais: [...(n.data.acoesPreferenciais ?? []), { id, nome, ja_criado }],
                },
              }
            : n,
        ),
      }));
      return id;
    },

    updateAcaoPreferencial: (nodeId, acaoId, patch) => {
      if (get().somenteLeitura) return;
      set((s) => ({
        nodes: s.nodes.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  acoesPreferenciais: (n.data.acoesPreferenciais ?? []).map((a) =>
                    a.id === acaoId ? { ...a, ...patch } : a,
                  ),
                },
              }
            : n,
        ),
      }));
    },

    // A lista vazia some do nó em vez de ficar `[]`: o campo é opcional, e um
    // plano que nunca planejou ação nenhuma não deveria mudar de forma por ter
    // tido uma e apagado.
    removeAcaoPreferencial: (nodeId, acaoId) => {
      if (get().somenteLeitura) return;
      set((s) => ({
        nodes: s.nodes.map((n) => {
          if (n.id !== nodeId) return n;
          const resto = (n.data.acoesPreferenciais ?? []).filter((a) => a.id !== acaoId);
          const { acoesPreferenciais: _antigas, ...data } = n.data;
          return { ...n, data: resto.length > 0 ? { ...data, acoesPreferenciais: resto } : data };
        }),
      }));
    },

    criarGrupo: (nodeIds) => {
      if (get().somenteLeitura) return '';
      const alvo = new Set(nodeIds);
      const membros = get().nodes.filter((n) => alvo.has(n.id));
      const moldura = molduraEnvolvendo(membros.map(retanguloDoNo));
      if (!moldura) return '';
      const id = uid('g');
      const cor = CORES_FLAG[get().grupos.length % CORES_FLAG.length] ?? CORES_FLAG[0];
      const grupo: GrupoFlow = {
        id,
        rotulo: 'Novo grupo',
        cor,
        position: { x: moldura.x, y: moldura.y },
        largura: moldura.largura,
        altura: moldura.altura,
        membros: membros.map((n) => n.id),
        selected: true,
      };
      set((s) => ({
        // Um localizador é membro de um grupo só: entrar neste o tira dos outros.
        grupos: [...comSelecao(semMembros(s.grupos, alvo), new Set()), grupo],
        nodes: comSelecao(s.nodes, new Set()),
        edges: comSelecao(s.edges, new Set()),
        selectedId: id,
      }));
      return id;
    },

    atualizarGrupo: (id, patch) => {
      if (get().somenteLeitura) return;
      set((s) => {
        const grupos = s.grupos.map((g) => (g.id === id ? { ...g, ...patch } : g));
        const alvo = grupos.find((g) => g.id === id);
        if (!patch.recolhido || !alvo) return { grupos };
        // Recolher esconde os membros e as setas entre eles. Seleção que fica
        // escondida é armadilha: o Delete e a barra de lote agiriam sobre o que
        // não está na tela.
        const membros = new Set(alvo.membros);
        const desmarcar = <T extends { id: string; selected?: boolean }>(
          itens: T[],
          some: (i: T) => boolean,
        ): T[] => itens.map((i) => (i.selected && some(i) ? { ...i, selected: false } : i));
        const nodes = desmarcar(s.nodes, (n) => membros.has(n.id));
        const edges = desmarcar(s.edges, (e) => membros.has(e.source) && membros.has(e.target));
        return { grupos, nodes, edges, selectedId: unicoSelecionado(nodes, edges, grupos) };
      });
    },

    removerGrupo: (id) => {
      if (get().somenteLeitura) return;
      set((s) => ({
        grupos: s.grupos.filter((g) => g.id !== id),
        selectedId: s.selectedId === id ? null : s.selectedId,
      }));
    },

    deleteSelecao: () => {
      if (get().somenteLeitura) return;
      set((s) => {
        const nos = new Set(s.nodes.filter((n) => n.selected).map((n) => n.id));
        return {
          grupos: semMembros(s.grupos.filter((g) => !g.selected), nos),
          nodes: s.nodes.filter((n) => !nos.has(n.id)),
          edges: s.edges.filter((e) => !e.selected && !nos.has(e.source) && !nos.has(e.target)),
          selectedId: null,
        };
      });
    },

    moverNos: (posicoes) => {
      if (get().somenteLeitura) return;
      set((s) => ({
        nodes: s.nodes.map((n) => {
          const p = posicoes[n.id];
          return p ? { ...n, position: { x: p.x, y: p.y } } : n;
        }),
      }));
    },

    marcarFlagEmLote: (nodeIds, flagId, ligar) => {
      if (get().somenteLeitura) return;
      const alvo = new Set(nodeIds);
      set((s) => ({
        nodes: s.nodes.map((n) => {
          if (!alvo.has(n.id) || n.data.flags.includes(flagId) === ligar) return n;
          const flags = ligar
            ? [...n.data.flags, flagId]
            : n.data.flags.filter((x) => x !== flagId);
          return { ...n, data: { ...n.data, flags } };
        }),
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

    // Também acerta as marcas do ReactFlow: quem seleciona por fora do canvas
    // (checklist, criação de nó) não pode deixar a seleção anterior acesa.
    setSelectedId: (id) =>
      set((s) => {
        const ids = new Set(id === null ? [] : [id]);
        return {
          selectedId: id,
          nodes: comSelecao(s.nodes, ids),
          edges: comSelecao(s.edges, ids),
          grupos: comSelecao(s.grupos, ids),
        };
      }),

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
        grupos: flow.grupos,
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
 * disparam gravação. A comparação desce um nível em `nodes` e `edges` e ignora
 * os campos de tela que o ReactFlow escreve (`CAMPOS_DE_TELA`): a seleção mora
 * nos próprios nós (Card 7), e sem isso todo clique regravaria o plano.
 * ========================================================================== */

const debouncedSave = criarSavePlanoDebounced();

/**
 * Campos que o ReactFlow escreve nos nós e arestas e que **não** vão para o
 * `Plano` (`flowParaPlano` os descarta). Mudança só neles — selecionar, medir —
 * não é motivo para gravar.
 */
const CAMPOS_DE_TELA = new Set(['selected', 'dragging', 'width', 'height', 'positionAbsolute']);

function mesmoItemPersistido(a: object, b: object): boolean {
  if (a === b) return true;
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  const chaves = new Set([...Object.keys(ra), ...Object.keys(rb)]);
  for (const k of chaves) {
    if (CAMPOS_DE_TELA.has(k)) continue;
    if (!Object.is(ra[k], rb[k])) return false;
  }
  return true;
}

function mesmaListaPersistida(a: readonly object[], b: readonly object[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((item, i) => {
    const outro = b[i];
    return outro !== undefined && mesmoItemPersistido(item, outro);
  });
}

useCanvasStore.subscribe(
  (s) => [s.nodes, s.edges, s.planoNome, s.flowMode, s.flags, s.grupos] as const,
  () => {
    // Em visualização, o que sobra de mutação são as medições do ReactFlow e o
    // modo de desenho — nada que valha gravar, e gravar carimbaria
    // `atualizadoEm` no índice de uma lotação que não é nossa para mexer.
    const estado = useCanvasStore.getState();
    if (estado.somenteLeitura) return;
    debouncedSave(estado.getPlano());
  },
  {
    equalityFn: (a, b) =>
      mesmaListaPersistida(a[0], b[0]) &&
      mesmaListaPersistida(a[1], b[1]) &&
      a[2] === b[2] &&
      a[3] === b[3] &&
      a[4] === b[4] &&
      mesmaListaPersistida(a[5], b[5]),
  },
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
