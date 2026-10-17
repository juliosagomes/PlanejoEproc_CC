import { beforeEach, describe, expect, it } from 'vitest';
import { DOCUMENTOS, EVENTOS, TIPOS_PETICAO, type ItemCatalogo } from '@/data';
import {
  CONJUNTOS_DOCUMENTO_PADRAO,
  CONJUNTOS_EVENTO_PADRAO,
  CONJUNTOS_PETICAO_PADRAO,
  LIMITE_EXCLUSAO,
  resumirSelecao,
  type CatalogoConjunto,
  type Conjunto,
} from '@/domain';
import { useCanvasStore } from '@/features/canvas/store';
import { fmtSelecao } from '@/features/checklist/detalhesAtp';
import { setEscopo } from '@/infra/storage';
import { CATALOGOS_CONJUNTO, frasePorResumo, resumir } from './catalogos';
import { useConjuntosStore } from './store';

const IDS_EVENTOS = CATALOGOS_CONJUNTO.eventos.ids;

const conjunto = (cat: CatalogoConjunto, id: string): Conjunto => {
  const c = CATALOGOS_CONJUNTO[cat].padrao.find((x) => x.id === id);
  if (!c) throw new Error(`conjunto ${cat}/${id} não existe`);
  return c;
};

/** Rótulo pode se repetir no catálogo (documentos): basta um dos códigos estar. */
function contem(cat: CatalogoConjunto, itens: readonly ItemCatalogo[], id: string, rotulo: string) {
  const codigos = itens.filter((e) => e.label === rotulo).map((e) => e.value);
  if (codigos.length === 0) throw new Error(`"${rotulo}" não está no catálogo ${cat}`);
  const ids = conjunto(cat, id).ids;
  return codigos.some((c) => ids.includes(c));
}

/**
 * Os conjuntos padrão são regras sobre o rótulo. Estes casos prendem a regra ao
 * catálogo real: se uma atualização do JSON mudar a redação, o teste avisa em
 * vez de o conjunto encolher calado.
 */
describe.each([
  ['eventos', CONJUNTOS_EVENTO_PADRAO, 5],
  ['tiposPeticao', CONJUNTOS_PETICAO_PADRAO, 15],
  ['documentos', CONJUNTOS_DOCUMENTO_PADRAO, 130],
] as const)('conjuntos padrão de %s contra o catálogo embutido', (cat, regras, maxSemConjunto) => {
  const cfg = CATALOGOS_CONJUNTO[cat];

  it('nenhum conjunto sai vazio, e quase todo item cai em algum', () => {
    for (const c of cfg.padrao) expect(c.ids.length, c.id).toBeGreaterThan(0);
    const cobertos = new Set(cfg.padrao.flatMap((c) => c.ids));
    expect(cfg.ids.filter((id) => !cobertos.has(id)).length).toBeLessThanOrEqual(maxSemConjunto);
  });

  it('ids são únicos entre os padrão', () => {
    const ids = regras.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('toda categoria usada existe na lista do catálogo', () => {
    for (const c of cfg.padrao) {
      if (cfg.categorias.length === 0) expect(c.categoria, c.id).toBeUndefined();
      else expect(cfg.categorias, c.id).toContain(c.categoria);
    }
  });

  it('o catálogo não tem código repetido', () => {
    expect(new Set(cfg.ids).size).toBe(cfg.ids.length);
  });
});

describe('eventos: exemplos', () => {
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
    expect(contem('eventos', EVENTOS, id, rotulo)).toBe(esperado);
  });
});

