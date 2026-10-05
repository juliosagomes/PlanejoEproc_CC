import { describe, expect, it } from 'vitest';
import { acharGemeos } from './gemeos';

const no = (id: string, nome: string) => ({ id, data: { nome } });

describe('acharGemeos', () => {
  it('agrupa nomes iguais ignorando emoji, acento e caixa', () => {
    const g = acharGemeos([
      no('a', '📝 Minutar'),
      no('b', 'MINUTAR'),
      no('c', 'Citação'),
      no('d', 'citacao'),
      no('e', 'Único'),
    ]);
    expect(g.grupos.size).toBe(2);
    expect(g.chaveDe.get('a')).toBe(g.chaveDe.get('b'));
    expect(g.chaveDe.get('c')).toBe(g.chaveDe.get('d'));
    expect(g.chaveDe.has('e')).toBe(false);
  });

  it('nó sem nome não é gêmeo de outro sem nome', () => {
    const g = acharGemeos([no('a', ''), no('b', '  '), no('c', '🔵')]);
    expect(g.grupos.size).toBe(0);
  });

  it('preserva a ordem dos ids dentro do grupo', () => {
    const g = acharGemeos([no('x', 'A'), no('y', 'b'), no('z', 'a')]);
    expect([...g.grupos.values()]).toEqual([['x', 'z']]);
  });
});
