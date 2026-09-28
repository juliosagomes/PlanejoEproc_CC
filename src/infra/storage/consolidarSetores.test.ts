import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SCHEMA_VERSION,
  flagsPadrao,
  normalizarRotulo,
  type DefinicaoFlag,
  type Localizador,
  type Plano,
} from '@/domain';
import { consolidarSetores } from './consolidarSetores';
import { setEscopo } from './escopo';
import { loadSetores } from './setores';
import { importarPlano, listPlanos, loadPlano } from './storage';

function no(id: string, nome: string, flags: string[]): Localizador {
  return {
    id,
    position: { x: 0, y: 0 },
    data: { nome, ja_criado: false, flags },
  };
}

function plano(nome: string, flags: DefinicaoFlag[], nodes: Localizador[]): Plano {
  return {
    version: SCHEMA_VERSION,
    planoNome: nome,
    flowMode: 'organic',
    flags,
    nodes,
    edges: [],
  };
}

/** O `getStorage()` sonda o localStorage a cada chamada; a sonda não é gravação. */
function gravacoesReais(spy: { mock: { calls: unknown[][] } }): unknown[][] {
  return spy.mock.calls.filter(([key]) => !String(key).startsWith('__planejoeproc'));
}

/** Quantas entradas da lista são o "Setor de Cálculo", escrito como for. */
function calculos(lista: readonly { label: string }[]): unknown[] {
  return lista.filter((f) => normalizarRotulo(f.label) === 'setor de calculo');
}

const calculoA: DefinicaoFlag = { id: 'f-a', code: 'SC', label: 'Setor de Cálculo', cor: 3 };
const calculoB: DefinicaoFlag = { id: 'f-b', code: 'SC', label: 'SETOR DE CALCULO', cor: 6 };
const triagem: DefinicaoFlag = { id: 'f-t', code: 'TR', label: 'Triagem', cor: 6 };

beforeEach(() => {
  localStorage.clear();
  setEscopo({ tipo: 'local' });
  vi.restoreAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('consolidarSetores', () => {
  it('funde o mesmo setor de dois planos numa entrada só e remapeia os nós', () => {
    importarPlano(plano('Um', [calculoA], [no('n1', 'Minutar', ['f-a'])]));
    importarPlano(plano('Dois', [calculoB], [no('n2', 'Conclusos', ['f-b'])]));

    const lista = consolidarSetores({ somenteLeitura: false });

    expect(calculos(lista)).toHaveLength(1);
    expect(lista.find((f) => normalizarRotulo(f.label) === 'setor de calculo')?.id).toBe(
      'f-a',
    );

    const [um, dois] = listPlanos();
    expect(loadPlano(um!.id).nodes[0]?.data.flags).toEqual(['f-a']);
    expect(loadPlano(dois!.id).nodes[0]?.data.flags).toEqual(['f-a']);
  });

  it('grava a lista da unidade e o retrato em cada plano', () => {
    importarPlano(plano('Um', [calculoA], [no('n1', 'Minutar', ['f-a'])]));
    importarPlano(plano('Dois', [triagem], [no('n2', 'Conclusos', ['f-t'])]));

    const lista = consolidarSetores({ somenteLeitura: false });

    expect(loadSetores()?.itens).toEqual(lista);
    for (const e of listPlanos()) {
      expect(loadPlano(e.id).flags).toEqual(lista);
    }
  });

  it('parte dos padrões quando não há nada gravado nem nos planos', () => {
    expect(consolidarSetores({ somenteLeitura: false })).toEqual(flagsPadrao());
    expect(loadSetores()?.itens).toEqual(flagsPadrao());
  });

  it('é idempotente: a segunda chamada não reescreve plano nenhum', () => {
    importarPlano(plano('Um', [calculoA], [no('n1', 'Minutar', ['f-a'])]));
    importarPlano(plano('Dois', [calculoB], [no('n2', 'Conclusos', ['f-b'])]));
    consolidarSetores({ somenteLeitura: false });

    const antes = listPlanos().map((e) => e.atualizadoEm);
    const spy = vi.spyOn(Storage.prototype, 'setItem');

    const lista = consolidarSetores({ somenteLeitura: false });

    expect(gravacoesReais(spy)).toEqual([]);
    expect(listPlanos().map((e) => e.atualizadoEm)).toEqual(antes);
    expect(calculos(lista)).toHaveLength(1);
  });

  it('absorve o setor de um plano que chegou depois', () => {
    importarPlano(plano('Um', [calculoA], [no('n1', 'Minutar', ['f-a'])]));
    consolidarSetores({ somenteLeitura: false });

    importarPlano(plano('De fora', [triagem], [no('n9', 'Triar', ['f-t'])]));
    const lista = consolidarSetores({ somenteLeitura: false });

    expect(lista.map((f) => f.id)).toContain('f-t');
    expect(loadSetores()?.itens.map((f) => f.id)).toContain('f-t');
  });

  it('em visualização calcula sem gravar nada', () => {
    importarPlano(plano('Um', [calculoA], [no('n1', 'Minutar', ['f-a'])]));
    importarPlano(plano('Dois', [calculoB], [no('n2', 'Conclusos', ['f-b'])]));

    const spy = vi.spyOn(Storage.prototype, 'setItem');
    const lista = consolidarSetores({ somenteLeitura: true });

    expect(calculos(lista)).toHaveLength(1);
    expect(gravacoesReais(spy)).toEqual([]);
    expect(loadSetores()).toBeNull();
    const [, dois] = listPlanos();
    expect(loadPlano(dois!.id).nodes[0]?.data.flags).toEqual(['f-b']);
  });

  it('colapsa num chip só o nó marcado com os dois ids que viraram um', () => {
    importarPlano(plano('Um', [calculoA, calculoB], [no('n1', 'Minutar', ['f-a', 'f-b'])]));

    consolidarSetores({ somenteLeitura: false });

    const [um] = listPlanos();
    expect(loadPlano(um!.id).nodes[0]?.data.flags).toEqual(['f-a']);
  });
});
