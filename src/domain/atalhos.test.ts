import { describe, expect, it } from 'vitest';
import { alvoReal, atalhosPara, ehAtalho, noEfetivo, nomeEfetivo } from './atalhos';

const no = (id: string, nome: string, atalhoPara?: string) => ({
  id,
  data: { nome, ...(atalhoPara ? { atalhoPara } : {}) },
});

const nodes = [no('a', 'Aguardando prazo'), no('s1', '', 'a'), no('s2', '', 'a'), no('o', '', 'sumiu'), no('b', 'Minutar')];

describe('atalhos', () => {
  it('reconhece atalho pelo campo, não pelo nome vazio', () => {
    expect(ehAtalho(no('x', ''))).toBe(false);
    expect(ehAtalho(nodes[1]!)).toBe(true);
  });

  it('o nó efetivo do atalho é o alvo; o de um localizador, ele mesmo', () => {
    expect(noEfetivo(nodes, 's1')?.id).toBe('a');
    expect(noEfetivo(nodes, 'b')?.id).toBe('b');
    expect(nomeEfetivo(nodes, 's2')).toBe('Aguardando prazo');
  });

  it('atalho órfão não tem nó efetivo nem nome', () => {
    expect(noEfetivo(nodes, 'o')).toBeUndefined();
    expect(nomeEfetivo(nodes, 'o')).toBe('');
  });

  it('atalho para atalho resolve para o alvo de verdade na criação', () => {
    expect(alvoReal(nodes, 's1')).toBe('a');
    expect(alvoReal(nodes, 'b')).toBe('b');
    expect(alvoReal(nodes, 'o')).toBeUndefined();
  });

  it('lista os atalhos de um alvo', () => {
    expect(atalhosPara(nodes, 'a')).toEqual(['s1', 's2']);
  });
});
