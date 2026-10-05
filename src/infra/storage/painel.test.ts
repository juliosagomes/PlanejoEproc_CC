import { beforeEach, describe, expect, it, vi } from 'vitest';
import { painelVazio, type PainelUnidade } from '@/domain';
import { setEscopo } from './escopo';
import { loadPainel, painelKey, savePainel } from './painel';
import { BACKUP_KEY_PREFIX } from './storage';

function exemplo(): PainelUnidade {
  return {
    ...painelVazio(),
    filas: [
      {
        id: 'f1',
        nome: 'CUMPRIMENTO - Expedições',
        origem: 'relatorioGeral',
        setorId: 's1',
        localizadores: ['Expedir mandado'],
        ja_criado: true,
      },
      {
        id: 'f2',
        nome: 'TRIAGEM - Entradas',
        origem: 'preferencia',
        setorId: 's2',
        grupoId: 'g1',
        localizadores: [],
        ja_criado: false,
      },
    ],
    grupos: [{ id: 'g1', nome: 'Filas da Secretaria' }],
    foraDasFilas: [{ nome: 'Arquivo provisório', motivo: 'Ninguém trabalha' }],
  };
}

beforeEach(() => {
  localStorage.clear();
  setEscopo(null);
  vi.restoreAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('painel da unidade', () => {
  it('a chave segue o silo', () => {
    expect(painelKey()).toBeNull();
    setEscopo({ tipo: 'local' });
    expect(painelKey()).toBe('planejoeproc:painel');
    setEscopo({ tipo: 'lotacao', workspaceId: 'ws-1' });
    expect(painelKey()).toBe('planejoeproc:lot:ws-1:painel');
  });

  it('faz round-trip, e cada silo tem o seu', () => {
    setEscopo({ tipo: 'local' });
    expect(loadPainel()).toBeNull();
    savePainel(exemplo());
    expect(loadPainel()).toEqual(exemplo());

    setEscopo({ tipo: 'lotacao', workspaceId: 'ws-1' });
    expect(loadPainel()).toBeNull();
  });

  it('sem sessão não grava nada', () => {
    savePainel(exemplo());
    expect(localStorage.length).toBe(0);
  });

  it('valor irreconhecível vai para o backup em vez de sumir', () => {
    setEscopo({ tipo: 'local' });
    localStorage.setItem('planejoeproc:painel', JSON.stringify({ version: 99 }));
    expect(loadPainel()).toBeNull();
    expect(localStorage.getItem('planejoeproc:painel')).toBeNull();
    const backup = Object.keys(localStorage).find((k) => k.startsWith(`${BACKUP_KEY_PREFIX}painel:`));
    expect(backup).toBeDefined();
  });
});
