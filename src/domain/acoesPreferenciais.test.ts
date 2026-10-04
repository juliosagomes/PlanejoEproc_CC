import { describe, expect, it } from 'vitest';
import {
  atpsManuaisSaindo,
  canonPreferencia,
  linhasAcoesPreferenciais,
} from './acoesPreferenciais';
import type { EdgeData } from './edges';
import type { Subitem } from './subitems';

const regra = (id: string, tipo: 'M' | 'E', nome = '', descricao?: string): Subitem => ({
  id,
  categoria: 'Regra de ATP',
  nome,
  ja_criado: false,
  atp: {
    implantar: false,
    trigger: tipo === 'M' ? { tipo: 'M', ...(descricao ? { descricao } : {}) } : { tipo: 'E' },
  },
});

const aresta = (id: string, source: string, target: string, subitems: Subitem[]) => ({
  id,
  source,
  target,
  data: { kind: 'atp', resumo: '', observacao: '', subitems } satisfies EdgeData,
});

describe('atpsManuaisSaindo', () => {
  it('pega só regras "Por Ação Manual" das arestas que saem do nó', () => {
    const edges = [
      aresta('e1', 'a', 'b', [regra('s1', 'M', 'Remeter à contadoria'), regra('s2', 'E', 'Por evento')]),
      aresta('e2', 'c', 'a', [regra('s3', 'M', 'Entra em A — não conta')]),
      aresta('e3', 'a', 'd', [regra('s4', 'M', '', 'Expedir precatória')]),
    ];
    expect(atpsManuaisSaindo('a', edges)).toEqual([
      { edgeId: 'e1', subitemId: 's1', nome: 'Remeter à contadoria', destinoId: 'b', ja_criado: false },
      { edgeId: 'e3', subitemId: 's4', nome: 'Expedir precatória', destinoId: 'd', ja_criado: false },
    ]);
  });

  it('recurso de outra categoria com detalhamento de ATP não conta', () => {
    const s = { ...regra('s1', 'M', 'x'), categoria: 'Preferência' as const };
    expect(atpsManuaisSaindo('a', [aresta('e1', 'a', 'b', [s])])).toEqual([]);
  });
});

describe('linhasAcoesPreferenciais', () => {
  const planejada = (nome: string) => ({ id: nome, nome, ja_criado: false });

  it('planejada com mesmo nome de uma do Eproc aparece uma vez só', () => {
    const linhas = linhasAcoesPreferenciais(
      ['Despacho — cite-se', 'Ofício INSS'],
      [planejada('despacho —  CITE-SE'), planejada('Nova')],
      [],
    );
    expect(linhas.map((l) => l.origem)).toEqual(['eproc', 'planejada', 'planejada']);
    expect(linhas[1]).toMatchObject({ origem: 'planejada', tambemNoEproc: true });
    expect(linhas[2]).toMatchObject({ origem: 'planejada', tambemNoEproc: false });
  });

  it('canon só normaliza caixa e espaço', () => {
    expect(canonPreferencia('  Ofício  - INSS ')).toBe('OFÍCIO - INSS');
    expect(canonPreferencia('Ofício INSS')).not.toBe(canonPreferencia('Ofício - INSS'));
  });
});
