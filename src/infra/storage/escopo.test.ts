import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  activeKey,
  comEscopo,
  getEscopo,
  getWorkspaceId,
  indexKey,
  isEscopoLocal,
  planKey,
  prefixo,
  setEscopo,
} from './escopo';
import { criarPlano, getAtivoId, listPlanos, loadPlano, planoVazio, savePlano } from './storage';

beforeEach(() => {
  localStorage.clear();
  setEscopo(null);
  vi.restoreAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('chaves derivadas do escopo', () => {
  it('modo local mantém as chaves históricas (planos já salvos continuam acessíveis)', () => {
    setEscopo({ tipo: 'local' });

    expect(prefixo()).toBe('planejoeproc:');
    expect(indexKey()).toBe('planejoeproc:plans:index');
    expect(activeKey()).toBe('planejoeproc:plans:active');
    expect(planKey('abc')).toBe('planejoeproc:plan:abc');
  });

  it('lotação usa um prefixo próprio por workspaceId', () => {
    setEscopo({ tipo: 'lotacao', workspaceId: 'ws-1' });

    expect(prefixo()).toBe('planejoeproc:lot:ws-1:');
    expect(indexKey()).toBe('planejoeproc:lot:ws-1:plans:index');
    expect(activeKey()).toBe('planejoeproc:lot:ws-1:plans:active');
    expect(planKey('abc')).toBe('planejoeproc:lot:ws-1:plan:abc');
  });

  it('sem sessão, toda chave é null', () => {
    expect(getEscopo()).toBeNull();
    expect(prefixo()).toBeNull();
    expect(indexKey()).toBeNull();
    expect(activeKey()).toBeNull();
    expect(planKey('abc')).toBeNull();
  });

  it('isEscopoLocal e getWorkspaceId refletem o escopo corrente', () => {
    expect(isEscopoLocal()).toBe(false);
    expect(getWorkspaceId()).toBeNull();

    setEscopo({ tipo: 'local' });
    expect(isEscopoLocal()).toBe(true);
    expect(getWorkspaceId()).toBeNull();

    setEscopo({ tipo: 'lotacao', workspaceId: 'ws-9' });
    expect(isEscopoLocal()).toBe(false);
    expect(getWorkspaceId()).toBe('ws-9');
  });
});

describe('sem sessão, o storage não lê nem escreve', () => {
  it('leituras devolvem vazio mesmo com planos gravados no silo local', () => {
    comEscopo({ tipo: 'local' }, () => criarPlano('Existe no local'));

    expect(listPlanos()).toEqual([]);
    expect(getAtivoId()).toBeNull();
    expect(loadPlano()).toEqual(planoVazio());
  });

  it('savePlano não grava nada — a tela de login não pode sobrescrever plano nenhum', () => {
    savePlano({ ...planoVazio(), planoNome: 'Não deve existir' });

    expect(localStorage.length).toBe(0);
  });

  it('criarPlano devolve o objeto mas não persiste', () => {
    const { id } = criarPlano('Fantasma');

    expect(id).toBeTruthy();
    expect(localStorage.length).toBe(0);
  });
});

describe('comEscopo', () => {
  it('roda no escopo pedido e restaura o anterior', () => {
    setEscopo({ tipo: 'local' });
    criarPlano('Plano local');

    const dentro = comEscopo({ tipo: 'lotacao', workspaceId: 'ws-1' }, () => {
      criarPlano('Plano da lotação');
      return listPlanos().map((p) => p.nome);
    });

    expect(dentro).toEqual(['Plano da lotação']);
    expect(getEscopo()).toEqual({ tipo: 'local' });
    expect(listPlanos().map((p) => p.nome)).toEqual(['Plano local']);
  });

  it('restaura o escopo mesmo se a função lançar', () => {
    setEscopo({ tipo: 'local' });

    expect(() =>
      comEscopo({ tipo: 'lotacao', workspaceId: 'ws-1' }, () => {
        throw new Error('falhou');
      }),
    ).toThrow('falhou');

    expect(getEscopo()).toEqual({ tipo: 'local' });
  });

  it('permite espiar o silo local sem sessão ativa', () => {
    comEscopo({ tipo: 'local' }, () => criarPlano('Rascunho'));

    expect(getEscopo()).toBeNull();
    expect(listPlanos()).toEqual([]);
    expect(comEscopo({ tipo: 'local' }, () => listPlanos()).map((p) => p.nome)).toEqual([
      'Rascunho',
    ]);
  });
});
