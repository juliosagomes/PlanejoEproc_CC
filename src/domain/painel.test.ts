import { describe, expect, it } from 'vitest';
import {
  contarCobertura,
  localizadoresDaUnidade,
  localizadoresDoSetor,
  painelVazio,
  situacaoNoSetor,
  type FilaTrabalho,
  type PainelUnidade,
} from './painel';
import type { Localizador } from './plano';

const no = (id: string, nome: string, flags: string[] = [], atalhoPara?: string): Localizador => ({
  id,
  position: { x: 0, y: 0 },
  data: { nome, ja_criado: false, flags, ...(atalhoPara ? { atalhoPara } : {}) },
});

const fila = (id: string, setorId: string, localizadores: string[]): FilaTrabalho => ({
  id,
  nome: id,
  origem: 'preferencia',
  setorId,
  localizadores,
  ja_criado: false,
});

describe('localizadoresDaUnidade', () => {
  it('junta os planos por nome, somando as marcações de setor', () => {
    const locs = localizadoresDaUnidade([
      { nodes: [no('a', 'Cumprir despacho', ['s1'])] },
      { nodes: [no('b', 'cumprir  DESPACHO', ['s2']), no('c', 'Aguardando prazo')] },
    ]);
    expect(locs.map((l) => l.nome)).toEqual(['Aguardando prazo', 'Cumprir despacho']);
    expect(locs[1]?.setores.sort()).toEqual(['s1', 's2']);
  });

  it('deixa de fora atalhos e nós sem nome', () => {
    const locs = localizadoresDaUnidade([
      { nodes: [no('a', 'Minutar'), no('x', '', [], 'a'), no('y', '   ')] },
    ]);
    expect(locs.map((l) => l.nome)).toEqual(['Minutar']);
  });
});

describe('cobertura', () => {
  const locs = localizadoresDaUnidade([
    {
      nodes: [
        no('1', 'Cumprir despacho', ['s1']),
        no('2', 'Expedir mandado', ['s1']),
        no('3', 'Aguardando devolução', ['s1']),
        no('4', 'Arquivo provisório', ['s1']),
        no('5', 'Suspensos'),
      ],
    },
  ]);
  const painel: PainelUnidade = {
    ...painelVazio(),
    filas: [fila('f1', 's1', ['cumprir despacho']), fila('f2', 's2', ['Aguardando devolução', 'Cumprir despacho'])],
    foraDasFilas: [{ nome: 'Arquivo provisório', motivo: 'Ninguém trabalha' }],
  };
  const doSetor = localizadoresDoSetor(locs, 's1', new Set(['s1', 's2']));
  const porNome = (nome: string) => doSetor.find((l) => l.nome === nome)!;

  it('casa a fila com o localizador sem olhar maiúsculas', () => {
    const s = situacaoNoSetor(porNome('Cumprir despacho'), 's1', painel);
    expect(s.tipo).toBe('coberto');
    if (s.tipo === 'coberto') {
      expect(s.filas.map((f) => f.id)).toEqual(['f1']);
      expect(s.outras.map((f) => f.id)).toEqual(['f2']);
    }
  });

  it('distingue o coberto só por fila de outro setor', () => {
    expect(situacaoNoSetor(porNome('Aguardando devolução'), 's1', painel).tipo).toBe('outroSetor');
  });

  it('fora de propósito vence mesmo com fila olhando', () => {
    const comFila = { ...painel, filas: [...painel.filas, fila('f3', 's1', ['Arquivo provisório'])] };
    expect(situacaoNoSetor(porNome('Arquivo provisório'), 's1', comFila)).toEqual({
      tipo: 'fora',
      motivo: 'Ninguém trabalha',
    });
  });

  it('conta cobertos, fora e descobertos', () => {
    expect(contarCobertura(doSetor, 's1', painel)).toEqual({
      total: 4,
      cobertos: 2,
      fora: 1,
      descobertos: 1,
    });
  });

  it('"sem setor" ignora marcações de setores que não existem mais', () => {
    const sem = localizadoresDoSetor(
      localizadoresDaUnidade([{ nodes: [no('a', 'Órfão', ['apagado']), no('b', 'Marcado', ['s1'])] }]),
      null,
      new Set(['s1']),
    );
    expect(sem.map((l) => l.nome)).toEqual(['Órfão']);
  });
});
