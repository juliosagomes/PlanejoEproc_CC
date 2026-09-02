import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, type Localizador, type Plano } from '@/domain';
import {
  agruparPorPlano,
  contarUso,
  inventarioPorSetor,
  type PlanoDaUnidade,
} from './inventario';

function no(
  id: string,
  nome: string,
  flags: string[],
  extra: Partial<Localizador['data']> = {},
): Localizador {
  return {
    id,
    position: { x: 0, y: 0 },
    data: { nome, ja_criado: false, flags, ...extra },
  };
}

function planoDaUnidade(id: string, nome: string, nodes: Localizador[]): PlanoDaUnidade {
  const plano: Plano = {
    version: SCHEMA_VERSION,
    planoNome: nome,
    flowMode: 'organic',
    flags: [],
    nodes,
    edges: [],
  };
  return { id, nome, plano };
}

describe('inventarioPorSetor', () => {
  it('junta os localizadores de planos diferentes sob o mesmo setor', () => {
    const inv = inventarioPorSetor([
      planoDaUnidade('p1', 'Fluxo cível', [no('n1', 'Minutar', ['f-cal'])]),
      planoDaUnidade('p2', 'Fluxo criminal', [
        no('n2', 'Calcular custas', ['f-cal']),
        no('n3', 'Triar', ['f-tri']),
      ]),
    ]);

    expect(inv.get('f-cal')?.map((i) => i.nome)).toEqual(['Minutar', 'Calcular custas']);
    expect(inv.get('f-cal')?.map((i) => i.planoNome)).toEqual([
      'Fluxo cível',
      'Fluxo criminal',
    ]);
    expect(inv.get('f-tri')).toHaveLength(1);
  });

  it('um nó com dois setores entra nos dois', () => {
    const inv = inventarioPorSetor([
      planoDaUnidade('p1', 'Um', [no('n1', 'Minutar', ['f-cal', 'f-tri'])]),
    ]);

    expect(inv.get('f-cal')).toHaveLength(1);
    expect(inv.get('f-tri')).toHaveLength(1);
  });

  it('setor sem uso simplesmente não aparece', () => {
    const inv = inventarioPorSetor([planoDaUnidade('p1', 'Um', [no('n1', 'X', [])])]);
    expect(inv.has('f-cal')).toBe(false);
    expect(inv.size).toBe(0);
  });

  it('id repetido no mesmo nó não duplica a linha', () => {
    const inv = inventarioPorSetor([
      planoDaUnidade('p1', 'Um', [no('n1', 'Minutar', ['f-cal', 'f-cal'])]),
    ]);
    expect(inv.get('f-cal')).toHaveLength(1);
  });

  it('leva ja_criado e sistema para a tela', () => {
    const inv = inventarioPorSetor([
      planoDaUnidade('p1', 'Um', [
        no('n1', 'Conclusos', ['f-cal'], { ja_criado: true, sistema: true }),
      ]),
    ]);

    expect(inv.get('f-cal')?.[0]).toMatchObject({ jaCriado: true, sistema: true });
  });
});

describe('contarUso', () => {
  it('conta localizadores e planos distintos', () => {
    const inv = inventarioPorSetor([
      planoDaUnidade('p1', 'Um', [
        no('n1', 'A', ['f-cal']),
        no('n2', 'B', ['f-cal']),
      ]),
      planoDaUnidade('p2', 'Dois', [no('n3', 'C', ['f-cal'])]),
    ]);

    expect(contarUso(inv).get('f-cal')).toEqual({ localizadores: 3, planos: 2 });
  });
});

describe('agruparPorPlano', () => {
  it('agrupa preservando a ordem de primeira aparição', () => {
    const inv = inventarioPorSetor([
      planoDaUnidade('p1', 'Um', [no('n1', 'A', ['f-cal'])]),
      planoDaUnidade('p2', 'Dois', [no('n2', 'B', ['f-cal'])]),
      planoDaUnidade('p3', 'Três', [no('n3', 'C', ['f-tri'])]),
    ]);

    const grupos = agruparPorPlano(inv.get('f-cal') ?? []);
    expect(grupos.map((g) => g.planoNome)).toEqual(['Um', 'Dois']);
    expect(grupos[0]?.localizadores.map((l) => l.nome)).toEqual(['A']);
  });
});
