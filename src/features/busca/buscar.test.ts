import { describe, expect, it } from 'vitest';
import type { DefinicaoFlag } from '@/domain';
import {
  LIMITE_LOCALIZADORES_VAZIO,
  buscarNoQuadro,
  pontuar,
  semPrefixoFamilia,
  trechoCasado,
  type QuadroBusca,
} from './buscar';

const no = (id: string, nome: string, flags: string[] = [], extra: object = {}) => ({
  id,
  data: { nome, flags, ...extra },
});
const aresta = (id: string, source: string, target: string, resumo = '', recursos: string[] = []) => ({
  id,
  source,
  target,
  data: { kind: 'atp' as const, resumo, subitems: recursos.map((nome) => ({ nome })) },
});
const setor = (id: string, code: string, label: string): DefinicaoFlag => ({ id, code, label, cor: 1 });

function quadro(parcial: Partial<QuadroBusca>): QuadroBusca {
  return { nodes: [], edges: [], grupos: [], setores: [], ...parcial };
}

describe('semPrefixoFamilia', () => {
  it('tira o prefixo entre colchetes e o emoji do começo', () => {
    expect(semPrefixoFamilia('[CUMPRIMENTO] Ag. Réplica')).toBe('Ag. Réplica');
    expect(semPrefixoFamilia('📝 Minutar')).toBe('Minutar');
    expect(semPrefixoFamilia('Sem prefixo')).toBe('Sem prefixo');
  });
});

describe('pontuar', () => {
  it('ignora acento e caixa', () => {
    expect(pontuar('Ag. Réplica', 'REPLICA')).not.toBeNull();
  });
  it('começo do nome, sem o prefixo, vale mais que palavra, que vale mais que meio', () => {
    expect(pontuar('[FAM] Réplica com MP', 'replica')).toBe(0);
    expect(pontuar('Ag. Réplica', 'replica')).toBe(1);
    expect(pontuar('Contrarrazões', 'razoes')).toBe(2);
    expect(pontuar('Conclusos', 'replica')).toBeNull();
  });
});

describe('trechoCasado', () => {
  it('devolve o trecho do texto original, com acento', () => {
    const texto = 'Ag. Réplica';
    const t = trechoCasado(texto, 'replica');
    expect(t && texto.slice(t.inicio, t.fim)).toBe('Réplica');
  });
  it('funciona depois de emoji', () => {
    const texto = '📝 Minutar';
    const t = trechoCasado(texto, 'minu');
    expect(t && texto.slice(t.inicio, t.fim)).toBe('Minu');
  });
  it('nulo quando não casa ou a consulta é vazia', () => {
    expect(trechoCasado('Conclusos', 'mp')).toBeNull();
    expect(trechoCasado('Conclusos', '  ')).toBeNull();
  });
});

describe('buscarNoQuadro', () => {
  it('acha localizador sem acento e ordena pelo começo do nome', () => {
    const r = buscarNoQuadro(
      quadro({ nodes: [no('a', 'Decurso do prazo da réplica'), no('b', '[CUMPRIMENTO] Réplica')] }),
      'replica',
    );
    expect(r.localizadores.map((l) => l.id)).toEqual(['b', 'a']);
  });

  it('não lista atalhos nem nós sem nome', () => {
    const r = buscarNoQuadro(
      quadro({ nodes: [no('a', 'Conclusos'), no('b', '', [], { atalhoPara: 'a' }), no('c', '  ')] }),
      '',
    );
    expect(r.localizadores.map((l) => l.id)).toEqual(['a']);
  });

  it('conta entradas e saídas, e a seta que chega no atalho conta para o alvo', () => {
    const r = buscarNoQuadro(
      quadro({
        nodes: [no('a', 'Origem'), no('b', 'Conclusos'), no('b2', '', [], { atalhoPara: 'b' })],
        edges: [aresta('e1', 'a', 'b'), aresta('e2', 'a', 'b2'), aresta('e3', 'b', 'a')],
      }),
      'conclusos',
    );
    expect(r.localizadores[0]).toMatchObject({ id: 'b', entradas: 2, saidas: 1 });
  });

  it('setor casado traz os localizadores dele, depois dos achados pelo nome', () => {
    const r = buscarNoQuadro(
      quadro({
        nodes: [no('a', 'Minutar', ['s1']), no('b', 'Gabinete - revisar'), no('c', 'Outro')],
        setores: [setor('s1', 'GAB', 'Gabinete')],
      }),
      'gabinete',
    );
    expect(r.setores).toEqual([{ setor: setor('s1', 'GAB', 'Gabinete'), total: 1 }]);
    expect(r.localizadores.map((l) => l.id)).toEqual(['b', 'a']);
  });

  it('acha setor pela sigla exata', () => {
    const r = buscarNoQuadro(quadro({ setores: [setor('s1', 'SC', 'Setor de Cálculo')] }), 'sc');
    expect(r.setores).toHaveLength(1);
  });

  it('acha transição pelo resumo ou pelo nome do recurso', () => {
    const r = buscarNoQuadro(
      quadro({
        nodes: [no('a', 'A'), no('b', 'B')],
        edges: [aresta('e1', 'a', 'b', 'Réplica com MP'), aresta('e2', 'b', 'a', '', ['Intimar MP'])],
      }),
      'mp',
    );
    expect(r.transicoes.map((t) => [t.id, t.titulo, t.origem, t.destino])).toEqual([
      ['e2', 'Intimar MP', 'B', 'A'],
      ['e1', 'Réplica com MP', 'A', 'B'],
    ]);
  });

  it('diz qual recurso casou quando o termo não está no resumo', () => {
    const r = buscarNoQuadro(
      quadro({ nodes: [no('a', 'A'), no('b', 'B')], edges: [aresta('e1', 'a', 'b', 'MP intervém', ['Ag. Réplica'])] }),
      'replica',
    );
    expect(r.transicoes[0]?.recursoCasado).toBe('Ag. Réplica');
  });

  it('sem consulta, poucos localizadores e nenhuma transição', () => {
    const nodes = Array.from({ length: 10 }, (_, i) => no(`n${i}`, `Loc ${i}`));
    const r = buscarNoQuadro(quadro({ nodes, edges: [aresta('e', 'n0', 'n1', 'x')] }), '');
    expect(r.localizadores).toHaveLength(LIMITE_LOCALIZADORES_VAZIO);
    expect(r.transicoes).toEqual([]);
    expect(r.setores).toEqual([]);
  });

  it('marca o grupo recolhido que esconde o localizador', () => {
    const r = buscarNoQuadro(
      quadro({
        nodes: [no('a', 'Conclusos')],
        grupos: [{ id: 'g', rotulo: 'Gabinete', membros: ['a'], recolhido: true }],
      }),
      'conc',
    );
    expect(r.localizadores[0]?.grupoRecolhido).toEqual({ id: 'g', rotulo: 'Gabinete' });
  });
});
