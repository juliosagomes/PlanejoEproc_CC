import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  _resetEspelhoParaTeste,
  assinarMudancaExterna,
  chromeMirror,
  flushEspelho,
  hidratarEspelho,
} from './chromeMirror';
import { getStorage, setStorageBackend } from './storageLike';

/* ============================================================================
 * Stub do chrome.storage
 *
 * Reproduz só o que o espelho usa: `get(null)`, `set`, `remove` (todos
 * devolvendo Promise, como no MV3) e o par `onChanged.addListener` /
 * disparo manual. Os `vi.fn()` de `set`/`remove` são o que deixa a
 * coalescência observável — contamos chamadas, não chaves.
 * ========================================================================== */

interface AreaStub {
  dados: Map<string, unknown>;
  set: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
}

function criarArea(falhaNoSet?: Error): AreaStub {
  const dados = new Map<string, unknown>();
  return {
    dados,
    get: vi.fn(async () => Object.fromEntries(dados)),
    set: vi.fn(async (itens: Record<string, string>) => {
      if (falhaNoSet) throw falhaNoSet;
      for (const [k, v] of Object.entries(itens)) dados.set(k, v);
    }),
    remove: vi.fn(async (chaves: string[]) => {
      for (const k of chaves) dados.delete(k);
    }),
  };
}

type Ouvinte = (m: Record<string, chrome.storage.StorageChange>, area: string) => void;

let local: AreaStub;
let sync: AreaStub;
let ouvintesChrome: Ouvinte[];

function instalarChrome(opts: { syncFalha?: Error } = {}): void {
  local = criarArea();
  sync = criarArea(opts.syncFalha);
  ouvintesChrome = [];
  (globalThis as { chrome?: unknown }).chrome = {
    storage: {
      local,
      sync,
      onChanged: { addListener: (fn: Ouvinte) => ouvintesChrome.push(fn) },
    },
  };
}

/** Simula uma escrita vinda de fora (service worker, outra aba). */
function dispararOnChanged(
  mudancas: Record<string, chrome.storage.StorageChange>,
  area = 'local',
): void {
  for (const fn of ouvintesChrome) fn(mudancas, area);
}

/** As escritas são coalescidas por microtask; isto deixa a fila drenar. */
const proximaMicrotask = () => Promise.resolve();

beforeEach(() => {
  _resetEspelhoParaTeste();
  setStorageBackend(null);
  instalarChrome();
});

afterEach(() => {
  delete (globalThis as { chrome?: unknown }).chrome;
  setStorageBackend(null);
  _resetEspelhoParaTeste();
});

describe('hidratarEspelho', () => {
  it('carrega as duas áreas para leitura síncrona', async () => {
    local.dados.set('planejoeproc:plan:a', '{"x":1}');
    sync.dados.set('planejoeproc:lotacoes', '[]');

    await hidratarEspelho();

    expect(chromeMirror.getItem('planejoeproc:plan:a')).toBe('{"x":1}');
    expect(chromeMirror.getItem('planejoeproc:lotacoes')).toBe('[]');
    expect(chromeMirror.getItem('inexistente')).toBeNull();
  });

  it('ignora valores que não são string', async () => {
    local.dados.set('planejoeproc:lixo', { objeto: true });
    await hidratarEspelho();
    expect(chromeMirror.getItem('planejoeproc:lixo')).toBeNull();
  });

  it('a réplica do sync vence quando a chave existe nas duas áreas', async () => {
    local.dados.set('planejoeproc:lotacoes', '["antigo"]');
    sync.dados.set('planejoeproc:lotacoes', '["replicado"]');
    await hidratarEspelho();
    expect(chromeMirror.getItem('planejoeproc:lotacoes')).toBe('["replicado"]');
  });

  it('tolera chrome.storage.sync indisponível', async () => {
    sync.get.mockRejectedValueOnce(new Error('sem permissão'));
    local.dados.set('planejoeproc:plan:a', '{}');
    await expect(hidratarEspelho()).resolves.toBeUndefined();
    expect(chromeMirror.getItem('planejoeproc:plan:a')).toBe('{}');
  });
});

