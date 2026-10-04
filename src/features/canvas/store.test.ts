import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SCHEMA_VERSION, type Plano } from '@/domain';
import { getActivePlanKey, setEscopo } from '@/infra/storage';
import {
  cancelPersist,
  defaultEdgeData,
  defaultLocalizadorData,
  flushPersist,
  useCanvasStore,
} from './store';

const ESTADO_INICIAL = {
  nodes: [],
  edges: [],
  selectedId: null,
  planoNome: 'Plano sem título',
  flowMode: 'organic' as const,
  flags: [],
  filtroFlags: [],
  somenteLeitura: false,
  grupos: [],
};

beforeEach(() => {
  // Cancela qualquer gravação pendente que tenha sobrado de outro teste antes
  // de zerar o storage; senão um flush atrasado poderia repor a chave.
  cancelPersist();
  localStorage.clear();
  // A persistência é no-op sem escopo (o app só o define depois do login);
  // estes testes exercitam o comportamento dentro de uma sessão.
  setEscopo({ tipo: 'local' });
  useCanvasStore.setState(ESTADO_INICIAL);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createNode', () => {
  it('adiciona um nó com data default e seleciona o novo id', () => {
    const id = useCanvasStore.getState().createNode({ x: 10, y: 20 });

    const s = useCanvasStore.getState();
    expect(s.nodes).toHaveLength(1);
    expect(s.nodes[0]?.id).toBe(id);
    expect(s.nodes[0]?.type).toBe('localizador');
    expect(s.nodes[0]?.position).toEqual({ x: 10, y: 20 });
    expect(s.nodes[0]?.data).toEqual(defaultLocalizadorData());
    expect(s.selectedId).toBe(id);
  });
});

describe('updateNode', () => {
  it('aplica patch parcial preservando os demais campos de data', () => {
    const id = useCanvasStore.getState().createNode({ x: 0, y: 0 });
    useCanvasStore.getState().updateNode(id, {
      nome: 'Aguardando despacho',
      flags: ['flag-espera'],
    });

    const data = useCanvasStore.getState().nodes[0]?.data;
    expect(data?.nome).toBe('Aguardando despacho');
    expect(data?.flags).toEqual(['flag-espera']);
    expect(data?.ja_criado).toBe(false); // intacto
  });
});

describe('deleteNode', () => {
  it('remove o nó e cascateia em arestas conectadas', () => {
    const a = useCanvasStore.getState().createNode({ x: 0, y: 0 });
    const b = useCanvasStore.getState().createNode({ x: 100, y: 0 });
    useCanvasStore.getState().onConnect({
      source: a,
      target: b,
      sourceHandle: null,
      targetHandle: null,
    });
    expect(useCanvasStore.getState().edges).toHaveLength(1);

    useCanvasStore.getState().deleteNode(a);

    const s = useCanvasStore.getState();
    expect(s.nodes.map((n) => n.id)).toEqual([b]);
    expect(s.edges).toEqual([]);
  });

  it('limpa selectedId quando o nó deletado estava selecionado', () => {
    const id = useCanvasStore.getState().createNode({ x: 0, y: 0 });
    expect(useCanvasStore.getState().selectedId).toBe(id);

    useCanvasStore.getState().deleteNode(id);
    expect(useCanvasStore.getState().selectedId).toBeNull();
  });
});

describe('onConnect', () => {
  it('cria aresta com kind=manual por default', () => {
    const a = useCanvasStore.getState().createNode({ x: 0, y: 0 });
    const b = useCanvasStore.getState().createNode({ x: 100, y: 0 });
    useCanvasStore.getState().onConnect({
      source: a,
      target: b,
      sourceHandle: null,
      targetHandle: null,
    });

    const e = useCanvasStore.getState().edges[0];
    expect(e?.source).toBe(a);
    expect(e?.target).toBe(b);
    expect(e?.type).toBe('pj');
    expect(e?.data).toEqual(defaultEdgeData());
  });

  it('ignora connection sem source ou target', () => {
    useCanvasStore.getState().onConnect({
      source: null,
      target: null,
      sourceHandle: null,
      targetHandle: null,
    });
    expect(useCanvasStore.getState().edges).toEqual([]);
  });
});

