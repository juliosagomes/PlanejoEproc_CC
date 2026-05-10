import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CATALOGO_ORGAO_VERSION, type CatalogoOrgao } from '@/domain';
import {
  CATALOGO_KEY,
  clearCatalogoOrgao,
  loadCatalogoOrgao,
  saveCatalogoOrgao,
} from './catalogo';
import { BACKUP_KEY_PREFIX } from './storage';

function catalogoExemplo(): CatalogoOrgao {
  return {
    version: CATALOGO_ORGAO_VERSION,
    importadoEm: '2026-05-10T07:00:00.000Z',
    itens: [
      { id: 'lo-1', nome: '📝 Minutar (Secretaria)', descricao: 'Para minutas' },
      { id: 'lo-2', nome: '🔵 Conclusos' },
    ],
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
});

describe('loadCatalogoOrgao', () => {
  it('retorna null quando não há catálogo salvo', () => {
    expect(loadCatalogoOrgao()).toBeNull();
  });

  it('round-trip: salvar e carregar preserva estrutura', () => {
    const cat = catalogoExemplo();
    saveCatalogoOrgao(cat);
    expect(loadCatalogoOrgao()).toEqual(cat);
  });

  it('JSON inválido vai para backup e retorna null', () => {
    localStorage.setItem(CATALOGO_KEY, '{ não é json');
    expect(loadCatalogoOrgao()).toBeNull();
    expect(localStorage.getItem(CATALOGO_KEY)).toBeNull();
    const backup = `${BACKUP_KEY_PREFIX}orgao:${new Date().toISOString().slice(0, 10)}`;
    expect(localStorage.getItem(backup)).toBe('{ não é json');
  });

  it('shape inválido (sem version) vai para backup', () => {
    const lixo = JSON.stringify({ itens: [] });
    localStorage.setItem(CATALOGO_KEY, lixo);
    expect(loadCatalogoOrgao()).toBeNull();
    expect(localStorage.getItem(CATALOGO_KEY)).toBeNull();
  });

  it('versão futura é tratada como shape inválido', () => {
    const futuro = JSON.stringify({ ...catalogoExemplo(), version: 999 });
    localStorage.setItem(CATALOGO_KEY, futuro);
    expect(loadCatalogoOrgao()).toBeNull();
  });
});

describe('saveCatalogoOrgao', () => {
  it('sobrescreve catálogo anterior', () => {
    saveCatalogoOrgao(catalogoExemplo());
    const novo: CatalogoOrgao = {
      ...catalogoExemplo(),
      itens: [{ id: 'lo-99', nome: '⚙ Outro' }],
    };
    saveCatalogoOrgao(novo);
    expect(loadCatalogoOrgao()).toEqual(novo);
  });
});

describe('clearCatalogoOrgao', () => {
  it('remove o catálogo salvo', () => {
    saveCatalogoOrgao(catalogoExemplo());
    expect(loadCatalogoOrgao()).not.toBeNull();
    clearCatalogoOrgao();
    expect(loadCatalogoOrgao()).toBeNull();
    expect(localStorage.getItem(CATALOGO_KEY)).toBeNull();
  });

  it('é no-op quando nada está salvo', () => {
    expect(() => clearCatalogoOrgao()).not.toThrow();
  });
});
