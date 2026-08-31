import { describe, expect, it } from 'vitest';
import type { LocalizadorOrgao, LocalizadorUnidade } from '@/domain';
import { unirSugestoes } from './sugestoes';

function daUnidade(
  sigla: string,
  sistema = false,
): LocalizadorUnidade {
  return { sigla, nome: sigla, sistema };
}

function doXls(nome: string, sistema?: boolean): LocalizadorOrgao {
  return { id: `lo-${nome}`, nome, ...(sistema ? { sistema: true } : {}) };
}

describe('unirSugestoes', () => {
  it('põe os de sistema no fim, alfabéticos dentro de cada grupo', () => {
    const lista = unirSugestoes(
      [
        daUnidade('Zebra', false),
        daUnidade('Aguarda prazo', true),
        daUnidade('Concluso', false),
        daUnidade('Zulu sistema', true),
      ],
      [],
    );

    expect(lista.map((i) => i.nome)).toEqual([
      'Concluso',
      'Zebra',
      'Aguarda prazo',
      'Zulu sistema',
    ]);
  });

  it('agrupa por sistema independentemente da fonte', () => {
    const lista = unirSugestoes([daUnidade('Do Eproc', true)], [doXls('Do XLS')]);

    expect(lista.map((i) => [i.nome, i.sistema ?? false])).toEqual([
      ['Do XLS', false],
      ['Do Eproc', true],
    ]);
  });

  it('em colisão a unidade vence, com a marca dela', () => {
    // O XLS pode ser um export de meses atrás; a unidade veio do Eproc agora.
    // Se o mesmo nome mudou de categoria no Eproc, é a versão nova que vale.
    const lista = unirSugestoes([daUnidade('Concluso', true)], [doXls('Concluso')]);

    expect(lista).toHaveLength(1);
    expect(lista[0]?.sistema).toBe(true);
  });

  it('a colisão ignora a decoração do nome (emoji do Eproc)', () => {
    const lista = unirSugestoes([daUnidade('🔵 Concluso')], [doXls('Concluso')]);

    expect(lista).toHaveLength(1);
    expect(lista[0]?.nome).toBe('🔵 Concluso');
  });

  it('preserva a marca dos itens vindos do XLS', () => {
    const lista = unirSugestoes([], [doXls('Comum'), doXls('Padrão do Eproc', true)]);

    expect(lista.map((i) => i.nome)).toEqual(['Comum', 'Padrão do Eproc']);
    expect(lista[1]?.sistema).toBe(true);
  });
});
