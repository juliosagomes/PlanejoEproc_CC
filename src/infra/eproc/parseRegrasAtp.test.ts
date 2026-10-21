import { describe, expect, it } from 'vitest';
import LISTA from './__fixtures__/automatizarLocalizadores.html?raw';
import { parseRegrasAtp } from './parseRegrasAtp';

const regras = parseRegrasAtp(LISTA);
const regra = (n: number) => {
  const r = regras.find((x) => x.numero === n);
  if (!r) throw new Error(`regra ${n} não lida`);
  return r;
};

describe('parseRegrasAtp (D-46)', () => {
  it('lê as 13 linhas da fixture', () => {
    expect(regras.map((r) => r.numero)).toEqual([1, 2, 7, 12, 27, 49, 66, 129, 132, 152, 180, 182, 312]);
  });

  it('a situação vem do checkbox, não do aviso "DESATIVADA"', () => {
    expect(regra(1).ativa).toBe(true);
    expect(regra(180).ativa).toBe(false);
  });

  it('separa vários destinos somados e tira a repetição "sigla - nome"', () => {
    expect(regra(1)).toMatchObject({
      grupo: 'Cartas Precatórias',
      tipoOrigem: 'localizadores',
      origens: ['PETIÇÃO INICIAL'],
      destinos: ['.CPs - [Triagem]', '.CPs'],
      tipoControle: 'Por Evento',
      eprocId: '11769707789881704637367937099',
    });
    expect(regra(1).acoesTexto?.[0]).toMatch(/^INCLUIR LEMBRETE · Lembrete:/);
    expect(regra(1).filtrosTexto).toEqual(['Classe: CARTA PRECATÓRIA CÍVEL']);
  });

  it('origem com OU e com E, mesmo quando a sigla contém " - "', () => {
    expect(regra(2)).toMatchObject({
      origens: ['PETIÇÃO INICIAL', 'URGENTE', 'PI - DEPENDÊNCIA'],
      opcaoOrigens: 'OR',
    });
    expect(regra(12)).toMatchObject({
      origens: ['[TRIAGEM] - [LIMINAR] - ❗Ag. Manifestação do MP - Pedido Liminar', 'PETIÇÃO'],
      opcaoOrigens: 'AND',
    });
  });

  it('origem "Nenhum" guarda o localizador do filtro "Que Contenha"', () => {
    expect(regra(182)).toMatchObject({
      tipoOrigem: 'nenhum',
      origens: [],
      destinos: ['Vista Laudo ➡️ MP ⏳', '🟢Sistema AJ'],
      filtroContem: ['Ag. Laudo Pericial ⏳'],
    });
    expect(regra(182).acoesTexto).toHaveLength(2);
    // "NÃO Contenha" não é origem.
    expect(regra(180).filtroContem).toEqual(['.Família (Proc. Comum)']);
  });

  it('origem "Todos", destino P e a descrição da ação manual', () => {
    expect(regra(312)).toMatchObject({
      tipoOrigem: 'todos',
      tipoControle: 'Por Ação Manual',
      descricao: '📝 Encaminhar para Minutar em Secretaria',
      destinos: ['📝 Minutar (Secretaria)'],
    });
    expect(regra(66).destinos).toEqual(['P']);
    expect(regra(66).filtrosTexto?.[0]).toMatch(/^Localizador \(Que Contenha ao Menos Um\): /);
  });
});
