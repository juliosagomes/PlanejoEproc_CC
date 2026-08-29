import { describe, expect, it } from 'vitest';
import { ILUSTRACOES } from './ilustracoes';
import { PASSOS, TOTAL_PASSOS } from './roteiro';

describe('roteiro do tutorial', () => {
  it('tem os 8 passos do roteiro combinado', () => {
    expect(TOTAL_PASSOS).toBe(8);
  });

  it('os ids são 1..8, únicos e na ordem de apresentação', () => {
    expect(PASSOS.map((p) => p.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('nenhum passo fica sem título ou sem texto', () => {
    for (const p of PASSOS) {
      expect(p.titulo.trim()).not.toBe('');
      expect(p.paragrafos.length).toBeGreaterThan(0);
      for (const paragrafo of p.paragrafos) expect(paragrafo.trim()).not.toBe('');
    }
  });

  it('nota vazia não passa — ou tem conteúdo, ou não existe', () => {
    for (const p of PASSOS) {
      if (p.nota !== undefined) expect(p.nota.trim()).not.toBe('');
    }
  });

  it('todo passo tem ilustração', () => {
    // Pega o esquecimento clássico: escrevi o passo novo e não desenhei a cena.
    // Importar o mapa só referencia `ComponentType`; nada é renderizado aqui.
    for (const p of PASSOS) expect(ILUSTRACOES[p.id]).toBeDefined();
  });

  it('não sobra ilustração órfã', () => {
    const ids = new Set(PASSOS.map((p) => p.id));
    for (const chave of Object.keys(ILUSTRACOES)) {
      expect(ids.has(Number(chave))).toBe(true);
    }
  });

  it('a ficção do catálogo fica confinada aos dois primeiros passos', () => {
    // Do passo 3 em diante o tutorial descreve gestos que o usuário faz de
    // verdade; marcar esses como "ilustração" enfraqueceria o aviso onde ele
    // importa.
    expect(PASSOS.filter((p) => p.ilustrativo === true).map((p) => p.id)).toEqual([1, 2]);
  });
});
