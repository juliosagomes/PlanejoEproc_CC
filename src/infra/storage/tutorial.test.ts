import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TUTORIAL_VERSAO,
  getTutorialVisto,
  limparTutorialVisto,
  marcarTutorialVisto,
} from './tutorial';

/**
 * A chave é escrita à mão de propósito. Renomeá-la sem querer faria o tutorial
 * reaparecer para toda a base instalada, em silêncio — este literal é a única
 * barreira contra isso.
 */
const TUTORIAL_KEY = 'planejoeproc:tutorial:visto';

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('flag do tutorial', () => {
  it('nasce nula e grava a versão corrente', () => {
    expect(getTutorialVisto()).toBeNull();
    marcarTutorialVisto();
    expect(getTutorialVisto()).toBe(TUTORIAL_VERSAO);
  });

  it('grava na chave global, sem prefixo de silo', () => {
    marcarTutorialVisto();
    expect(localStorage.getItem(TUTORIAL_KEY)).not.toBeNull();
  });

  it('aceita uma versão explícita — é o que permite reexibir roteiro novo', () => {
    marcarTutorialVisto(3);
    expect(getTutorialVisto()).toBe(3);
  });

  it('limpar faz o tutorial voltar a abrir', () => {
    marcarTutorialVisto();
    limparTutorialVisto();
    expect(getTutorialVisto()).toBeNull();
  });

  it('JSON corrompido vira "nunca viu" em vez de estourar no boot', () => {
    localStorage.setItem(TUTORIAL_KEY, '{ não é json');
    expect(getTutorialVisto()).toBeNull();
  });

  it('shape inesperado também vira "nunca viu"', () => {
    localStorage.setItem(TUTORIAL_KEY, JSON.stringify(true));
    expect(getTutorialVisto()).toBeNull();
    localStorage.setItem(TUTORIAL_KEY, JSON.stringify({ versao: 'um', em: 'x' }));
    expect(getTutorialVisto()).toBeNull();
  });

  it('versão zero ou negativa é recusada', () => {
    localStorage.setItem(TUTORIAL_KEY, JSON.stringify({ versao: 0, em: 'x' }));
    expect(getTutorialVisto()).toBeNull();
  });
});
