import { describe, expect, it } from 'vitest';
import D1 from './__fixtures__/automatizarLocalizadoresAlterar-1.html?raw';
import D7 from './__fixtures__/automatizarLocalizadoresAlterar-7.html?raw';
import D12 from './__fixtures__/automatizarLocalizadoresAlterar-12.html?raw';
import D49 from './__fixtures__/automatizarLocalizadoresAlterar-49.html?raw';
import D66 from './__fixtures__/automatizarLocalizadoresAlterar-66.html?raw';
import D132 from './__fixtures__/automatizarLocalizadoresAlterar-132.html?raw';
import D182 from './__fixtures__/automatizarLocalizadoresAlterar-182.html?raw';
import D312 from './__fixtures__/automatizarLocalizadoresAlterar-312.html?raw';
import { lerPhpSerializado } from './phpSerializado';
import { parseRegraAtpDetalhe } from './parseRegraAtpDetalhe';

describe('lerPhpSerializado', () => {
  it('lê arrays, strings com aspas e objetos', () => {
    expect(lerPhpSerializado('a:2:{s:1:"a";s:3:"x"y";i:1;O:3:"Foo":1:{s:1:"b";N;}}')).toEqual({
      a: 'x"y',
      '1': { b: null },
    });
  });
});

describe('parseRegraAtpDetalhe (D-46)', () => {
  it('regra 1: evento, lembrete e filtro de classe', () => {
    const { numero, regra } = parseRegraAtpDetalhe(D1);
    expect(numero).toBe(1);
    expect(regra.comportamentoOrigem).toBe('0');
    expect(regra.trigger).toMatchObject({ tipo: 'E' });
    expect(regra.trigger?.tipo === 'E' && regra.trigger.eventoIds).toContain('20008');
    expect(regra.acoes).toEqual([
      expect.objectContaining({
        tipo: 'LBT',
        localizadorErro: 'Servidor - Analisar automação - Fixo',
        parametros: expect.objectContaining({
          Validade: 15,
          OrgaoDestinoLembrete: 'Todos os órgãos',
          ExibirLembreteMovProcessual: false,
        }),
      }),
    ]);
    expect(regra.filtros).toEqual({
      selClassesJudiciaisMultiplo: { selClassesJudiciaisMultiplo: ['0000100054'] },
    });
  });

  it('regra 182: duas ações, petição/documento, entidade e localizador do filtro', () => {
    const { regra } = parseRegraAtpDetalhe(D182);
    expect(regra.trigger).toEqual({
      tipo: 'A',
      peticaoTipoIds: ['305', '48'],
      documentos: ['33', '236'],
      restringirA: 'PER',
    });
    expect(regra.acoes?.map((a) => [a.tipo, a.descricao])).toEqual([
      ['LBT', 'INCLUIR LEMBRETE'],
      ['E', 'INTIMA PARTES'],
    ]);
    expect(regra.acoes?.[0]?.parametros?.LembreteTexto).toMatch(/^Laudo pericial apresentado/);
    expect(regra.acoes?.[1]?.parametros?.txtEventoAutomatico).toBe(
      'Expedida/certificada a intimação eletrônica - Laudo',
    );
    expect(regra.filtros?.compSelIdLocalizadorContemTodos).toEqual({
      compSelIdLocalizadorContemTodos: ['Ag. Laudo Pericial ⏳'],
    });
    expect(regra.filtros?.compSelIdDadoComplementarProcesso).toEqual({
      compSelIdDadoComplementarProcesso: ['3|1'],
    });
  });

  it('regra 12: origem com E e petição de entidade específica', () => {
    const { regra, origemModo } = parseRegraAtpDetalhe(D12);
    expect(origemModo).toBe('M');
    expect(regra.opcaoMultiplosLocalizadores).toBe('AND');
    expect(regra.trigger).toMatchObject({
      tipo: 'P',
      restringirA: 'S',
      entidade: 'MINISTÉRIO PÚBLICO DO ESTADO DE MINAS GERAIS',
    });
    expect(regra.acoes).toBeUndefined();
  });

  it('regra 7: por data, com o filtro de evento montado por script', () => {
    const { regra } = parseRegraAtpDetalhe(D7);
    expect(regra.trigger).toEqual({ tipo: 'D', tipoData: 'T' });
    expect(regra.filtros?.selectTipoControle).toEqual({
      condicoes: [{ selectTipoControle: 'E', selectTipoPrefixo: 'IN', selEventoFiltroMultiplo: ['545'] }],
    });
  });

  it('regra 49: tempo no localizador em dias úteis', () => {
    expect(parseRegraAtpDetalhe(D49).regra.trigger).toEqual({ tipo: 'L', dias: 30, diasUteis: true });
  });

  it('regra 66: uma origem só não traz a opção OU/E', () => {
    const { regra, origemModo } = parseRegraAtpDetalhe(D66);
    expect(origemModo).toMatch(/^\d+$/);
    expect(regra.opcaoMultiplosLocalizadores).toBeUndefined();
  });

  it('regras 132 e 312: ação manual com descrição, um clique e filtro "NÃO contenha"', () => {
    const r132 = parseRegraAtpDetalhe(D132).regra;
    expect(r132.trigger).toEqual({
      tipo: 'M',
      descricao: '⏳Decorrido Prazo de Contestação - Vista MP',
      acaoPreferencialNaCapa: true,
      umClique: true,
    });
    expect(r132.filtros?.selectTipoControle?.condicoes).toEqual([
      {
        selectTipoControle: 'P',
        selectTipoPrefixo: 'NOT IN',
        selTipoPeticaoFiltroMultiplo: ['35', '344', '343', '80'],
        selSinPoloFiltroContenhaEvento: 'Q',
      },
    ]);
    expect(r132.acoes?.[0]?.tipo).toBe('EDP');
    const r312 = parseRegraAtpDetalhe(D312).regra;
    expect(r312.acoes?.[0]).toMatchObject({
      tipo: 'E',
      parametros: { txtEventoAutomatico: 'Conclusos para Despacho' },
      localizadorErro: '📝 Minutar (Secretaria)',
    });
  });
});