describe('updateEdge / deleteEdge', () => {
  it('updateEdge muda kind e mantém os demais campos', () => {
    const a = useCanvasStore.getState().createNode({ x: 0, y: 0 });
    const b = useCanvasStore.getState().createNode({ x: 100, y: 0 });
    useCanvasStore.getState().onConnect({
      source: a,
      target: b,
      sourceHandle: null,
      targetHandle: null,
    });
    const id = useCanvasStore.getState().edges[0]?.id;
    if (!id) throw new Error('aresta não criada');

    useCanvasStore.getState().updateEdge(id, { kind: 'atp', resumo: 'após citação' });

    const data = useCanvasStore.getState().edges[0]?.data;
    expect(data?.kind).toBe('atp');
    expect(data?.resumo).toBe('após citação');
    expect(data?.subitems).toEqual([]); // intacto
  });

  it('deleteEdge remove e limpa selectedId quando aplicável', () => {
    const a = useCanvasStore.getState().createNode({ x: 0, y: 0 });
    const b = useCanvasStore.getState().createNode({ x: 100, y: 0 });
    useCanvasStore.getState().onConnect({
      source: a,
      target: b,
      sourceHandle: null,
      targetHandle: null,
    });
    const id = useCanvasStore.getState().edges[0]?.id;
    if (!id) throw new Error('aresta não criada');

    useCanvasStore.getState().setSelectedId(id);
    useCanvasStore.getState().deleteEdge(id);

    const s = useCanvasStore.getState();
    expect(s.edges).toEqual([]);
    expect(s.selectedId).toBeNull();
  });
});

describe('setDobra', () => {
  function arestaDeTeste(): string {
    const a = useCanvasStore.getState().createNode({ x: 0, y: 0 });
    const b = useCanvasStore.getState().createNode({ x: 300, y: 0 });
    useCanvasStore.getState().onConnect({
      source: a,
      target: b,
      sourceHandle: null,
      targetHandle: null,
    });
    const id = useCanvasStore.getState().edges[0]?.id;
    if (!id) throw new Error('aresta não criada');
    return id;
  }

  it('grava a dobra sem tocar no resto do data', () => {
    const id = arestaDeTeste();
    useCanvasStore.getState().updateEdge(id, { resumo: 'após citação' });

    useCanvasStore.getState().setDobra(id, { fracaoX: 0.8 });

    const data = useCanvasStore.getState().edges[0]?.data;
    expect(data?.dobra).toEqual({ fracaoX: 0.8 });
    expect(data?.resumo).toBe('após citação');
  });

  // Sem argumento é "restaurar automático" — a chave tem que sumir do objeto,
  // não ficar valendo `undefined`.
  it('sem dobra remove a chave', () => {
    const id = arestaDeTeste();
    useCanvasStore.getState().setDobra(id, { fracaoX: 0.8 });

    useCanvasStore.getState().setDobra(id);

    const data = useCanvasStore.getState().edges[0]?.data;
    expect(data && 'dobra' in data).toBe(false);
  });

  it('é no-op em sessão de visualização', () => {
    const id = arestaDeTeste();
    useCanvasStore.setState({ somenteLeitura: true });

    useCanvasStore.getState().setDobra(id, { fracaoX: 0.1 });

    expect(useCanvasStore.getState().edges[0]?.data?.dobra).toBeUndefined();
  });
});

