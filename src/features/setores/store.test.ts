import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SCHEMA_VERSION, type Localizador, type Plano } from '@/domain';
import { cancelPersist, useCanvasStore } from '@/features/canvas/store';
import {
  getAtivoId,
  importarPlano,
  listPlanos,
  loadPlano,
  loadSetores,
  setAtivo,
  setEscopo,
} from '@/infra/storage';
import { useSetoresStore } from './store';

function no(id: string, nome: string, flags: string[]): Localizador {
  return { id, position: { x: 0, y: 0 }, data: { nome, ja_criado: false, flags } };
}

function plano(nome: string, nodes: Localizador[]): Plano {
  return {
    version: SCHEMA_VERSION,
    planoNome: nome,
    flowMode: 'organic',
    flags: [],
    nodes,
    edges: [],
  };
}

beforeEach(() => {
  cancelPersist();
  localStorage.clear();
  setEscopo({ tipo: 'local' });
  useCanvasStore.setState({
    nodes: [],
    edges: [],
    selectedId: null,
    planoNome: 'Plano sem título',
    flowMode: 'organic',
    flags: [],
    filtroFlags: [],
    somenteLeitura: false,
  });
  vi.restoreAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('hidratar', () => {
  it('consolida o silo e espelha no canvas', () => {
    importarPlano(plano('Um', [no('n1', 'Minutar', [])]));

    useSetoresStore.getState().hidratar(false);

    const lista = useSetoresStore.getState().setores;
    expect(lista.map((f) => f.label)).toEqual(['Espera', 'Fixo de fluxo']);
    expect(useCanvasStore.getState().flags).toEqual(lista);
  });
});

describe('criar', () => {
  it('sugere sigla e cor, grava e espelha', () => {
    useSetoresStore.getState().hidratar(false);

    const id = useSetoresStore.getState().criar('  Setor de Cálculo  ');

    const criado = useSetoresStore.getState().setores.find((f) => f.id === id);
    expect(criado?.label).toBe('Setor de Cálculo');
    expect(criado?.code).toBe('SC');
    expect(loadSetores()?.itens.find((f) => f.id === id)).toEqual(criado);
    expect(useCanvasStore.getState().flags).toContainEqual(criado);
  });

  it('recusa rótulo em branco', () => {
    useSetoresStore.getState().hidratar(false);
    const antes = useSetoresStore.getState().setores.length;

    expect(useSetoresStore.getState().criar('   ')).toBe('');
    expect(useSetoresStore.getState().setores).toHaveLength(antes);
  });

  it('em visualização não cria nada', () => {
    useCanvasStore.getState().setSomenteLeitura(true);
    useSetoresStore.getState().hidratar(true);

    expect(useSetoresStore.getState().criar('Setor invasor')).toBe('');
    expect(loadSetores()).toBeNull();
  });
});

describe('atualizar', () => {
  it('renomear não desfaz marcação — o id não muda', () => {
    useSetoresStore.getState().hidratar(false);
    const id = useSetoresStore.getState().criar('Triagem');
    const n = useCanvasStore.getState().createNode({ x: 0, y: 0 });
    useCanvasStore.getState().toggleFlagNoNo(n, id);

    useSetoresStore.getState().atualizar(id, { label: 'Setor de Triagem', cor: 7 });

    const f = useSetoresStore.getState().setores.find((x) => x.id === id);
    expect(f?.label).toBe('Setor de Triagem');
    expect(f?.cor).toBe(7);
    expect(useCanvasStore.getState().nodes[0]?.data.flags).toEqual([id]);
  });
});

describe('remover', () => {
  it('limpa a marcação em TODOS os planos do silo, não só no aberto', () => {
    // Dois planos gravados, e o ativo é o segundo.
    const { id: idUm } = importarPlano(plano('Um', [no('n1', 'Minutar', ['f-x'])]));
    const { id: idDois } = importarPlano(plano('Dois', [no('n2', 'Conclusos', ['f-x'])]));
    setAtivo(idDois);
    useSetoresStore.getState().hidratar(false);
    // O plano ativo está aberto no canvas, como no app.
    useCanvasStore.getState().loadPlano(loadPlano(idDois));

    useSetoresStore.getState().remover('f-x');

    expect(getAtivoId()).toBe(idDois);
    expect(loadPlano(idUm).nodes[0]?.data.flags).toEqual([]);
    // O ativo é limpo no canvas — gravar por baixo dele perderia edição pendente.
    expect(useCanvasStore.getState().nodes[0]?.data.flags).toEqual([]);
    expect(useSetoresStore.getState().setores.some((f) => f.id === 'f-x')).toBe(false);
    expect(loadSetores()?.itens.some((f) => f.id === 'f-x')).toBe(false);
  });

  it('não reescreve plano que não usa o setor removido', () => {
    const { id: idUm } = importarPlano(plano('Um', [no('n1', 'Minutar', [])]));
    useSetoresStore.getState().hidratar(false);
    const antes = listPlanos().find((e) => e.id === idUm)?.atualizadoEm;

    useSetoresStore.getState().remover('flag-espera');

    expect(listPlanos().find((e) => e.id === idUm)?.atualizadoEm).toBe(antes);
  });

  it('em visualização não remove nada', () => {
    importarPlano(plano('Um', [no('n1', 'Minutar', ['flag-espera'])]));
    useSetoresStore.getState().hidratar(false);
    useCanvasStore.getState().setSomenteLeitura(true);

    useSetoresStore.getState().remover('flag-espera');

    expect(useSetoresStore.getState().setores.some((f) => f.id === 'flag-espera')).toBe(
      true,
    );
    const [um] = listPlanos();
    expect(loadPlano(um!.id).nodes[0]?.data.flags).toEqual(['flag-espera']);
  });
});