describe('tipos de petição: exemplos', () => {
  it.each([
    ['recursos', 'APELAÇÃO', true],
    ['recursos', 'EMBARGOS DE DECLARAÇÃO', true],
    ['recursos', 'EMBARGOS À AÇÃO MONITÓRIA', false],
    ['defesa', 'EMBARGOS À AÇÃO MONITÓRIA', true],
    ['defesa', 'PETIÇÃO - RECONHECIMENTO TOTAL DO PEDIDO', true],
    ['conciliacao', 'TERMO DE ACORDO', true],
    // Acordo de não persecução é penal, não conciliação.
    ['conciliacao', 'ACORDO DE NAO-PERSECUÇAO PENAL', false],
    ['acao-penal', 'ACORDO DE NAO-PERSECUÇAO PENAL', true],
    ['prazo', 'MERA CIÊNCIA', true],
    ['restricoes', 'PETIÇÃO - SOLICITAÇÃO SISBAJUD', true],
    ['suspensao', 'PETIÇÃO - SUSPENSÃO ART. 40 LEF', true],
    ['suspensao', 'PETIÇÃO - PEDIDO DE SUSPENSÃO CONDICIONAL DO PROCESSO', false],
    ['mp-policia', 'RELATÓRIO FINAL IPL', true],
    ['genericas', 'PETIÇÃO', true],
    ['genericas', 'PETIÇÃO - PAGAMENTO', false],
  ] as const)('%s × "%s" → %s', (id, rotulo, esperado) => {
    expect(contem('tiposPeticao', TIPOS_PETICAO, id, rotulo)).toBe(esperado);
  });
});

describe('documentos: exemplos', () => {
  it.each([
    ['iniciais', 'Petição Inicial', true],
    ['pecas-partes', 'Petição Inicial', false],
    ['pecas-partes', 'Contestação', true],
    ['pecas-partes', 'Manifestação do Ministério Público', false],
    ['mp-defensoria', 'Manifestação do Ministério Público', true],
    ['recursos', 'Agravo em Recurso Especial', true],
    ['despachos', 'Despacho de Mero Expediente', true],
    ['decisoes', 'Concessão Liminar dos Efeitos da Tutela Antecipada', true],
    // "Pre-liminar" não é liminar.
    ['decisoes', 'Mandado de Despejo com Audiência Preliminar', false],
    ['sentencas', 'Acórdão', true],
    ['atas', 'Ata de Audiência de Conciliação', true],
    ['certidoes', 'Certidão de Trânsito em Julgado', true],
    ['certidoes', 'Certidão de Nascimento', false],
    ['pessoais', 'Certidão de Nascimento', true],
    ['intimacoes', 'CARTA AR - Notificação Autoridade Coatora', true],
    // "Carta ar-bitral" não é AR.
    ['intimacoes', 'Carta Arbitral', false],
    ['cartas', 'Carta Precatória', true],
    ['mandados', 'Mandado de Penhora e Avaliação', true],
    ['constricao', 'Mandado de Penhora e Avaliação', true],
    ['alvaras', 'Alvará de Levantamento', true],
    ['calculos', 'Guia de Custas', true],
    ['calculos', 'Guia de Execução Penal', false],
    ['consultas', 'DETALHAMENTO SISBAJUD - NEGATIVO', true],
    ['oficios', 'Ofício', true],
    ['oficios', 'Ofício Requisitório de Precatório', false],
    ['prisao', 'Alvará de Soltura - Com Fiança', true],
    ['investigacao', 'Inquérito Policial', true],
    ['investigacao', 'Recebimento da Denúncia', false],
    ['infancia', 'Plano Individual de Atendimento', true],
  ] as const)('%s × "%s" → %s', (id, rotulo, esperado) => {
    expect(contem('documentos', DOCUMENTOS, id, rotulo)).toBe(esperado);
  });
});