describe('toggles', () => {
  it('toggleNodeCreated alterna ja_criado do nó', () => {
    const id = useCanvasStore.getState().createNode({ x: 0, y: 0 });
    expect(useCanvasStore.getState().nodes[0]?.data.ja_criado).toBe(false);

    useCanvasStore.getState().toggleNodeCreated(id);
    expect(useCanvasStore.getState().nodes[0]?.data.ja_criado).toBe(true);

    useCanvasStore.getState().toggleNodeCreated(id);
    expect(useCanvasStore.getState().nodes[0]?.data.ja_criado).toBe(false);
  });

  it('toggleSubitemCreated alterna apenas o subitem do índice indicado', () => {
    const a = useCanvasStore.getState().createNode({ x: 0, y: 0 });
    const b = useCanvasStore.getState().createNode({ x: 100, y: 0 });
    useCanvasStore.getState().onConnect({
      source: a,
      target: b,
      sourceHandle: null,
      targetHandle: null,
    });
    const id = useCanvasStore.getState().edges[0]?.id;
    if (!id) throw new Error('aresta não criada');
    useCanvasStore.getState().updateEdge(id, {
      subitems: [
        { id: 'si-1', categoria: 'Modelo', nome: 'm1', ja_criado: false },
        { id: 'si-2', categoria: 'Texto padrão', nome: 't1', ja_criado: false },
      ],
    });

    useCanvasStore.getState().toggleSubitemCreated(id, 1);

    const subs = useCanvasStore.getState().edges[0]?.data?.subitems ?? [];
    expect(subs[0]?.ja_criado).toBe(false);
    expect(subs[1]?.ja_criado).toBe(true);
  });

  // Desde o D-24 a regra é um recurso da aresta, então `toggleSubitemCreated`
  // cobre os dois casos — não há mais um toggle só para regra.
  it('toggleSubitemCreated alterna ja_criado de um recurso-regra', () => {
    const a = useCanvasStore.getState().createNode({ x: 0, y: 0 });
    const b = useCanvasStore.getState().createNode({ x: 100, y: 0 });
    useCanvasStore.getState().onConnect({
      source: a,
      target: b,
      sourceHandle: null,
      targetHandle: null,
    });
    const id = useCanvasStore.getState().edges[0]?.id;
    if (!id) throw new Error('aresta não criada');
    useCanvasStore.getState().updateEdge(id, {
      kind: 'atp',
      subitems: [
        {
          id: 'si-1',
          categoria: 'Regra de ATP',
          nome: 'r',
          ja_criado: false,
          atp: { implantar: true },
        },
      ],
    });

    useCanvasStore.getState().toggleSubitemCreated(id, 0);
    expect(useCanvasStore.getState().edges[0]?.data?.subitems[0]?.ja_criado).toBe(true);

    useCanvasStore.getState().toggleSubitemCreated(id, 0);
    expect(useCanvasStore.getState().edges[0]?.data?.subitems[0]?.ja_criado).toBe(false);
  });
});

describe('setters simples', () => {
  it('setSelectedId / setPlanoNome / setFlowMode atualizam o estado', () => {
    useCanvasStore.getState().setSelectedId('abc');
    useCanvasStore.getState().setPlanoNome('Plano X');
    useCanvasStore.getState().setFlowMode('sharp');

    const s = useCanvasStore.getState();
    expect(s.selectedId).toBe('abc');
    expect(s.planoNome).toBe('Plano X');
    expect(s.flowMode).toBe('sharp');
  });
});

describe('loadPlano / getPlano', () => {
  const fixture = (): Plano => ({
    version: SCHEMA_VERSION,
    planoNome: 'Plano de teste',
    flowMode: 'sharp',
    flags: [{ id: 'f-1', code: 'SC', label: 'Setor de Cálculo', cor: 5 }],
    nodes: [
      {
        id: 'n-1',
        position: { x: 50, y: 60 },
        data: {
          nome: 'L1',
          ja_criado: true,
          flags: ['f-1'],
        },
      },
    ],
    edges: [
      {
        id: 'e-1',
        source: 'n-1',
        target: 'n-1',
        sourceHandle: null,
        targetHandle: null,
        data: {
          kind: 'pref',
          resumo: 'r',
          observacao: '',
          subitems: [
            {
              id: 'si-1',
              categoria: 'Preferência',
              nome: 'p1',
              ja_criado: false,
              pref: { implantar: true, tipo: 'Minuta' },
            },
          ],
          dobra: { fracaoX: 0.75 },
        },
      },
    ],
  });

  it('round-trip loadPlano -> getPlano preserva nós, arestas, nome e modo', () => {
    const original = fixture();
    // A lista de setores é da unidade (decisoes.md#D-26) e é hidratada antes do
    // plano — `consolidarSetores` já absorveu o retrato que veio no JSON. Aqui
    // reproduzimos essa ordem, senão o round-trip mediria o que o `loadPlano`
    // deliberadamente não faz mais.
    useCanvasStore.getState().setFlags(original.flags);
    useCanvasStore.getState().loadPlano(original);
    const recuperado = useCanvasStore.getState().getPlano();
    expect(recuperado).toEqual(original);
  });

  it('loadPlano limpa selectedId', () => {
    useCanvasStore.getState().setSelectedId('algo');
    useCanvasStore.getState().loadPlano(fixture());
    expect(useCanvasStore.getState().selectedId).toBeNull();
  });
});

/* ============================================================================
 * Setores no canvas (decisoes.md#D-22, D-26)
 *
 * A lista em si é da unidade e mora em `features/setores/store.ts`; o que o
 * canvas guarda é o espelho dela. Aqui testamos só o que é do canvas: a
 * marcação nos nós e o que sobrevive à troca de plano.
 * ========================================================================== */

