import { beforeEach, describe, expect, it } from 'vitest';
import { EVENTOS } from '@/data';
import { CONJUNTOS_EVENTO_PADRAO, resumirSelecaoEventos, type ConjuntoEvento } from '@/domain';
import { useCanvasStore } from '@/features/canvas/store';
import { fmtEventos } from '@/features/checklist/detalhesAtp';
import { setEscopo } from '@/infra/storage';
import { CONJUNTOS_PADRAO, IDS_EVENTOS, frasePorResumo, resumirEventos } from './conjuntos';
import { useConjuntosEventoStore } from './store';

const porRotulo = new Map(EVENTOS.map((e) => [e.label, e.value]));
const conjunto = (id: string): ConjuntoEvento => {
  const c = CONJUNTOS_PADRAO.find((x) => x.id === id);
  if (!c) throw new Error(`conjunto ${id} não existe`);
  return c;
};
const contem = (id: string, rotulo: string) => {
  const ev = porRotulo.get(rotulo);
  if (!ev) throw new Error(`evento "${rotulo}" não está no catálogo`);
  return conjunto(id).ids.includes(ev);
};

/**
 * Os conjuntos padrão são regras sobre o rótulo. Estes casos prendem a regra ao
 * catálogo real: se uma atualização do JSON mudar a redação, o teste avisa em
 * vez de o conjunto encolher calado.
 */
