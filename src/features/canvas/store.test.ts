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
      flags: { espera: true },
    });

    const data = useCanvasStore.getState().nodes[0]?.data;
    expect(data?.nome).toBe('Aguardando despacho');
    expect(data?.flags.espera).toBe(true);
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

  it('toggleEdgeRuleCreated alterna ja_criado da regra correspondente ao kind', () => {
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
      atp: { implantar: true, ja_criado: false, nome: 'r' },
    });

    useCanvasStore.getState().toggleEdgeRuleCreated(id);
    expect(useCanvasStore.getState().edges[0]?.data?.atp?.ja_criado).toBe(true);

    useCanvasStore.getState().toggleEdgeRuleCreated(id);
    expect(useCanvasStore.getState().edges[0]?.data?.atp?.ja_criado).toBe(false);
  });

  it('toggleEdgeRuleCreated é no-op em aresta manual', () => {
    const a = useCanvasStore.getState().createNode({ x: 0, y: 0 });
    const b = useCanvasStore.getState().createNode({ x: 100, y: 0 });
    useCanvasStore.getState().onConnect({
      source: a,
      target: b,
      sourceHandle: null,
      targetHandle: null,
    });
    const antes = useCanvasStore.getState().edges[0];

    useCanvasStore.getState().toggleEdgeRuleCreated(antes?.id ?? '');

    const depois = useCanvasStore.getState().edges[0];
    expect(depois?.data?.kind).toBe('manual');
    expect(depois?.data?.atp).toBeUndefined();
    expect(depois?.data?.pref).toBeUndefined();
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
    nodes: [
      {
        id: 'n-1',
        position: { x: 50, y: 60 },
        data: {
          nome: 'L1',
          ja_criado: true,
          flags: { trabalhado: true },
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
          subitems: [],
          pref: { implantar: true, ja_criado: false, nome: 'p1', tipo: 'Minuta' },
        },
      },
    ],
  });

  it('round-trip loadPlano -> getPlano preserva nós, arestas, nome e modo', () => {
    const original = fixture();
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

  it('flushPersist força gravação imediata sem esperar o debounce', () => {
    useCanvasStore.getState().createNode({ x: 1, y: 2 });
    expect(getActivePlanKey()).toBeNull();

    flushPersist();
    const key = getActivePlanKey();
    expect(key).not.toBeNull();
    expect(localStorage.getItem(key!)).not.toBeNull();
  });
});