const TRIAGEM = { id: 'f-tri', code: 'TR', label: 'Triagem', cor: 1 as const };
const CALCULO = { id: 'f-cal', code: 'SC', label: 'Setor de Cálculo', cor: 2 as const };

describe('setores no canvas', () => {
  it('toggleFlagNoNo marca e desmarca sem tocar nos outros nós', () => {
    const a = useCanvasStore.getState().createNode({ x: 0, y: 0 });
    useCanvasStore.getState().createNode({ x: 100, y: 0 });
    useCanvasStore.getState().setFlags([TRIAGEM]);

    useCanvasStore.getState().toggleFlagNoNo(a, TRIAGEM.id);
    expect(useCanvasStore.getState().nodes[0]?.data.flags).toEqual([TRIAGEM.id]);
    expect(useCanvasStore.getState().nodes[1]?.data.flags).toEqual([]);

    useCanvasStore.getState().toggleFlagNoNo(a, TRIAGEM.id);
    expect(useCanvasStore.getState().nodes[0]?.data.flags).toEqual([]);
  });

  it('setFlags troca o espelho sem desfazer marcação — o id é que manda', () => {
    const n = useCanvasStore.getState().createNode({ x: 0, y: 0 });
    useCanvasStore.getState().setFlags([TRIAGEM]);
    useCanvasStore.getState().toggleFlagNoNo(n, TRIAGEM.id);

    useCanvasStore
      .getState()
      .setFlags([{ ...TRIAGEM, label: 'Setor de Triagem', cor: 7 }]);

    expect(useCanvasStore.getState().flags[0]?.label).toBe('Setor de Triagem');
    expect(useCanvasStore.getState().nodes[0]?.data.flags).toEqual([TRIAGEM.id]);
  });

  it('removerMarcacaoDeFlag limpa os nós e o filtro, sem mexer no espelho', () => {
    const n = useCanvasStore.getState().createNode({ x: 0, y: 0 });
    useCanvasStore.getState().setFlags([TRIAGEM, CALCULO]);
    useCanvasStore.getState().toggleFlagNoNo(n, TRIAGEM.id);
    useCanvasStore.getState().toggleFlagNoNo(n, CALCULO.id);
    useCanvasStore.getState().setFiltroFlags([TRIAGEM.id, CALCULO.id]);

    useCanvasStore.getState().removerMarcacaoDeFlag(TRIAGEM.id);

    expect(useCanvasStore.getState().nodes[0]?.data.flags).toEqual([CALCULO.id]);
    expect(useCanvasStore.getState().filtroFlags).toEqual([CALCULO.id]);
    // A lista é da unidade: quem a encurta é a store de setores.
    expect(useCanvasStore.getState().flags).toHaveLength(2);
  });

  it('loadPlano preserva o espelho — a lista é da unidade, não do plano', () => {
    useCanvasStore.getState().setFlags([TRIAGEM]);

    useCanvasStore.getState().loadPlano({
      version: SCHEMA_VERSION,
      planoNome: 'Outro',
      flowMode: 'organic',
      flags: [CALCULO], // retrato antigo do plano: não manda mais
      nodes: [],
      edges: [],
    });

    expect(useCanvasStore.getState().flags).toEqual([TRIAGEM]);
  });

  it('loadPlano zera o filtro — o realce é sobre nós que saíram da tela', () => {
    useCanvasStore.getState().setFiltroFlags(['flag-espera']);
    useCanvasStore.getState().loadPlano({
      version: SCHEMA_VERSION,
      planoNome: 'Outro',
      flowMode: 'organic',
      flags: [],
      nodes: [],
      edges: [],
    });
    expect(useCanvasStore.getState().filtroFlags).toEqual([]);
  });

  it('getPlano grava o espelho como retrato que viaja com o plano', () => {
    useCanvasStore.getState().setFlags([TRIAGEM, CALCULO]);
    expect(useCanvasStore.getState().getPlano().flags).toEqual([TRIAGEM, CALCULO]);
  });
});