describe('resumirSelecao', () => {
  const universo = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'];
  const cs: Conjunto[] = [
    { id: 'x', rotulo: 'X', ids: ['a', 'b', 'c'], personalizado: false },
    { id: 'y', rotulo: 'Y', ids: ['d', 'e'], personalizado: false },
    { id: 'xy', rotulo: 'XY', ids: ['a', 'b', 'c', 'd', 'e'], personalizado: false },
  ];
  const menos = (...fora: string[]) => universo.filter((id) => !fora.includes(id));

  it('vazio e todos', () => {
    expect(resumirSelecao([], universo, cs)).toEqual({ modo: 'vazio' });
    expect(resumirSelecao(universo, universo, cs)).toEqual({ modo: 'todos', total: 12 });
  });

  it('inclusão prefere o conjunto maior e deixa o resto como avulso', () => {
    const r = resumirSelecao(['a', 'b', 'c', 'd', 'e', 'g'], universo, cs);
    expect(r).toMatchObject({ modo: 'inclusao', avulsos: ['g'] });
    expect(r.modo === 'inclusao' && r.conjuntos.map((c) => c.id)).toEqual(['xy']);
  });

  it('"todos − um conjunto e um avulso"', () => {
    const r = resumirSelecao(menos('d', 'e', 'k'), universo, cs);
    expect(r).toMatchObject({ modo: 'exclusao', avulsos: ['k'] });
    expect(r.modo === 'exclusao' && r.conjuntos.map((c) => c.id)).toEqual(['y']);
  });

  it(`a exclusão cabe em até ${LIMITE_EXCLUSAO} peças`, () => {
    // Universo maior, para a inclusão ficar longa (XY + uma dezena de avulsos).
    const grande = [...universo, 'm', 'n', 'o', 'p', 'q', 'r', 's', 't'];
    const sem = (...fora: string[]) => grande.filter((id) => !fora.includes(id));
    expect(resumirSelecao(sem('f', 'g', 'h', 'i', 'j'), grande, cs).modo).toBe('exclusao');
    // Seis avulsos de fora: já não é resumo.
    expect(resumirSelecao(sem('f', 'g', 'h', 'i', 'j', 'k'), grande, cs).modo).toBe('inclusao');
  });

  it('a forma mais curta vence, e no empate fica a exclusão', () => {
    // Inclusão: XY + f + g = 3 peças. Exclusão: h…l = 5. Fica a inclusão.
    expect(resumirSelecao(['a', 'b', 'c', 'd', 'e', 'f', 'g'], universo, cs).modo).toBe('inclusao');
    // Inclusão: X = 1 peça. Exclusão: z = 1 peça. Empate.
    expect(resumirSelecao(['a', 'b', 'c'], ['a', 'b', 'c', 'z'], cs).modo).toBe('exclusao');
  });

  it('conjunto só conta se estiver inteiro na seleção', () => {
    const r = resumirSelecao(['a', 'b'], universo, cs);
    expect(r).toMatchObject({ modo: 'inclusao', conjuntos: [], avulsos: ['a', 'b'] });
  });

  it('id fora do catálogo vira avulso, nunca some', () => {
    const r = resumirSelecao([...universo, 'zz'], universo, cs);
    expect(r.modo).toBe('inclusao');
    expect(r.modo === 'inclusao' && r.avulsos).toContain('zz');
  });
});

