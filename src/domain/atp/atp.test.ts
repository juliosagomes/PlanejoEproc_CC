import { describe, expect, it } from 'vitest';
import { CATALOGOS } from '@/data';
import {
  ACOES_PROGRAMADAS,
  CATALOGO_IDS,
  FILTROS_DEF,
  GRUPOS_FILTRO,
  acaoProgramadaDef,
  campoVisivel,
  definirParametro,
  filtroDef,
  hasAtpDetail,
  parametrosVazios,
  type CampoDef,
} from '@/domain';

/* ============================================================================
 * Os descritores são dado, e dado errado não dá erro de compilação: duas chaves
 * iguais numa ação fariam um campo sobrescrever o outro em silêncio. Estes
 * testes são a rede para isso.
 * ========================================================================== */

function repetidos(xs: string[]): string[] {
  return xs.filter((x, i) => xs.indexOf(x) !== i);
}

function chavesDe(campos: ReadonlyArray<CampoDef>): string[] {
  return campos.map((c) => c.chave);
}

describe('ações programadas', () => {
  it('são as 24 da tela do Eproc, sem código repetido', () => {
    expect(ACOES_PROGRAMADAS).toHaveLength(24);
    expect(repetidos(ACOES_PROGRAMADAS.map((a) => a.codigo))).toEqual([]);
  });

  it('nenhuma ação tem dois campos com a mesma chave', () => {
    for (const acao of ACOES_PROGRAMADAS) {
      expect(repetidos(chavesDe(acao.campos)), acao.codigo).toEqual([]);
    }
  });

  it('acaoProgramadaDef acha pelo código e devolve undefined para o desconhecido', () => {
    expect(acaoProgramadaDef('CMA')?.rotulo).toBe('Citação/Intimação por Mandado');
    expect(acaoProgramadaDef('XYZ')).toBeUndefined();
    expect(acaoProgramadaDef(undefined)).toBeUndefined();
  });
});

describe('filtros opcionais', () => {
  it('não há dois filtros com a mesma chave', () => {
    expect(repetidos(FILTROS_DEF.map((f) => f.chave))).toEqual([]);
  });

  it('nenhum filtro tem dois campos com a mesma chave, nem lista com subcampo repetido', () => {
    for (const f of FILTROS_DEF) {
      expect(repetidos(chavesDe(f.campos)), f.chave).toEqual([]);
      for (const c of f.campos) {
        if (c.tipo === 'lista') {
          expect(repetidos(chavesDe(c.subcampos)), `${f.chave}.${c.chave}`).toEqual([]);
        }
      }
    }
  });

  it('todo filtro tem ao menos um campo e cai num grupo do seletor', () => {
    for (const f of FILTROS_DEF) {
      expect(f.campos.length, f.chave).toBeGreaterThan(0);
      expect(GRUPOS_FILTRO).toContain(f.grupo);
    }
  });

  it('filtroDef acha pela chave', () => {
    expect(filtroDef('selPrazoMultiplo')?.rotulo).toBe('Prazo');
    expect(filtroDef('naoExiste')).toBeUndefined();
  });
});

describe('catálogos', () => {
  it('todo catálogo citável tem itens — arquivo vazio seria select sem opção', () => {
    for (const id of CATALOGO_IDS) {
      expect(CATALOGOS[id].length, id).toBeGreaterThan(0);
    }
  });
});

describe('campoVisivel', () => {
  const dataFinal = filtroDef('critDataModificador')?.campos.find(
    (c) => c.chave === 'critDataAutuacao2',
  );

  it('"Data final" só entra em jogo com o modificador "entre datas"', () => {
    if (!dataFinal) throw new Error('esperava o campo critDataAutuacao2');
    expect(campoVisivel(dataFinal, {})).toBe(false);
    expect(campoVisivel(dataFinal, { critDataModificador: 'IGUAL' })).toBe(false);
    expect(campoVisivel(dataFinal, { critDataModificador: 'ENTRE' })).toBe(true);
  });

  it('toda condição `quando` aponta para um campo irmão que existe', () => {
    const conferir = (campos: ReadonlyArray<CampoDef>, onde: string) => {
      const chaves = new Set(chavesDe(campos));
      for (const c of campos) {
        if (c.quando) expect(chaves.has(c.quando.chave), `${onde}.${c.chave}`).toBe(true);
        if (c.tipo === 'lista') conferir(c.subcampos, `${onde}.${c.chave}`);
      }
    };
    for (const f of FILTROS_DEF) conferir(f.campos, f.chave);
    for (const a of ACOES_PROGRAMADAS) conferir(a.campos, a.codigo);
  });
});

describe('definirParametro', () => {
  it('grava valor e remove a chave quando o valor é vazio', () => {
    const p = definirParametro({}, 'Prazo', 15);
    expect(p).toEqual({ Prazo: 15 });
    expect(definirParametro(p, 'Prazo', undefined)).toEqual({});
    expect(definirParametro({ a: 'x' }, 'a', '   ')).toEqual({});
    expect(definirParametro({ a: ['x'] }, 'a', [])).toEqual({});
  });

  it('zero e "Não" são valores, não ausência', () => {
    expect(definirParametro({}, 'Validade', 0)).toEqual({ Validade: 0 });
    expect(definirParametro({}, 'CitarDJE', false)).toEqual({ CitarDJE: false });
  });
});

describe('hasAtpDetail', () => {
  it('regra recém-criada não tem detalhamento', () => {
    expect(hasAtpDetail(undefined)).toBe(false);
    expect(hasAtpDetail({ implantar: false })).toBe(false);
    expect(hasAtpDetail({ implantar: false, observacoes: '  ', acoes: [], filtros: {} })).toBe(
      false,
    );
  });

  it('filtro adicionado e deixado em branco ainda não é detalhamento', () => {
    expect(hasAtpDetail({ implantar: false, filtros: { selRitoProcesso: {} } })).toBe(false);
    expect(parametrosVazios({ a: '', b: [] })).toBe(true);
  });

  it('qualquer bloco preenchido conta', () => {
    expect(hasAtpDetail({ implantar: true })).toBe(true);
    expect(hasAtpDetail({ implantar: false, comportamentoOrigem: '3' })).toBe(true);
    expect(hasAtpDetail({ implantar: false, trigger: { tipo: 'M' } })).toBe(true);
    expect(hasAtpDetail({ implantar: false, acoes: [{ id: 'a' }] })).toBe(true);
    expect(
      hasAtpDetail({
        implantar: false,
        filtros: { selRitoProcesso: { selRitoProcesso: '2' } },
      }),
    ).toBe(true);
    expect(hasAtpDetail({ implantar: false, observacoes: 'x' })).toBe(true);
  });
});
