import { describe, expect, it } from 'vitest';
import { FLAG_ESPERA_ID, FLAG_FIXO_ID, flagsPadrao, type DefinicaoFlag } from './flags';
import { fundirSetores, normalizarRotulo, setoresPadrao } from './setores';

function flag(id: string, label: string, cor: DefinicaoFlag['cor'] = 1): DefinicaoFlag {
  return { id, code: label.slice(0, 2).toUpperCase(), label, cor };
}

describe('setoresPadrao', () => {
  it('nasce com Espera e Fixo de fluxo', () => {
    expect(setoresPadrao().itens.map((f) => f.label)).toEqual([
      'Espera',
      'Fixo de fluxo',
    ]);
  });
});

describe('normalizarRotulo', () => {
  it('ignora acento, caixa e espaço repetido', () => {
    expect(normalizarRotulo('Setor de Cálculo')).toBe('setor de calculo');
    expect(normalizarRotulo('  SETOR   DE  CALCULO ')).toBe('setor de calculo');
  });
});

describe('fundirSetores', () => {
  it('casa pelos ids fixos mesmo com rótulo editado', () => {
    const atual = flagsPadrao();
    const entrando = [{ ...flag(FLAG_ESPERA_ID, 'Aguardando'), cor: 7 as const }];

    const { itens, remap } = fundirSetores(atual, entrando);

    expect(itens).toHaveLength(2);
    expect(itens[0]?.label).toBe('Espera'); // a unidade manda, não o que chegou
    expect(remap.size).toBe(0);
  });

  it('deduplica por rótulo e remapeia o id que chegou', () => {
    const atual = [flag('f-local', 'Setor de Cálculo', 3)];
    const entrando = [flag('f-remoto', 'SETOR DE CALCULO', 6)];

    const { itens, remap } = fundirSetores(atual, entrando);

    expect(itens).toHaveLength(1);
    expect(itens[0]?.id).toBe('f-local');
    expect(itens[0]?.cor).toBe(3);
    expect(remap.get('f-remoto')).toBe('f-local');
  });

  it('acrescenta o que não tem par, com cor livre', () => {
    const atual = flagsPadrao(); // usa as cores 2 e 4
    const entrando = [flag('f-novo', 'Triagem', 2)];

    const { itens, remap } = fundirSetores(atual, entrando);

    expect(itens.map((f) => f.label)).toEqual(['Espera', 'Fixo de fluxo', 'Triagem']);
    expect(itens[2]?.id).toBe('f-novo');
    expect(itens[2]?.cor).toBe(1); // a cor 2 já estava tomada
    expect(remap.size).toBe(0);
  });

  it('não repete cor entre vários itens novos na mesma fusão', () => {
    const entrando = [flag('a', 'Um'), flag('b', 'Dois'), flag('c', 'Três')];

    const { itens } = fundirSetores([], entrando);

    expect(itens.map((f) => f.cor)).toEqual([1, 2, 3]);
  });

  it('id igual vence rótulo diferente, e rótulo igual não cria duplicata', () => {
    const atual = [flag(FLAG_FIXO_ID, 'Fixo de fluxo', 4)];
    const entrando = [flag('f-outro', 'fixo  de  FLUXO', 8)];

    const { itens, remap } = fundirSetores(atual, entrando);

    expect(itens).toHaveLength(1);
    expect(remap.get('f-outro')).toBe(FLAG_FIXO_ID);
  });

  it('não muta a lista recebida', () => {
    const atual = flagsPadrao();
    fundirSetores(atual, [flag('f-novo', 'Triagem')]);
    expect(atual).toHaveLength(2);
  });
});
