import { beforeEach, describe, expect, it } from 'vitest';
import { getOrdemPlanos, setOrdemPlanos, type PlanIndexEntry } from '@/infra/storage';
import { ordenarPlanos } from './ordenarPlanos';

const p = (nome: string, atualizadoEm: string): PlanIndexEntry => ({
  id: nome + atualizadoEm,
  nome,
  atualizadoEm,
});

const planos = [
  p('Plano 10', '2026-10-01'),
  p('Égua', '2026-10-03'),
  p('plano 2', '2026-09-01'),
  p('Arquivo', '2026-08-01'),
  p('Faturas', '2026-10-02'),
];

describe('ordenarPlanos', () => {
  it('recentes: mais novo primeiro', () => {
    expect(ordenarPlanos(planos, 'recentes').map((x) => x.nome)).toEqual([
      'Égua',
      'Faturas',
      'Plano 10',
      'plano 2',
      'Arquivo',
    ]);
  });

  it('alfabética: ignora acento e caixa, e compara números como números', () => {
    expect(ordenarPlanos(planos, 'alfabetica').map((x) => x.nome)).toEqual([
      'Arquivo',
      'Égua',
      'Faturas',
      'plano 2',
      'Plano 10',
    ]);
  });

  it('nomes iguais desempatam pelo mais recente', () => {
    const iguais = [p('Sem título', '2026-01-01'), p('Sem título', '2026-05-01')];
    expect(ordenarPlanos(iguais, 'alfabetica').map((x) => x.atualizadoEm)).toEqual([
      '2026-05-01',
      '2026-01-01',
    ]);
  });

  it('não muta a lista recebida', () => {
    const copia = [...planos];
    ordenarPlanos(planos, 'alfabetica');
    expect(planos).toEqual(copia);
  });
});

describe('preferência da ordem', () => {
  beforeEach(() => localStorage.clear());

  it('nasce em "recentes" e lembra a escolha', () => {
    expect(getOrdemPlanos()).toBe('recentes');
    setOrdemPlanos('alfabetica');
    expect(getOrdemPlanos()).toBe('alfabetica');
  });

  it('valor irreconhecível volta para "recentes"', () => {
    localStorage.setItem('planejoeproc:ui:ordemPlanos', '"aleatoria"');
    expect(getOrdemPlanos()).toBe('recentes');
  });
});
