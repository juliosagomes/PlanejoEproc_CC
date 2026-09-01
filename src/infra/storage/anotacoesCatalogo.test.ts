import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ANOTACOES_CATALOGO_VERSION, type AnotacoesCatalogo } from '@/domain';
import {
  ANOTACOES_KEY,
  clearAnotacoesCatalogo,
  loadAnotacoesCatalogo,
  saveAnotacoesCatalogo,
} from './anotacoesCatalogo';
import { CATALOGO_KEY, saveCatalogoOrgao } from './catalogo';
import { BACKUP_KEY_PREFIX } from './storage';

function anotacoesExemplo(): AnotacoesCatalogo {
  return {
    version: ANOTACOES_CATALOGO_VERSION,
    itens: {
      'Localizador|MINUTAR SECRETARIA': {
        descricao: 'Fila do minutador',
        orientacoes: 'Só entra processo com evento de citação positiva.',
        atualizadoEm: '2026-08-31T12:00:00.000Z',
      },
      'Modelo|DESPACHO PADRÃO': {
        orientacoes: 'Trocar o parágrafo 3 quando for execução fiscal.',
        atualizadoEm: '2026-08-31T12:05:00.000Z',
      },
    },
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('anotações do catálogo', () => {
  it('sem nada salvo devolve o objeto vazio, não null', () => {
    expect(loadAnotacoesCatalogo()).toEqual({
      version: ANOTACOES_CATALOGO_VERSION,
      itens: {},
    });
  });

  it('round-trip preserva as anotações', () => {
    const a = anotacoesExemplo();
    saveAnotacoesCatalogo(a);
    expect(loadAnotacoesCatalogo()).toEqual(a);
  });

  it('JSON corrompido vai para backup e a leitura devolve vazio', () => {
    localStorage.setItem(ANOTACOES_KEY, '{ nao é json');

    expect(loadAnotacoesCatalogo().itens).toEqual({});
    expect(localStorage.getItem(ANOTACOES_KEY)).toBeNull();
    const backups = Object.keys(localStorage).filter((k) =>
      k.startsWith(`${BACKUP_KEY_PREFIX}anotacoes:`),
    );
    expect(backups).toHaveLength(1);
  });

  it('shape irreconhecível também vai para backup', () => {
    localStorage.setItem(ANOTACOES_KEY, JSON.stringify({ version: 99, itens: {} }));
    expect(loadAnotacoesCatalogo().itens).toEqual({});
    expect(localStorage.getItem(ANOTACOES_KEY)).toBeNull();
  });

  it('limpar remove só as anotações', () => {
    saveAnotacoesCatalogo(anotacoesExemplo());
    saveCatalogoOrgao({ version: 1, importadoEm: '2026-08-31', itens: [] });

    clearAnotacoesCatalogo();

    expect(loadAnotacoesCatalogo().itens).toEqual({});
    expect(localStorage.getItem(CATALOGO_KEY)).not.toBeNull();
  });

  it('reimportar o catálogo não encosta nas anotações — é para isso que a chave é separada', () => {
    saveAnotacoesCatalogo(anotacoesExemplo());

    saveCatalogoOrgao({
      version: 1,
      importadoEm: '2026-09-01',
      itens: [{ id: 'lo-1', nome: 'Outro localizador' }],
    });

    expect(loadAnotacoesCatalogo()).toEqual(anotacoesExemplo());
  });
});