describe('persistência reativa', () => {
  it('mutações disparam debounced save após o delay (no plano ativo)', () => {
    vi.useFakeTimers();

    useCanvasStore.getState().createNode({ x: 1, y: 2 });
    useCanvasStore.getState().setPlanoNome('Plano persistido');

    // Antes do debounce não há ativo (lazy-create acontece na primeira gravação).
    expect(getActivePlanKey()).toBeNull();

    vi.advanceTimersByTime(300);

    const key = getActivePlanKey();
    expect(key).not.toBeNull();
    const raw = localStorage.getItem(key!);
    expect(raw).not.toBeNull();
    const persistido = JSON.parse(raw ?? '{}');
    expect(persistido.planoNome).toBe('Plano persistido');
    expect(persistido.nodes).toHaveLength(1);
    expect(persistido.version).toBe(SCHEMA_VERSION);
  });

  it('setSelectedId não dispara save (estado UI não persiste)', () => {
    vi.useFakeTimers();
    useCanvasStore.getState().setSelectedId('abc');

    vi.advanceTimersByTime(1000);
    expect(getActivePlanKey()).toBeNull();
  });

  // O espelho está na tupla observada de propósito: renomear um setor precisa
  // regravar o plano ativo com o retrato novo, senão o JSON exportado sairia
  // com a lista de antes.
  it('setFlags dispara save e o retrato chega ao storage', () => {
    useCanvasStore.getState().setFlags([CALCULO]);
    flushPersist();

    const key = getActivePlanKey();
    expect(key).not.toBeNull();
    const persistido = JSON.parse(localStorage.getItem(key!) ?? '{}');
    expect(persistido.flags).toHaveLength(1);
    expect(persistido.flags[0].label).toBe('Setor de Cálculo');
  });

  it('setFiltroFlags não dispara save (é ajuste de visualização)', () => {
    vi.useFakeTimers();
    useCanvasStore.getState().setFiltroFlags(['flag-espera']);

    vi.advanceTimersByTime(1000);
    expect(getActivePlanKey()).toBeNull();
  });

  it('flushPersist força gravação imediata sem esperar o debounce', () => {
    useCanvasStore.getState().createNode({ x: 1, y: 2 });
    expect(getActivePlanKey()).toBeNull();

    flushPersist();
    const key = getActivePlanKey();
    expect(key).not.toBeNull();
    expect(localStorage.getItem(key!)).not.toBeNull();
  });
});

/* ============================================================================
 * Sessão de visualização (decisoes.md#D-19)
 *
 * A UI esconde e desabilita os controles, mas quem garante é o store: atalho
 * de teclado, modal já aberto quando a sessão trocou ou componente novo que
 * alguém esqueça de gatilhar passariam direto por uma trava só de UI.
 * ========================================================================== */

