import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SCHEMA_VERSION, type Plano } from '@/domain';
import {
  BACKUP_KEY_PREFIX,
  STORAGE_KEY,
  criarSavePlanoDebounced,
  loadPlano,
  planoVazio,
  savePlano,
} from './storage';

function planoExemplo(): Plano {
  return {
    version: SCHEMA_VERSION,
    planoNome: 'Plano de teste',
    flowMode: 'organic',
    nodes: [
      {
        id: 'n-1',
        position: { x: 100, y: 200 },
        data: {
          nome: 'Aguardando despacho',
          descricao: 'fila de processos prontos para o juiz',
          ja_criado: false,
          flags: { espera: true },
        },
      },
    ],
    edges: [
      {
        id: 'e-1',
        source: 'n-1',
        target: 'n-1',
        data: {
          kind: 'atp',
          resumo: 'autoavanço',
          observacao: '',
          subitems: [
            { id: 'si-1', categoria: 'Modelo', nome: 'minuta', ja_criado: false },
          ],
          atp: {
            implantar: true,
            ja_criado: false,
            nome: 'ATP de teste',
            trigger: { tipo: 'L', diasNoLocalizador: 3 },
          },
        },
      },
    ],
  };
}

const todayKey = `${BACKUP_KEY_PREFIX}${new Date().toISOString().slice(0, 10)}`;

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  // Silencia warnings esperados nos cenários de erro.
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
});

describe('loadPlano / savePlano', () => {
  it('retorna plano vazio quando localStorage está vazio', () => {
    const plano = loadPlano();
    expect(plano).toEqual(planoVazio());
    expect(plano.version).toBe(SCHEMA_VERSION);
    expect(plano.nodes).toEqual([]);
    expect(plano.edges).toEqual([]);
  });

  it('carrega plano v1 válido do localStorage', () => {
    const fixture = planoExemplo();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fixture));

    const carregado = loadPlano();
    expect(carregado).toEqual(fixture);
  });

  it('round-trip: savePlano seguido de loadPlano preserva a estrutura', () => {
    const original = planoExemplo();
    savePlano(original);

    const carregado = loadPlano();
    expect(carregado).toEqual(original);
    expect(carregado.nodes[0]?.data.flags.espera).toBe(true);
    expect(carregado.edges[0]?.data.atp?.trigger).toEqual({
      tipo: 'L',
      diasNoLocalizador: 3,
    });
  });

  it('JSON inválido vai para backup e retorna plano vazio', () => {
    localStorage.setItem(STORAGE_KEY, '{ isto não é JSON válido');

    const plano = loadPlano();

    expect(plano).toEqual(planoVazio());
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(todayKey)).toBe('{ isto não é JSON válido');
    expect(console.warn).toHaveBeenCalled();
  });

  it('shape inválido (não passa no Zod) vai para backup e retorna plano vazio', () => {
    // JSON sintaticamente válido, mas falta `version` e `nodes`/`edges`.
    const lixo = JSON.stringify({ planoNome: 'sem versão', flowMode: 'organic' });
    localStorage.setItem(STORAGE_KEY, lixo);

    const plano = loadPlano();

    expect(plano).toEqual(planoVazio());
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(todayKey)).toBe(lixo);
    expect(console.warn).toHaveBeenCalled();
  });

  it('versão diferente de SCHEMA_VERSION é tratada como shape inválido', () => {
    const v999 = JSON.stringify({ ...planoExemplo(), version: 999 });
    localStorage.setItem(STORAGE_KEY, v999);

    const plano = loadPlano();
    expect(plano).toEqual(planoVazio());
    expect(localStorage.getItem(todayKey)).toBe(v999);
  });
});

describe('criarSavePlanoDebounced', () => {
  it('não escreve antes do delay configurado', () => {
    vi.useFakeTimers();
    const save = criarSavePlanoDebounced(300);

    save(planoExemplo());

    vi.advanceTimersByTime(299);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    vi.advanceTimersByTime(1);
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('chamadas próximas em sequência coalescem em uma única gravação', () => {
    vi.useFakeTimers();
    const save = criarSavePlanoDebounced(300);
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    const p1 = { ...planoExemplo(), planoNome: 'um' };
    const p2 = { ...planoExemplo(), planoNome: 'dois' };
    const p3 = { ...planoExemplo(), planoNome: 'três' };

    save(p1);
    vi.advanceTimersByTime(100);
    save(p2);
    vi.advanceTimersByTime(100);
    save(p3);
    vi.advanceTimersByTime(300);

    // Só a última chamada deve ter sido gravada.
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored.planoNome).toBe('três');
    // Filtra writes da própria chave (probe e backup ficam de fora).
    const writes = setItemSpy.mock.calls.filter(([key]) => key === STORAGE_KEY);
    expect(writes).toHaveLength(1);
  });

  it('flush() escreve imediatamente o pendente sem esperar o delay', () => {
    vi.useFakeTimers();
    const save = criarSavePlanoDebounced(300);

    save(planoExemplo());
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    save.flush();
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('cancel() descarta o pendente sem escrever', () => {
    vi.useFakeTimers();
    const save = criarSavePlanoDebounced(300);

    save(planoExemplo());
    save.cancel();

    vi.advanceTimersByTime(1000);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('flush() sem chamada anterior é no-op (não lança)', () => {
    const save = criarSavePlanoDebounced(300);
    expect(() => save.flush()).not.toThrow();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
