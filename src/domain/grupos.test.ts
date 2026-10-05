import { describe, expect, it } from 'vitest';
import { grupoQueContem, molduraEnvolvendo, reagruparSoltos, type GrupoLocalizadores } from './grupos';

const grupo = (id: string, x: number, y: number, l: number, a: number, membros: string[] = [], recolhido = false): GrupoLocalizadores => ({
  id,
  rotulo: id,
  cor: 1,
  position: { x, y },
  largura: l,
  altura: a,
  membros,
  ...(recolhido ? { recolhido } : {}),
});

describe('molduraEnvolvendo', () => {
  it('envolve com folga e espaço para o rótulo no topo', () => {
    expect(
      molduraEnvolvendo([
        { x: 100, y: 100, largura: 180, altura: 60 },
        { x: 400, y: 200, largura: 180, altura: 60 },
      ]),
    ).toEqual({ x: 80, y: 60, largura: 520, altura: 220 });
    expect(molduraEnvolvendo([])).toBeNull();
  });
});

describe('grupoQueContem', () => {
  const grande = grupo('g', 0, 0, 1000, 1000);
  const pequeno = grupo('p', 100, 100, 300, 300);

  it('decide pelo centro e prefere a menor moldura', () => {
    expect(grupoQueContem([grande, pequeno], { x: 150, y: 150, largura: 100, altura: 50 })?.id).toBe('p');
    expect(grupoQueContem([grande, pequeno], { x: 700, y: 700, largura: 100, altura: 50 })?.id).toBe('g');
    expect(grupoQueContem([grande, pequeno], { x: 2000, y: 0, largura: 10, altura: 10 })).toBeUndefined();
  });

  it('grupo recolhido não recebe ninguém', () => {
    const r = grupo('r', 0, 0, 1000, 1000, [], true);
    expect(grupoQueContem([r], { x: 10, y: 10, largura: 10, altura: 10 })).toBeUndefined();
  });
});

describe('reagruparSoltos', () => {
  it('entra, troca e sai de grupo conforme onde o nó foi solto', () => {
    const a = grupo('a', 0, 0, 500, 500, ['n1', 'n2']);
    const b = grupo('b', 1000, 0, 500, 500);
    const r = reagruparSoltos([a, b], [
      { id: 'n1', x: 1100, y: 100, largura: 100, altura: 50 },
      { id: 'n2', x: 3000, y: 100, largura: 100, altura: 50 },
      { id: 'n3', x: 100, y: 100, largura: 100, altura: 50 },
    ]);
    expect(r.find((g) => g.id === 'a')?.membros).toEqual(['n3']);
    expect(r.find((g) => g.id === 'b')?.membros).toEqual(['n1']);
  });

  it('não mexe em membro de grupo recolhido', () => {
    const a = grupo('a', 0, 0, 500, 500, ['n1'], true);
    const r = reagruparSoltos([a], [{ id: 'n1', x: 3000, y: 0, largura: 10, altura: 10 }]);
    expect(r[0]?.membros).toEqual(['n1']);
  });

  it('preserva a identidade do grupo que não mudou', () => {
    const a = grupo('a', 0, 0, 500, 500, ['n1']);
    const r = reagruparSoltos([a], [{ id: 'n1', x: 10, y: 10, largura: 10, altura: 10 }]);
    expect(r[0]).toBe(a);
  });
});