describe('somenteLeitura', () => {
  function comPlanoCarregado() {
    // Ordem igual à do `features/sessao/store.ts`: trava primeiro, carrega
    // depois. Ao contrário, o próprio `loadPlano` agendaria uma gravação.
    useCanvasStore.getState().setSomenteLeitura(true);
    useCanvasStore.getState().loadPlano({
      version: SCHEMA_VERSION,
      planoNome: 'Plano da lotação',
      flowMode: 'organic',
      flags: [{ id: 'f-1', code: 'TR', label: 'Triagem', cor: 1 }],
      nodes: [
        { id: 'n1', position: { x: 0, y: 0 }, data: defaultLocalizadorData() },
        { id: 'n2', position: { x: 100, y: 0 }, data: defaultLocalizadorData() },
      ],
      edges: [
        {
          id: 'e1',
          source: 'n1',
          target: 'n2',
          sourceHandle: null,
          targetHandle: null,
          data: defaultEdgeData(),
        },
      ],
    });
  }

  it('nenhuma mutação de conteúdo passa', () => {
    comPlanoCarregado();
    const antes = useCanvasStore.getState().getPlano();
    const s = useCanvasStore.getState();

    s.createNode({ x: 5, y: 5 });
    s.updateNode('n1', { nome: 'invadido' });
    s.updateEdge('e1', { resumo: 'invadido' });
    s.toggleNodeCreated('n1');
    s.toggleSubitemCreated('e1', 0);
    s.setPlanoNome('outro nome');
    s.deleteEdge('e1');
    s.deleteNode('n1');
    s.onConnect({ source: 'n1', target: 'n2', sourceHandle: null, targetHandle: null });
    s.toggleFlagNoNo('n1', 'f-1');
    s.removerMarcacaoDeFlag('f-1');

    expect(useCanvasStore.getState().getPlano()).toEqual(antes);
  });

  it('createNode devolve string vazia em vez de um id que não existe', () => {
    comPlanoCarregado();
    expect(useCanvasStore.getState().createNode({ x: 5, y: 5 })).toBe('');
  });

  it('selecionar, trocar o modo de desenho e filtrar continuam valendo', () => {
    comPlanoCarregado();
    useCanvasStore.getState().setSelectedId('n1');
    useCanvasStore.getState().setFlowMode('sharp');
    useCanvasStore.getState().setFiltroFlags(['f-1']);

    expect(useCanvasStore.getState().selectedId).toBe('n1');
    expect(useCanvasStore.getState().flowMode).toBe('sharp');
    expect(useCanvasStore.getState().filtroFlags).toEqual(['f-1']);
  });

  it('remoção vinda do ReactFlow (tecla Delete, drag) não passa', () => {
    comPlanoCarregado();
    useCanvasStore.getState().onNodesChange([{ id: 'n1', type: 'remove' }]);
    useCanvasStore.getState().onEdgesChange([{ id: 'e1', type: 'remove' }]);

    expect(useCanvasStore.getState().nodes).toHaveLength(2);
    expect(useCanvasStore.getState().edges).toHaveLength(1);
  });

  it('medição do ReactFlow passa — sem ela as arestas não se desenham', () => {
    comPlanoCarregado();
    useCanvasStore
      .getState()
      .onNodesChange([{ id: 'n1', type: 'dimensions', dimensions: { width: 180, height: 60 } }]);

    expect(useCanvasStore.getState().nodes[0]?.width).toBe(180);
  });

  it('não grava nada no storage, nem pelo flush', () => {
    comPlanoCarregado();
    useCanvasStore
      .getState()
      .onNodesChange([{ id: 'n1', type: 'dimensions', dimensions: { width: 180, height: 60 } }]);
    useCanvasStore.getState().setFlowMode('sharp');

    flushPersist();
    expect(getActivePlanKey()).toBeNull();
  });

  it('trava ligada no meio do caminho descarta o save já agendado', () => {
    // O caso que a ordem "trava antes, carrega depois" evita — mas que um
    // `loadPlano` fora de ordem reintroduziria em silêncio.
    useCanvasStore.getState().createNode({ x: 1, y: 2 });
    useCanvasStore.getState().setSomenteLeitura(true);

    flushPersist();
    expect(getActivePlanKey()).toBeNull();
  });
});

