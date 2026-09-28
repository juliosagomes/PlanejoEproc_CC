import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SETORES_VERSION, flagsPadrao, type SetoresUnidade } from '@/domain';
import { setEscopo } from './escopo';
import { SETORES_KEY_SUFIXO, clearSetores, loadSetores, saveSetores, setoresKey } from './setores';
import { BACKUP_KEY_PREFIX } from './storage';

function exemplo(): SetoresUnidade {
  return { version: SETORES_VERSION, itens: flagsPadrao() };
}

beforeEach(() => {
  localStorage.clear();
  setEscopo(null);
  vi.restoreAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('chave derivada do escopo', () => {
  it('modo local e lotação têm chaves distintas', () => {
    setEscopo({ tipo: 'local' });
    expect(setoresKey()).toBe(`planejoeproc:${SETORES_KEY_SUFIXO}`);

    setEscopo({ tipo: 'lotacao', workspaceId: 'ws-1' });
    expect(setoresKey()).toBe(`planejoeproc:lot:ws-1:${SETORES_KEY_SUFIXO}`);
  });

  it('sem sessão a chave é null', () => {
    expect(setoresKey()).toBeNull();
  });
});

describe('load/save', () => {
  it('devolve null quando nunca gravado', () => {
    setEscopo({ tipo: 'local' });
    expect(loadSetores()).toBeNull();
  });

  it('faz round-trip', () => {
    setEscopo({ tipo: 'local' });
    saveSetores(exemplo());
    expect(loadSetores()).toEqual(exemplo());
  });

  it('isola os silos: a lista da lotação não vaza para o modo local', () => {
    setEscopo({ tipo: 'lotacao', workspaceId: 'ws-1' });
    saveSetores(exemplo());

    setEscopo({ tipo: 'local' });
    expect(loadSetores()).toBeNull();

    setEscopo({ tipo: 'lotacao', workspaceId: 'ws-2' });
    expect(loadSetores()).toBeNull();
  });

  it('sem sessão, escrita é no-op e leitura é vazia', () => {
    saveSetores(exemplo());
    expect(loadSetores()).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it('clearSetores só apaga o silo corrente', () => {
    setEscopo({ tipo: 'lotacao', workspaceId: 'ws-1' });
    saveSetores(exemplo());
    setEscopo({ tipo: 'local' });
    saveSetores(exemplo());

    clearSetores();
    expect(loadSetores()).toBeNull();

    setEscopo({ tipo: 'lotacao', workspaceId: 'ws-1' });
    expect(loadSetores()).not.toBeNull();
  });
});

describe('dado irrecuperável', () => {
  it('JSON corrompido vai para backup e devolve null', () => {
    setEscopo({ tipo: 'local' });
    const key = setoresKey()!;
    localStorage.setItem(key, '{isto não é json');

    expect(loadSetores()).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
    const backup = Object.keys(localStorage).find((k) =>
      k.startsWith(`${BACKUP_KEY_PREFIX}setores:`),
    );
    expect(backup).toBeDefined();
    expect(localStorage.getItem(backup!)).toBe('{isto não é json');
  });

  it('shape irreconhecível também vai para backup', () => {
    setEscopo({ tipo: 'local' });
    const key = setoresKey()!;
    localStorage.setItem(key, JSON.stringify({ version: 99, itens: [] }));

    expect(loadSetores()).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
  });
});
