import { beforeEach, describe, expect, it } from 'vitest';
import { loadCamera, saveCamera, esquecerCamera } from './cameras';
import { setEscopo } from './escopo';
import { criarPlano, excluirPlano, excluirTodosPlanos } from './storage';

beforeEach(() => {
  localStorage.clear();
  setEscopo({ tipo: 'local' });
});

describe('câmera por plano', () => {
  it('guarda e devolve a câmera de cada plano separadamente', () => {
    saveCamera('a', { x: 10, y: 20, zoom: 1.2 });
    saveCamera('b', { x: -5, y: 0, zoom: 0.6 });
    expect(loadCamera('a')).toEqual({ x: 10, y: 20, zoom: 1.2 });
    expect(loadCamera('b')).toEqual({ x: -5, y: 0, zoom: 0.6 });
    expect(loadCamera('c')).toBeNull();
  });

  it('é separada por silo', () => {
    saveCamera('a', { x: 1, y: 1, zoom: 1 });
    setEscopo({ tipo: 'lotacao', workspaceId: 'ws1' });
    expect(loadCamera('a')).toBeNull();
  });

  it('fora de sessão não lê nem grava', () => {
    setEscopo(null);
    saveCamera('a', { x: 1, y: 1, zoom: 1 });
    expect(loadCamera('a')).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it('valor corrompido vira "sem câmera", não erro', () => {
    localStorage.setItem('planejoeproc:cameras', '{"a":{"x":"oi"}}');
    expect(loadCamera('a')).toBeNull();
  });

  it('esquecer a última câmera apaga a chave', () => {
    saveCamera('a', { x: 1, y: 1, zoom: 1 });
    esquecerCamera('a');
    expect(localStorage.getItem('planejoeproc:cameras')).toBeNull();
  });

  it('excluir o plano leva a câmera junto', () => {
    const { id } = criarPlano();
    saveCamera(id, { x: 1, y: 1, zoom: 1 });
    excluirPlano(id);
    expect(loadCamera(id)).toBeNull();
  });

  it('apagar todos os planos limpa as câmeras do silo', () => {
    const { id } = criarPlano();
    saveCamera(id, { x: 1, y: 1, zoom: 1 });
    excluirTodosPlanos();
    expect(localStorage.getItem('planejoeproc:cameras')).toBeNull();
  });
});