describe('seleção múltipla (Card 7)', () => {
  const montar = () => {
    const s = useCanvasStore.getState();
    const a = s.createNode({ x: 0, y: 0 });
    const b = s.createNode({ x: 100, y: 50 });
    const c = s.createNode({ x: 300, y: 80 });
    s.onConnect({ source: a, target: b, sourceHandle: null, targetHandle: null });
    s.onConnect({ source: b, target: c, sourceHandle: null, targetHandle: null });
    return { a, b, c };
  };
  const selecionar = (ids: string[]) =>
    useCanvasStore.getState().onNodesChange(
      useCanvasStore.getState().nodes.map((n) => ({
        type: 'select' as const,
        id: n.id,
        selected: ids.includes(n.id),
      })),
    );

  it('selectedId só existe com exatamente um item selecionado', () => {
    const { a, b } = montar();
    selecionar([a]);
    expect(useCanvasStore.getState().selectedId).toBe(a);
    selecionar([a, b]);
    expect(useCanvasStore.getState().selectedId).toBeNull();
    selecionar([b]);
    expect(useCanvasStore.getState().selectedId).toBe(b);
  });

  it('criar um nó deixa só ele selecionado', () => {
    const { a, b } = montar();
    selecionar([a, b]);
    const novo = useCanvasStore.getState().createNode({ x: 9, y: 9 });
    const sel = useCanvasStore.getState().nodes.filter((n) => n.selected).map((n) => n.id);
    expect(sel).toEqual([novo]);
  });

  it('setSelectedId acerta as marcas do ReactFlow', () => {
    const { a, b, c } = montar();
    selecionar([a, b]);
    useCanvasStore.getState().setSelectedId(c);
    const sel = useCanvasStore.getState().nodes.filter((n) => n.selected).map((n) => n.id);
    expect(sel).toEqual([c]);
  });

  it('deleteSelecao leva os nós e as arestas que tocam neles', () => {
    const { a, b, c } = montar();
    selecionar([a, b]);
    useCanvasStore.getState().deleteSelecao();
    const s = useCanvasStore.getState();
    expect(s.nodes.map((n) => n.id)).toEqual([c]);
    expect(s.edges).toHaveLength(0);
    expect(s.selectedId).toBeNull();
  });

  it('moverNos reposiciona só quem foi pedido', () => {
    const { a, b, c } = montar();
    useCanvasStore.getState().moverNos({ [a]: { x: 0, y: 500 }, [b]: { x: 100, y: 500 } });
    const pos = Object.fromEntries(useCanvasStore.getState().nodes.map((n) => [n.id, n.position]));
    expect(pos[a]).toEqual({ x: 0, y: 500 });
    expect(pos[b]).toEqual({ x: 100, y: 500 });
    expect(pos[c]).toEqual({ x: 300, y: 80 });
  });

  it('marcarFlagEmLote liga e desliga sem duplicar', () => {
    const { a, b } = montar();
    const s = useCanvasStore.getState();
    s.toggleFlagNoNo(a, 'f1');
    s.marcarFlagEmLote([a, b], 'f1', true);
    const flags = () => useCanvasStore.getState().nodes.map((n) => n.data.flags);
    expect(flags()[0]).toEqual(['f1']);
    expect(flags()[1]).toEqual(['f1']);
    useCanvasStore.getState().marcarFlagEmLote([a, b], 'f1', false);
    expect(flags()[0]).toEqual([]);
    expect(flags()[1]).toEqual([]);
  });

  it('em visualização, nada disso altera o plano', () => {
    const { a, b } = montar();
    useCanvasStore.setState({ somenteLeitura: true });
    selecionar([a, b]);
    useCanvasStore.getState().deleteSelecao();
    useCanvasStore.getState().moverNos({ [a]: { x: 9, y: 9 } });
    expect(useCanvasStore.getState().nodes).toHaveLength(3);
    expect(useCanvasStore.getState().nodes[0]?.position).toEqual({ x: 0, y: 0 });
  });

  it('a marca de seleção não vai para o plano', () => {
    const { a } = montar();
    selecionar([a]);
    const plano = useCanvasStore.getState().getPlano();
    expect(JSON.stringify(plano)).not.toContain('selected');
  });
});

describe('ações preferenciais planejadas (D-28)', () => {
  it('adiciona, marca e remove; a lista vazia some do nó', () => {
    const s = useCanvasStore.getState();
    const n = s.createNode({ x: 0, y: 0 });
    const a = s.addAcaoPreferencial(n, 'Despacho — cite-se');
    expect(useCanvasStore.getState().nodes[0]?.data.acoesPreferenciais).toEqual([
      { id: a, nome: 'Despacho — cite-se', ja_criado: false },
    ]);
    useCanvasStore.getState().updateAcaoPreferencial(n, a, { ja_criado: true });
    expect(useCanvasStore.getState().nodes[0]?.data.acoesPreferenciais?.[0]?.ja_criado).toBe(true);
    useCanvasStore.getState().removeAcaoPreferencial(n, a);
    expect('acoesPreferenciais' in (useCanvasStore.getState().nodes[0]?.data ?? {})).toBe(false);
  });

  it('em visualização não altera nada', () => {
    const n = useCanvasStore.getState().createNode({ x: 0, y: 0 });
    useCanvasStore.setState({ somenteLeitura: true });
    expect(useCanvasStore.getState().addAcaoPreferencial(n, 'x')).toBe('');
    expect(useCanvasStore.getState().nodes[0]?.data.acoesPreferenciais).toBeUndefined();
  });
});

describe('atalhos (D-30)', () => {
  it('cria ao lado do alvo, selecionado, apontando para o localizador de verdade', () => {
    const s = useCanvasStore.getState();
    const a = s.createNode({ x: 100, y: 100 });
    const s1 = useCanvasStore.getState().criarAtalho(a);
    const s2 = useCanvasStore.getState().criarAtalho(s1);
    const nodes = useCanvasStore.getState().nodes;
    expect(nodes.find((n) => n.id === s1)?.data.atalhoPara).toBe(a);
    // Atalho de atalho aponta para o alvo, nunca para o atalho.
    expect(nodes.find((n) => n.id === s2)?.data.atalhoPara).toBe(a);
    expect(nodes.find((n) => n.id === s1)?.position).toEqual({ x: 140, y: 210 });
    expect(useCanvasStore.getState().selectedId).toBe(s2);
  });

  it('em visualização ou com alvo inexistente não cria', () => {
    expect(useCanvasStore.getState().criarAtalho('nada')).toBe('');
    const a = useCanvasStore.getState().createNode({ x: 0, y: 0 });
    useCanvasStore.setState({ somenteLeitura: true });
    expect(useCanvasStore.getState().criarAtalho(a)).toBe('');
  });
});

