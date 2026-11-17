import { beforeEach, describe, expect, it } from 'vitest';
import type { RegraAtpUnidade } from '@/domain';
import { setEscopo } from '@/infra/storage';
import { planejarDesenho, type QuadroDesenho } from './desenharRegra';
import { cancelPersist, useCanvasStore } from './store';

let seq = 0;
const ctx = { descarte: ['P', '\u200E'], sistema: ['PETIÇÃO'], gerarId: (p: string) => `${p}${++seq}` };

const regra = (numero: number, r: Partial<RegraAtpUnidade> = {}): RegraAtpUnidade => ({
  numero,
  ativa: true,
  tipoOrigem: 'localizadores',
  origens: ['Ag. Laudo Pericial ⏳'],
  destinos: ['Dar Andamento ➡️➡️'],
  tipoControle: 'Por Evento',
  gatilhoTexto: 'Por Evento / Laudo juntado',
  ...r,
});

const quadro = (): QuadroDesenho => ({
  nodes: [
    { id: 'laudo', position: { x: 0, y: 0 }, data: { nome: 'Ag. Laudo Pericial ⏳' } },
    { id: 'anda', position: { x: 300, y: 0 }, data: { nome: 'Dar Andamento ➡️ ➡️' } },
  ],
  edges: [{ id: 'e1', source: 'laudo', target: 'anda', data: { kind: 'manual', subitems: [] } }],
  entradas: [],
});

beforeEach(() => {
  seq = 0;
});

describe('planejarDesenho (D-47)', () => {
  it('reaproveita a transição que existe e a passa a ATP', () => {
    const d = planejarDesenho(quadro(), [regra(181)], ctx);
    expect(d.operacoes.novosNos).toEqual([]);
    expect(d.operacoes.novasArestas).toEqual([]);
    expect(d.operacoes.recursos).toEqual([
      expect.objectContaining({ edgeId: 'e1', paraAtp: true, subitem: expect.objectContaining({ eprocAtp: 181, ja_criado: true }) }),
    ]);
    // Sem detalhe, o resumo da lista vai para as observações.
    expect(d.operacoes.recursos[0]?.subitem.atp?.observacoes).toMatch(/^Regra 181 no Eproc/);
  });

  it('"Nenhum" usa o localizador do filtro; "A E B" vira uma seta e outrosDestinos', () => {
    const d = planejarDesenho(
      quadro(),
      [regra(182, { tipoOrigem: 'nenhum', origens: [], filtroContem: ['Ag. Laudo Pericial ⏳'], destinos: ['Vista Laudo ➡️ MP ⏳', '🟢Sistema AJ'] })],
      ctx,
    );
    expect(d.operacoes.novosNos.map((n) => n.nome)).toEqual(['Vista Laudo ➡️ MP ⏳']);
    expect(d.operacoes.novasArestas[0]).toMatchObject({ source: 'laudo', target: d.operacoes.novosNos[0]?.id });
    expect(d.operacoes.novasArestas[0]?.subitem.atp?.outrosDestinos).toEqual(['🟢Sistema AJ']);
    expect(d.efeitos.some((e) => /origem é "Nenhum"/.test(e.texto))).toBe(true);
  });

  it('origem com "E" fica em outrasOrigens com a condição', () => {
    const d = planejarDesenho(
      quadro(),
      [regra(12, { origens: ['Ag. Laudo Pericial ⏳', 'PETIÇÃO'], opcaoOrigens: 'AND' })],
      ctx,
    );
    expect(d.operacoes.recursos[0]?.subitem.atp).toMatchObject({
      outrasOrigens: ['PETIÇÃO'],
      opcaoMultiplosLocalizadores: 'AND',
    });
  });

  it('destino de descarte pendura a regra na origem', () => {
    const d = planejarDesenho(quadro(), [regra(66, { destinos: ['P'], tipoControle: 'Por Ação Manual' })], ctx);
    expect(d.operacoes.penduradas).toEqual([
      { nodeId: 'laudo', regra: expect.objectContaining({ efeito: 'manual', destino: 'P', eprocAtp: 66 }) },
    ]);
  });

  it('sem origem desenhável, cria a entrada por evento; e não repete regra já desenhada', () => {
    const d = planejarDesenho(quadro(), [regra(90, { tipoOrigem: 'nenhum', origens: [] })], ctx);
    expect(d.operacoes.novasEntradas.map((e) => e.rotulo)).toEqual(['Laudo juntado']);
    const q = quadro();
    q.edges[0]!.data!.subitems.push({ id: 's', categoria: 'Regra de ATP', nome: 'x', ja_criado: true, eprocAtp: 181 });
    const d2 = planejarDesenho(q, [regra(181)], ctx);
    expect(d2.operacoes.recursos).toEqual([]);
    expect(d2.efeitos[0]?.texto).toMatch(/já está no plano/);
  });

  it('a segunda regra reaproveita o nó que a primeira criou; nó de sistema não nasce criado', () => {
    const d = planejarDesenho(
      quadro(),
      [regra(1, { destinos: ['Novo'] }), regra(2, { destinos: ['Novo'] }), regra(3, { destinos: ['PETIÇÃO'] })],
      ctx,
    );
    expect(d.operacoes.novosNos.map((n) => [n.nome, n.sistema])).toEqual([
      ['Novo', false],
      ['PETIÇÃO', true],
    ]);
    expect(d.operacoes.novasArestas).toHaveLength(2);
    expect(d.operacoes.recursos).toHaveLength(1);
  });
});

describe('desenharRegras na store', () => {
  beforeEach(() => {
    cancelPersist();
    localStorage.clear();
    setEscopo({ tipo: 'local' });
    useCanvasStore.setState({
      nodes: [
        { id: 'laudo', type: 'localizador', position: { x: 0, y: 0 }, data: { nome: 'Ag. Laudo Pericial ⏳', ja_criado: true, flags: [] } },
      ],
      edges: [],
      grupos: [],
      notas: [],
      entradas: [],
      somenteLeitura: false,
    });
  });

  it('aplica nós, setas e penduradas de uma vez', () => {
    const s = useCanvasStore.getState();
    const q: QuadroDesenho = { nodes: s.nodes, edges: s.edges, entradas: s.entradas };
    const d = planejarDesenho(q, [regra(182, { destinos: ['Novo'] }), regra(66, { destinos: ['P'] })], ctx);
    s.desenharRegras(d.operacoes);
    const depois = useCanvasStore.getState();
    expect(depois.nodes.map((n) => n.data.nome)).toEqual(['Ag. Laudo Pericial ⏳', 'Novo']);
    expect(depois.edges[0]?.data).toMatchObject({ kind: 'atp', resumo: '', observacao: '' });
    expect(depois.edges[0]?.data?.subitems[0]?.eprocAtp).toBe(182);
    expect(depois.nodes[0]?.data.regrasSemMover?.[0]?.eprocAtp).toBe(66);
  });

  it('em visualização não faz nada', () => {
    useCanvasStore.setState({ somenteLeitura: true });
    const d = planejarDesenho({ nodes: useCanvasStore.getState().nodes, edges: [], entradas: [] }, [regra(1, { destinos: ['Novo'] })], ctx);
    useCanvasStore.getState().desenharRegras(d.operacoes);
    expect(useCanvasStore.getState().nodes).toHaveLength(1);
  });
});