describe('escrita', () => {
  it('fica legível na hora, antes de o chrome.storage confirmar', async () => {
    await hidratarEspelho();
    chromeMirror.setItem('planejoeproc:plan:a', '{"n":1}');
    // Sem await nenhum: é exatamente o que `savePlano` faz.
    expect(chromeMirror.getItem('planejoeproc:plan:a')).toBe('{"n":1}');
  });

  it('coalesce uma rajada num único set por área', async () => {
    await hidratarEspelho();

    // O que um savePlano real toca: plano, índice e ativo.
    chromeMirror.setItem('planejoeproc:plan:a', '{}');
    chromeMirror.setItem('planejoeproc:plans:index', '[]');
    chromeMirror.setItem('planejoeproc:plans:active', 'a');
    await proximaMicrotask();

    expect(local.set).toHaveBeenCalledTimes(1);
    expect(local.set).toHaveBeenCalledWith({
      'planejoeproc:plan:a': '{}',
      'planejoeproc:plans:index': '[]',
      'planejoeproc:plans:active': 'a',
    });
  });

  it('roteia as chaves da allowlist para o sync e o resto para o local', async () => {
    await hidratarEspelho();

    chromeMirror.setItem('planejoeproc:lotacoes', '[{"nome":"Vara"}]');
    chromeMirror.setItem('planejoeproc:sync:prefs', '{"intervaloMin":15}');
    chromeMirror.setItem('planejoeproc:plan:a', '{}');
    await proximaMicrotask();

    expect(sync.set).toHaveBeenCalledWith({
      'planejoeproc:lotacoes': '[{"nome":"Vara"}]',
      'planejoeproc:sync:prefs': '{"intervaloMin":15}',
    });
    expect(local.set).toHaveBeenCalledWith({ 'planejoeproc:plan:a': '{}' });
  });

  it('removeItem some do espelho e vira remove no chrome.storage', async () => {
    local.dados.set('planejoeproc:plan:a', '{}');
    await hidratarEspelho();

    chromeMirror.removeItem('planejoeproc:plan:a');
    expect(chromeMirror.getItem('planejoeproc:plan:a')).toBeNull();

    await proximaMicrotask();
    expect(local.remove).toHaveBeenCalledWith(['planejoeproc:plan:a']);
  });

  it('flushEspelho despacha sem esperar a microtask (caso beforeunload)', async () => {
    await hidratarEspelho();
    chromeMirror.setItem('planejoeproc:plan:a', '{}');

    flushEspelho();

    expect(local.set).toHaveBeenCalledTimes(1);
  });

  it('cai para o local quando o sync recusa a escrita por cota', async () => {
    instalarChrome({ syncFalha: new Error('QUOTA_BYTES_PER_ITEM quota exceeded') });
    const avisos = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await hidratarEspelho();

    chromeMirror.setItem('planejoeproc:lotacoes', '["grande"]');
    await proximaMicrotask();
    await proximaMicrotask();

    expect(local.set).toHaveBeenCalledWith({ 'planejoeproc:lotacoes': '["grande"]' });
    expect(avisos).toHaveBeenCalled();
    // O dado continua legível: a réplica falhou, o armazenamento não.
    expect(chromeMirror.getItem('planejoeproc:lotacoes')).toBe('["grande"]');
    avisos.mockRestore();
  });
});

describe('mudança externa', () => {
  it('reconcilia o espelho e avisa os ouvintes', async () => {
    await hidratarEspelho();
    const visto: string[][] = [];
    assinarMudancaExterna((chaves) => visto.push(chaves));

    dispararOnChanged({
      'planejoeproc:plan:b': { newValue: '{"vindo":"do worker"}' },
    });

    expect(chromeMirror.getItem('planejoeproc:plan:b')).toBe('{"vindo":"do worker"}');
    expect(visto).toEqual([['planejoeproc:plan:b']]);
  });

  it('remoção externa apaga do espelho', async () => {
    local.dados.set('planejoeproc:plan:a', '{}');
    await hidratarEspelho();

    dispararOnChanged({ 'planejoeproc:plan:a': { oldValue: '{}' } });

    expect(chromeMirror.getItem('planejoeproc:plan:a')).toBeNull();
  });

  it('não avisa quando o eco é da nossa própria escrita', async () => {
    await hidratarEspelho();
    const visto: string[][] = [];
    assinarMudancaExterna((chaves) => visto.push(chaves));

    chromeMirror.setItem('planejoeproc:plan:a', '{}');
    await proximaMicrotask();
    // O Chrome dispara onChanged para o autor da escrita também.
    dispararOnChanged({ 'planejoeproc:plan:a': { newValue: '{}' } });

    expect(visto).toEqual([]);
  });

  it('assinarMudancaExterna devolve um cancelador', async () => {
    await hidratarEspelho();
    const visto: string[][] = [];
    const cancelar = assinarMudancaExterna((chaves) => visto.push(chaves));

    cancelar();
    dispararOnChanged({ 'planejoeproc:plan:b': { newValue: '{}' } });

    expect(visto).toEqual([]);
  });
});

describe('getStorage', () => {
  it('usa o localStorage quando ninguém injetou backend', () => {
    expect(getStorage()).toBe(localStorage);
  });

  it('usa o backend injetado quando há um', () => {
    setStorageBackend(chromeMirror);
    expect(getStorage()).toBe(chromeMirror);
  });
});
