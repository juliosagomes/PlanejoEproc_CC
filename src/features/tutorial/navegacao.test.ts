import { describe, expect, it } from 'vitest';
import {
  anterior,
  ehPrimeiro,
  ehUltimo,
  limitar,
  proximo,
  rotuloAvancar,
} from './navegacao';
import { TOTAL_PASSOS } from './roteiro';

const ULTIMO = TOTAL_PASSOS - 1;

describe('limitar', () => {
  it('deixa passar o que já está na faixa', () => {
    expect(limitar(0)).toBe(0);
    expect(limitar(3)).toBe(3);
    expect(limitar(ULTIMO)).toBe(ULTIMO);
  });

  it('grampeia nas duas bordas', () => {
    expect(limitar(-1)).toBe(0);
    expect(limitar(-99)).toBe(0);
    expect(limitar(TOTAL_PASSOS)).toBe(ULTIMO);
    expect(limitar(999)).toBe(ULTIMO);
  });

  it('sobrevive a lixo numérico', () => {
    expect(limitar(Number.NaN)).toBe(0);
    expect(limitar(Number.POSITIVE_INFINITY)).toBe(0);
    expect(limitar(2.7)).toBe(2);
  });
});

describe('proximo / anterior', () => {
  it('andam um passo por vez', () => {
    expect(proximo(0)).toBe(1);
    expect(anterior(3)).toBe(2);
  });

  it('não passam das bordas', () => {
    expect(proximo(ULTIMO)).toBe(ULTIMO);
    expect(anterior(0)).toBe(0);
  });

  it('um passeio qualquer nunca sai da faixa', () => {
    let i = 0;
    for (let n = 0; n < 200; n += 1) {
      i = n % 3 === 0 ? anterior(i) : proximo(i);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThanOrEqual(ULTIMO);
    }
  });
});

describe('bordas e rótulo', () => {
  it('reconhece primeiro e último', () => {
    expect(ehPrimeiro(0)).toBe(true);
    expect(ehPrimeiro(1)).toBe(false);
    expect(ehUltimo(ULTIMO)).toBe(true);
    expect(ehUltimo(ULTIMO - 1)).toBe(false);
  });

  it('o botão de avançar só vira "Concluir" no fim', () => {
    for (let i = 0; i < ULTIMO; i += 1) expect(rotuloAvancar(i)).toBe('Próximo');
    expect(rotuloAvancar(ULTIMO)).toBe('Concluir');
  });
});