describe('grupos (D-31)', () => {
  const montar = () => {
    const s = useCanvasStore.getState();
    const a = s.createNode({ x: 100, y: 100 });
    const b = s.createNode({ x: 400, y: 100 });
    const c = s.createNode({ x: 900, y: 600 });
    const g = useCanvasStore.getState().criarGrupo([a, b]);
    return { a, b, c, g };
  };
  const grupo = (id: string) => useCanvasStore.getState().grupos.find((x) => x.id === id)!;
  const pos = (id: string) => useCanvasStore.getState().nodes.find((n) => n.id === id)!.position;

  it('cria a moldura em volta dos nós, selecionada, com os dois como membros', () => {
    const { a, b, g } = montar();
    expect(grupo(g)).toMatchObject({ membros: [a, b], position: { x: 80, y: 60 }, selected: true });
    expect(useCanvasStore.getState().selectedId).toBe(g);
  });

  it('arrastar a moldura leva os membros; redimensionar pelo canto não', () => {
    const { a, b, c, g } = montar();
    useCanvasStore.getState().onNodesChange([
      { type: 'position', id: g, position: { x: 130, y: 90 }, dragging: true },
    ]);
    expect(pos(a)).toEqual({ x: 150, y: 130 });
    expect(pos(b)).toEqual({ x: 450, y: 130 });
    expect(pos(c)).toEqual({ x: 900, y: 600 });
    useCanvasStore.getState().onNodesChange([
      { type: 'position', id: g, position: { x: 100, y: 50 } },
      { type: 'dimensions', id: g, dimensions: { width: 700, height: 400 }, resizing: true },
    ]);
    expect(pos(a)).toEqual({ x: 150, y: 130 });
    expect(grupo(g)).toMatchObject({ position: { x: 100, y: 50 }, largura: 700, altura: 400 });
  });

  it('soltar um nó dentro da moldura o torna membro; fora, o tira', () => {
    const { a, c, g } = montar();
    useCanvasStore.getState().onNodesChange([
      { type: 'position', id: c, position: { x: 200, y: 120 }, dragging: true },
      { type: 'position', id: c, dragging: false },
    ]);
    expect(grupo(g).membros).toContain(c);
    useCanvasStore.getState().onNodesChange([
      { type: 'position', id: a, position: { x: 3000, y: 3000 }, dragging: true },
      { type: 'position', id: a, dragging: false },
    ]);
    expect(grupo(g).membros).not.toContain(a);
  });

  it('apagar localizador o tira do grupo; desfazer o grupo mantém os localizadores', () => {
    const { a, b, g } = montar();
    useCanvasStore.getState().deleteNode(a);
    expect(grupo(g).membros).toEqual([b]);
    useCanvasStore.getState().removerGrupo(g);
    expect(useCanvasStore.getState().grupos).toEqual([]);
    expect(useCanvasStore.getState().nodes.map((n) => n.id)).toContain(b);
  });

  it('o plano leva os grupos sem a marca de seleção, e omite a chave quando não há grupo', () => {
    expect('grupos' in useCanvasStore.getState().getPlano()).toBe(false);
    const { g } = montar();
    const plano = useCanvasStore.getState().getPlano();
    expect(plano.grupos?.[0]?.id).toBe(g);
    expect(JSON.stringify(plano.grupos)).not.toContain('selected');
  });

  it('um localizador é membro de um grupo só', () => {
    const { a, g } = montar();
    const g2 = useCanvasStore.getState().criarGrupo([a]);
    expect(grupo(g).membros).not.toContain(a);
    expect(grupo(g2).membros).toEqual([a]);
  });

  it('em visualização: seleciona, mas não arrasta nem cria', () => {
    const { a, g } = montar();
    useCanvasStore.setState({ somenteLeitura: true });
    useCanvasStore.getState().onNodesChange([
      { type: 'position', id: g, position: { x: 999, y: 999 }, dragging: true },
    ]);
    expect(pos(a)).toEqual({ x: 100, y: 100 });
    expect(useCanvasStore.getState().criarGrupo([a])).toBe('');
  });
});
