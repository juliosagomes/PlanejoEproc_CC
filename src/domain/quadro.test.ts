import { describe, expect, it } from 'vitest';
import { ehDestinoDescarte, nomeInvisivel, rotuloDescarte, sugerirDescarte } from './descarte';
import { regrasCitadas } from './quadro';

describe('regrasCitadas', () => {
  it('lê as formas usadas nos planos da unidade', () => {
    expect(regrasCitadas('Regra 54 e 55 - Remoção de "PETIÇÃO" das triagens')).toEqual([54, 55]);
    expect(regrasCitadas('Regras 147 e 148 - Controle de processos perdidos')).toEqual([147, 148]);
    expect(regrasCitadas('Regra 131: Intimação automática')).toEqual([131]);
    expect(regrasCitadas('regra 92, 93 e 94; ver também Regra 92')).toEqual([92, 93, 94]);
  });

  it('número solto não é regra', () => {
    expect(regrasCitadas('Prazo de 15 dias, art. 334')).toEqual([]);
  });
});

describe('destinos de descarte', () => {
  const INVISIVEL = '‎';

  it('o nome invisível é invisível, mas não é vazio', () => {
    expect(nomeInvisivel(INVISIVEL)).toBe(true);
    expect(nomeInvisivel('')).toBe(false);
    expect(nomeInvisivel('P')).toBe(false);
    expect(rotuloDescarte(INVISIVEL)).toBe('(nome invisível)');
  });

  it('compara por espaço e caixa, sem confundir o invisível com nome vazio', () => {
    const lista = ['P', INVISIVEL];
    expect(ehDestinoDescarte(' p ', lista)).toBe(true);
    expect(ehDestinoDescarte(INVISIVEL, lista)).toBe(true);
    expect(ehDestinoDescarte('', lista)).toBe(false);
    expect(ehDestinoDescarte('PETIÇÃO', lista)).toBe(false);
  });

  it('sugere os candidatos óbvios que ainda não estão na lista', () => {
    expect(sugerirDescarte(['P', INVISIVEL, 'PETIÇÃO', 'X'], ['x'])).toEqual(['P', INVISIVEL]);
  });
});
