import { describe, expect, it } from 'vitest';
import {
  alvoReal,
  atalhosPara,
  ehAtalho,
  mesmaRefOutroPlano,
  noEfetivo,
  nomeEfetivo,
  resolverOutroPlano,
  rotuloOutroPlano,
  type RefOutroPlano,
} from './atalhos';

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

describe('atalho para outro plano (D-40)', () => {
  const ref: RefOutroPlano = { planoId: 'pB', noId: 'x1', planoNome: 'Execuções', nome: 'Ag. Prazo' };
  const externo = { id: 'e', data: { nome: '', atalhoOutroPlano: ref } };
  const planoB = (id: string, planoNome: string, nos: ReturnType<typeof no>[]) => ({ id, plano: { planoNome, nodes: nos } });

  it('é atalho, sem nó efetivo aqui, e tem o nome da referência', () => {
    expect(ehAtalho(externo)).toBe(true);
    expect(noEfetivo([externo], 'e')).toBeUndefined();
    expect(alvoReal([externo], 'e')).toBeUndefined();
    expect(nomeEfetivo([externo], 'e')).toBe('Ag. Prazo');
    expect(rotuloOutroPlano(ref)).toBe('Ag. Prazo (plano "Execuções")');
  });

  it('acha o destino pelos ids, e acompanha o nome novo', () => {
    const r = resolverOutroPlano(ref, [planoB('pB', 'Execuções 2', [no('x1', 'Aguardando prazo')])]);
    expect(r).toEqual({ planoId: 'pB', noId: 'x1', planoNome: 'Execuções 2', nome: 'Aguardando prazo' });
    expect(mesmaRefOutroPlano(ref, r!)).toBe(false);
  });

  it('com o id do plano trocado (plano importado), acha pelos nomes de reserva', () => {
    const r = resolverOutroPlano(ref, [planoB('outro', 'Família', [no('x1', 'Ag. Prazo')]), planoB('pB2', 'Execuções', [no('y9', 'Ag. Prazo')])]);
    expect(r).toEqual({ planoId: 'pB2', noId: 'y9', planoNome: 'Execuções', nome: 'Ag. Prazo' });
  });

  it('no plano certo, o nó recriado é achado pelo nome', () => {
    expect(resolverOutroPlano(ref, [planoB('pB', 'Execuções', [no('z', 'Ag. Prazo')])])?.noId).toBe('z');
  });

  it('nunca aponta para um atalho de lá', () => {
    const r = resolverOutroPlano(ref, [planoB('pB', 'Execuções', [no('x1', '', 'z'), no('z', 'Outro')])]);
    expect(r).toBeNull();
  });

  it('destino sumido, ou referência vazia, fica órfão', () => {
    expect(resolverOutroPlano(ref, [])).toBeNull();
    expect(resolverOutroPlano({ planoId: '', noId: '', planoNome: '', nome: '' }, [planoB('pB', 'Execuções', [no('x1', 'A')])])).toBeNull();
  });
});