describe('"Todos − x, y, z" na tela e no checklist', () => {
  const ciencia = new Set(conjunto('eventos', 'mera-ciencia').ids);
  const selecao = IDS_EVENTOS.filter((id) => !ciencia.has(id));

  it('resume em uma frase', () => {
    expect(frasePorResumo('eventos', resumir('eventos', selecao))).toMatch(
      /^Todos os eventos − Mera ciência \(1\.0\d\d\)$/,
    );
  });

  it('o avulso de fora aparece pelo nome', () => {
    const despacho = EVENTOS.find((e) => e.label === 'Decorrido prazo');
    if (!despacho) throw new Error('evento ausente');
    const sel = selecao.filter((id) => id !== despacho.value);
    expect(frasePorResumo('eventos', resumir('eventos', sel))).toMatch(
      /^Todos os eventos − Mera ciência e Decorrido prazo \(/,
    );
  });

  it('o checklist diz o que desmarcar no Eproc', () => {
    const [frase, lista] = fmtSelecao('eventos', selecao).split('\n');
    expect(frase).toMatch(/^Todos os eventos − Mera ciência/);
    expect(lista).toMatch(/^Marcar todos e desmarcar: /);
    expect(lista).toContain('Confirmada a intimação eletrônica');
  });

  it('vale para tipos de petição e documentos', () => {
    const recursos = new Set(conjunto('tiposPeticao', 'recursos').ids);
    const pet = CATALOGOS_CONJUNTO.tiposPeticao.ids.filter((id) => !recursos.has(id));
    expect(fmtSelecao('tiposPeticao', pet)).toMatch(/^Todos os tipos de petição − Recursos e agravos \(/);

    const mandados = new Set(conjunto('documentos', 'mandados').ids);
    const docs = CATALOGOS_CONJUNTO.documentos.ids.filter((id) => !mandados.has(id));
    expect(fmtSelecao('documentos', docs)).toMatch(/^Todos os documentos − Mandados \(/);
  });

  it('seleção pequena sem conjunto continua em uma linha', () => {
    expect(fmtSelecao('eventos', IDS_EVENTOS.slice(0, 2))).not.toContain('\n');
  });

  it('documento antigo, digitado por nome, aparece como veio', () => {
    expect(fmtSelecao('documentos', ['Laudo do perito'])).toBe('Laudo do perito');
  });
});

describe('conjuntos da unidade', () => {
  beforeEach(() => {
    localStorage.clear();
    setEscopo({ tipo: 'local' });
    useCanvasStore.setState({ somenteLeitura: false });
    useConjuntosStore.getState().limpar();
  });

  it('criar, renomear, substituir e apagar persistem no silo', () => {
    const s = useConjuntosStore.getState();
    const id = s.criar('eventos', '  Prazos da vara ', ['1', '2', '2']);
    expect(useConjuntosStore.getState().personalizados.eventos).toEqual([
      { id, rotulo: 'Prazos da vara', ids: ['1', '2'] },
    ]);
    useConjuntosStore.getState().atualizar('eventos', id, { rotulo: 'Prazos', ids: ['3'] });
    useConjuntosStore.getState().limpar();
    useConjuntosStore.getState().hidratar();
    expect(useConjuntosStore.getState().personalizados.eventos).toEqual([
      { id, rotulo: 'Prazos', ids: ['3'] },
    ]);
    useConjuntosStore.getState().remover('eventos', id);
    expect(localStorage.getItem('planejoeproc:conjuntosEvento')).toBeNull();
  });

  it('cada catálogo tem a sua chave, e a de eventos é a de antes', () => {
    const s = useConjuntosStore.getState();
    s.criar('eventos', 'E', ['1']);
    s.criar('tiposPeticao', 'P', ['32']);
    s.criar('documentos', 'D', ['21']);
    expect(localStorage.getItem('planejoeproc:conjuntosEvento')).toContain('"E"');
    expect(localStorage.getItem('planejoeproc:conjuntosPeticao')).toContain('"P"');
    expect(localStorage.getItem('planejoeproc:conjuntosDocumento')).toContain('"D"');
    useConjuntosStore.getState().limpar();
    useConjuntosStore.getState().hidratar();
    const p = useConjuntosStore.getState().personalizados;
    expect([p.eventos.length, p.tiposPeticao.length, p.documentos.length]).toEqual([1, 1, 1]);
    expect(p.tiposPeticao[0]?.rotulo).toBe('P');
  });

  it('em visualização não grava', () => {
    useCanvasStore.setState({ somenteLeitura: true });
    expect(useConjuntosStore.getState().criar('eventos', 'X', ['1'])).toBe('');
    expect(useConjuntosStore.getState().personalizados.eventos).toEqual([]);
  });

  it('lotações não se misturam', () => {
    useConjuntosStore.getState().criar('documentos', 'Local', ['1']);
    setEscopo({ tipo: 'lotacao', workspaceId: 'ws' });
    useConjuntosStore.getState().hidratar();
    expect(useConjuntosStore.getState().personalizados.documentos).toEqual([]);
  });
});