describe('conjuntos padrão contra o catálogo embutido', () => {
  it('nenhum conjunto sai vazio, e quase todo evento cai em algum', () => {
    for (const c of CONJUNTOS_PADRAO) expect(c.ids.length, c.id).toBeGreaterThan(0);
    const cobertos = new Set(CONJUNTOS_PADRAO.flatMap((c) => c.ids));
    expect(IDS_EVENTOS.filter((id) => !cobertos.has(id)).length).toBeLessThanOrEqual(5);
  });

  it('ids são únicos entre os padrão', () => {
    const ids = CONJUNTOS_EVENTO_PADRAO.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each([
    ['mera-ciencia', 'Confirmada a intimação eletrônica', true],
    ['mera-ciencia', 'Expedida/certificada a intimação eletrônica - Sentença', true],
    ['mera-ciencia', 'Disponibilizado no DJEN', true],
    // Decurso de prazo pede providência: é gatilho, não ciência.
    ['mera-ciencia', 'Decorrido prazo', false],
    ['mera-ciencia', 'Expedida Ordem de liberação', false],
    ['distribuicao', 'Distribuído por sorteio', true],
    ['distribuicao', 'Redistribuído por prevenção ao juízo', true],
    ['tutelas', 'Decisao/Despacho - Concedida a Medida Liminar', true],
    // "pre-liminar" não é liminar.
    ['tutelas', 'Audiência preliminar designada', false],
    ['audiencias-designadas', 'Audiência de conciliação redesignada', true],
    ['audiencias-designadas', 'Sessão do Tribunal do Júri designada', true],
    ['audiencias-realizadas', 'Audiência de conciliação realizada - sem conciliação', true],
    ['audiencias-realizadas', 'Audiência admonitória não realizada/cancelada', false],
    ['audiencias-nao-realizadas', 'Sessão do Tribunal do Júri não-realizada', true],
    ['cumprido', 'Juntada de Mandado - Cumprido', true],
    ['cumprido', 'Juntada de Mandado - Cumprido Negativo', false],
    ['nao-cumprido', 'Juntada de Mandado - Cumprido Negativo', true],
    ['nao-cumprido', 'Juntada de Carta pelo Correio - devolvida sem cumprimento', true],
    ['transito', 'Transitado em Julgado', true],
    ['arquivo-provisorio', 'Arquivado Provisoriamente - art. 40 da Lei 6.830', true],
    ['reativacao', 'Processo Reativado por decisão judicial', true],
    ['requisicoes', 'Requisição de pagamento de pequeno valor paga', true],
    ['alvaras', 'Expedição de alvará de soltura', false],
    ['prisao-liberdade', 'Expedição de alvará de soltura', true],
    ['incidentes', 'Arquivo em Guarda Permanente - incidente de arguição de inconstitucionalidade', false],
  ] as const)('%s × "%s" → %s', (id, rotulo, esperado) => {
    expect(contem(id, rotulo)).toBe(esperado);
  });
});

describe('resumirSelecaoEventos', () => {
  const universo = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const cs: ConjuntoEvento[] = [
    { id: 'x', rotulo: 'X', ids: ['a', 'b', 'c'], personalizado: false },
    { id: 'y', rotulo: 'Y', ids: ['d', 'e'], personalizado: false },
    { id: 'xy', rotulo: 'XY', ids: ['a', 'b', 'c', 'd', 'e'], personalizado: false },
  ];

  it('vazio e todos', () => {
    expect(resumirSelecaoEventos([], universo, cs)).toEqual({ modo: 'vazio' });
    expect(resumirSelecaoEventos(universo, universo, cs)).toEqual({ modo: 'todos', total: 8 });
  });

  it('inclusão prefere o conjunto maior e deixa o resto como avulso', () => {
    const r = resumirSelecaoEventos(['a', 'b', 'c', 'd', 'e', 'g'], universo, cs);
    // 6 de 8: exclusão custaria 2 avulsos; inclusão, XY + g = 2. Empate fica na inclusão.
    expect(r).toMatchObject({ modo: 'inclusao', avulsos: ['g'] });
    expect(r.modo === 'inclusao' && r.conjuntos.map((c) => c.id)).toEqual(['xy']);
  });

  it('exclusão quando "tudo menos um conjunto" é mais curto', () => {
    const r = resumirSelecaoEventos(['f', 'g', 'h', 'a', 'b', 'c'], universo, cs);
    expect(r).toMatchObject({ modo: 'exclusao', avulsos: [] });
    expect(r.modo === 'exclusao' && r.conjuntos.map((c) => c.id)).toEqual(['y']);
  });

  it('conjunto só conta se estiver inteiro na seleção', () => {
    const r = resumirSelecaoEventos(['a', 'b'], universo, cs);
    expect(r).toMatchObject({ modo: 'inclusao', conjuntos: [], avulsos: ['a', 'b'] });
  });

  it('id fora do catálogo vira avulso, nunca some', () => {
    const r = resumirSelecaoEventos([...universo, 'zz'], universo, cs);
    expect(r.modo).toBe('inclusao');
    expect(r.modo === 'inclusao' && r.avulsos).toContain('zz');
  });
});

describe('o caso do card: todos, exceto mera ciência', () => {
  const ciencia = new Set(conjunto('mera-ciencia').ids);
  const selecao = IDS_EVENTOS.filter((id) => !ciencia.has(id));

  it('resume em uma frase', () => {
    expect(frasePorResumo(resumirEventos(selecao))).toMatch(
      /^Todos os eventos, exceto Mera ciência \(1\.0\d\d\)$/,
    );
  });

  it('o checklist diz o que desmarcar no Eproc', () => {
    const texto = fmtEventos(selecao);
    const [frase, lista] = texto.split('\n');
    expect(frase).toMatch(/^Todos os eventos, exceto Mera ciência/);
    expect(lista).toMatch(/^Marcar todos e desmarcar: /);
    expect(lista).toContain('Confirmada a intimação eletrônica');
  });

  it('seleção pequena sem conjunto continua em uma linha', () => {
    const dois = IDS_EVENTOS.slice(0, 2);
    expect(fmtEventos(dois)).not.toContain('\n');
  });
});

describe('conjuntos da unidade', () => {
  beforeEach(() => {
    localStorage.clear();
    setEscopo({ tipo: 'local' });
    useCanvasStore.setState({ somenteLeitura: false });
    useConjuntosEventoStore.getState().limpar();
  });

  it('criar, renomear, substituir e apagar persistem no silo', () => {
    const s = useConjuntosEventoStore.getState();
    const id = s.criar('  Prazos da vara ', ['1', '2', '2']);
    expect(useConjuntosEventoStore.getState().personalizados).toEqual([
      { id, rotulo: 'Prazos da vara', ids: ['1', '2'] },
    ]);
    useConjuntosEventoStore.getState().atualizar(id, { rotulo: 'Prazos', ids: ['3'] });
    useConjuntosEventoStore.getState().limpar();
    useConjuntosEventoStore.getState().hidratar();
    expect(useConjuntosEventoStore.getState().personalizados).toEqual([
      { id, rotulo: 'Prazos', ids: ['3'] },
    ]);
    useConjuntosEventoStore.getState().remover(id);
    expect(localStorage.getItem('planejoeproc:conjuntosEvento')).toBeNull();
  });

  it('em visualização não grava', () => {
    useCanvasStore.setState({ somenteLeitura: true });
    expect(useConjuntosEventoStore.getState().criar('X', ['1'])).toBe('');
    expect(useConjuntosEventoStore.getState().personalizados).toEqual([]);
  });

  it('lotações não se misturam', () => {
    useConjuntosEventoStore.getState().criar('Local', ['1']);
    setEscopo({ tipo: 'lotacao', workspaceId: 'ws' });
    useConjuntosEventoStore.getState().hidratar();
    expect(useConjuntosEventoStore.getState().personalizados).toEqual([]);
  });
});
