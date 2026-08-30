import { describe, expect, it } from 'vitest';
import { CORES_FLAG, flagsPadrao, proximaCor, sugerirCode } from './flags';

describe('flagsPadrao', () => {
  it('traz só Espera e Fixo de fluxo', () => {
    expect(flagsPadrao().map((f) => f.label)).toEqual(['Espera', 'Fixo de fluxo']);
  });

  it('devolve objetos novos a cada chamada', () => {
    const a = flagsPadrao();
    a[0]!.label = 'mexido';
    expect(flagsPadrao()[0]?.label).toBe('Espera');
  });
});

describe('sugerirCode', () => {
  it('usa as iniciais das duas primeiras palavras', () => {
    expect(sugerirCode('Setor de Cálculo')).toBe('SC');
    expect(sugerirCode('Joana Silva')).toBe('JS');
  });

  it('com uma palavra só, usa as duas primeiras letras', () => {
    expect(sugerirCode('Espera')).toBe('ES');
    expect(sugerirCode('X')).toBe('X');
  });

  it('ignora preposições curtas em minúscula', () => {
    expect(sugerirCode('Fixo de fluxo')).toBe('FF');
  });

  it('devolve string vazia para rótulo em branco', () => {
    expect(sugerirCode('   ')).toBe('');
  });
});

describe('proximaCor', () => {
  it('escolhe a primeira cor livre', () => {
    expect(proximaCor([])).toBe(1);
    expect(proximaCor(flagsPadrao())).toBe(1); // padrões usam 2 e 4
  });

  it('recomeça a paleta em vez de recusar quando tudo está usado', () => {
    const todas = CORES_FLAG.map((cor, i) => ({
      id: `f-${i}`,
      code: 'X',
      label: 'X',
      cor,
    }));
    expect(proximaCor(todas)).toBe(1);
  });
});
