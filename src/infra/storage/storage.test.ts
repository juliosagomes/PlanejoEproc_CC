import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SCHEMA_VERSION, type Plano } from '@/domain';
import {
  ACTIVE_KEY,
  BACKUP_KEY_PREFIX,
  INDEX_KEY,
  LEGACY_KEY,
  criarPlano,
  criarSavePlanoDebounced,
  duplicarPlano,
  excluirPlano,
  getActivePlanKey,
  getAtivoId,
  getPlanKey,
  importarPlano,
  listPlanos,
  loadPlano,
  planoVazio,
  renomearPlano,
  savePlano,
  setAtivo,
} from './storage';

function planoExemplo(nome = 'Plano de teste'): Plano {
  return {
    version: SCHEMA_VERSION,
    planoNome: nome,
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

describe('loadPlano sem ativo / vazio', () => {
  it('retorna plano vazio quando localStorage está vazio', () => {
    const plano = loadPlano();
    expect(plano).toEqual(planoVazio());
    expect(plano.version).toBe(SCHEMA_VERSION);
    expect(plano.nodes).toEqual([]);
  });

  it('loadPlano sem ativo não cria entrada no índice (sem efeito colateral)', () => {
    loadPlano();
    expect(localStorage.getItem(INDEX_KEY)).toBeNull();
    expect(localStorage.getItem(ACTIVE_KEY)).toBeNull();
  });

  it('getAtivoId retorna null quando não há nada salvo', () => {
    expect(getAtivoId()).toBeNull();
    expect(getActivePlanKey()).toBeNull();
  });

  it('listPlanos retorna lista vazia quando nada foi criado', () => {
    expect(listPlanos()).toEqual([]);
  });
});

describe('savePlano lazy-cria entrada no índice', () => {
  it('primeiro savePlano sem ativo cria id, índice e ACTIVE_KEY', () => {
    savePlano(planoExemplo('Primeiro plano'));

    const ativoId = getAtivoId();
    expect(ativoId).not.toBeNull();
    const lista = listPlanos();
    expect(lista).toHaveLength(1);
    expect(lista[0]?.id).toBe(ativoId);
    expect(lista[0]?.nome).toBe('Primeiro plano');
    expect(localStorage.getItem(getPlanKey(ativoId!))).not.toBeNull();
  });

  it('savePlano subsequente sobrescreve o ativo, atualiza nome e timestamp', async () => {
    savePlano(planoExemplo('versão 1'));
    const ativoId = getAtivoId();
    const ts1 = listPlanos()[0]?.atualizadoEm;

    // Aguarda o relógio passar pelo menos 1ms para ts mudar.
    await new Promise((r) => setTimeout(r, 5));
    savePlano({ ...planoExemplo('versão 2'), planoNome: 'versão 2' });

    expect(getAtivoId()).toBe(ativoId);
    const lista = listPlanos();
    expect(lista).toHaveLength(1);
    expect(lista[0]?.nome).toBe('versão 2');
    expect(lista[0]!.atualizadoEm.localeCompare(ts1!)).toBeGreaterThan(0);
  });

  it('round-trip: savePlano seguido de loadPlano preserva a estrutura', () => {
    const original = planoExemplo();
    savePlano(original);
    expect(loadPlano()).toEqual(original);
  });
});

describe('migração da chave legada', () => {
  it('promove planejoeproc:plano para entrada no índice e marca como ativo', () => {
    const legacy = planoExemplo('Plano antigo');
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy));

    // Qualquer entrada na API dispara migração.
    const carregado = loadPlano();

    expect(carregado).toEqual(legacy);
    const lista = listPlanos();
    expect(lista).toHaveLength(1);
    expect(lista[0]?.nome).toBe('Plano antigo');
    expect(getAtivoId()).toBe(lista[0]?.id);
    // Chave legada permanece como rede de segurança.
    expect(localStorage.getItem(LEGACY_KEY)).not.toBeNull();
  });

  it('migração é idempotente — não duplica quando o índice já tem entradas', () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(planoExemplo('antigo')));
    loadPlano(); // dispara migração
    const ativoOriginal = getAtivoId();

    // Outra invocação não deve recriar nada.
    loadPlano();
    expect(listPlanos()).toHaveLength(1);
    expect(getAtivoId()).toBe(ativoOriginal);
  });

  it('legado com JSON inválido não cria entrada (e a chave fica intocada)', () => {
    localStorage.setItem(LEGACY_KEY, '{ não é json');
    loadPlano();
    expect(listPlanos()).toEqual([]);
    expect(getAtivoId()).toBeNull();
    expect(localStorage.getItem(LEGACY_KEY)).toBe('{ não é json');
  });

  it('legado com shape inválido (sem version) não migra', () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify({ planoNome: 'sem versão' }));
    loadPlano();
    expect(listPlanos()).toEqual([]);
  });
});

describe('CRUD do índice', () => {
  it('criarPlano gera id novo, registra e ativa', () => {
    const { id } = criarPlano('Novo');
    expect(getAtivoId()).toBe(id);
    expect(listPlanos()).toHaveLength(1);
    expect(listPlanos()[0]?.nome).toBe('Novo');
    expect(loadPlano(id)).toMatchObject({ planoNome: 'Novo', nodes: [], edges: [] });
  });

  it('setAtivo troca o ativo entre planos existentes', () => {
    const a = criarPlano('A').id;
    const b = criarPlano('B').id;
    expect(getAtivoId()).toBe(b); // último criado é ativo

    setAtivo(a);
    expect(getAtivoId()).toBe(a);
    expect(loadPlano().planoNome).toBe('A');
  });

  it('setAtivo com id inexistente é no-op', () => {
    const a = criarPlano('A').id;
    setAtivo('id-que-nao-existe');
    expect(getAtivoId()).toBe(a);
  });

  it('importarPlano gera id novo, adiciona ao índice e ativa', () => {
    criarPlano('A');
    const { id } = importarPlano(planoExemplo('Importado'));
    expect(getAtivoId()).toBe(id);
    const lista = listPlanos();
    expect(lista).toHaveLength(2);
    expect(lista.some((e) => e.id === id && e.nome === 'Importado')).toBe(true);
  });

  it('duplicarPlano copia o payload com novo id e nome "Cópia de…"', () => {
    const { id } = criarPlano('Original');
    savePlano(planoExemplo('Original'));

    const dup = duplicarPlano(id);
    expect(dup).not.toBeNull();
    expect(dup!.id).not.toBe(id);
    expect(getAtivoId()).toBe(dup!.id);
    expect(loadPlano(dup!.id).planoNome).toBe('Cópia de Original');
    expect(loadPlano(id).planoNome).toBe('Original');
  });

  it('duplicarPlano com id inexistente retorna null', () => {
    expect(duplicarPlano('não-existe')).toBeNull();
  });

  it('renomearPlano sincroniza índice e payload', () => {
    const { id } = criarPlano('Antigo');
    renomearPlano(id, 'Novo nome');

    expect(listPlanos()[0]?.nome).toBe('Novo nome');
    expect(loadPlano(id).planoNome).toBe('Novo nome');
  });

  it('renomearPlano com nome em branco usa fallback', () => {
    const { id } = criarPlano('X');
    renomearPlano(id, '   ');
    expect(listPlanos()[0]?.nome).toBe('Plano sem título');
  });

  it('excluirPlano remove entrada e payload', () => {
    const a = criarPlano('A').id;
    const b = criarPlano('B').id;

    excluirPlano(a);
    expect(localStorage.getItem(getPlanKey(a))).toBeNull();
    expect(listPlanos().map((e) => e.id)).toEqual([b]);
  });

  it('excluir o ativo promove o mais recente do que sobrou', async () => {
    const a = criarPlano('A').id;
    await new Promise((r) => setTimeout(r, 5));
    const b = criarPlano('B').id;
    setAtivo(a);

    excluirPlano(a);
    expect(getAtivoId()).toBe(b);
  });

  it('excluir o último plano limpa ACTIVE_KEY', () => {
    const a = criarPlano('A').id;
    excluirPlano(a);
    expect(getAtivoId()).toBeNull();
    expect(listPlanos()).toEqual([]);
  });
});

describe('corrupção e backup', () => {
  it('JSON inválido no plano ativo vai para backup e retorna plano vazio', () => {
    const { id } = criarPlano('A');
    localStorage.setItem(getPlanKey(id), '{ não é json');

    const plano = loadPlano();
    expect(plano).toEqual(planoVazio());
    expect(localStorage.getItem(getPlanKey(id))).toBeNull();
    expect(localStorage.getItem(todayKey)).toBe('{ não é json');
  });

  it('shape inválido no plano ativo vai para backup', () => {
    const { id } = criarPlano('A');
    const lixo = JSON.stringify({ planoNome: 'sem versão', flowMode: 'organic' });
    localStorage.setItem(getPlanKey(id), lixo);

    expect(loadPlano()).toEqual(planoVazio());
    expect(localStorage.getItem(todayKey)).toBe(lixo);
  });

  it('versão diferente de SCHEMA_VERSION é tratada como shape inválido', () => {
    const { id } = criarPlano('A');
    const v999 = JSON.stringify({ ...planoExemplo(), version: 999 });
    localStorage.setItem(getPlanKey(id), v999);

    expect(loadPlano()).toEqual(planoVazio());
    expect(localStorage.getItem(todayKey)).toBe(v999);
  });

  it('índice corrompido (JSON inválido) vai para backup e retorna lista vazia', () => {
    localStorage.setItem(INDEX_KEY, '{ índice quebrado');
    expect(listPlanos()).toEqual([]);
    expect(localStorage.getItem(INDEX_KEY)).toBeNull();
    expect(localStorage.getItem(todayKey)).toBe('{ índice quebrado');
  });

  it('índice com shape inválido (não é array) vai para backup', () => {
    localStorage.setItem(INDEX_KEY, JSON.stringify({ não: 'é array' }));
    expect(listPlanos()).toEqual([]);
    expect(localStorage.getItem(INDEX_KEY)).toBeNull();
  });
});

describe('criarSavePlanoDebounced', () => {
  it('não escreve antes do delay configurado', () => {
    vi.useFakeTimers();
    const save = criarSavePlanoDebounced(300);

    save(planoExemplo());

    vi.advanceTimersByTime(299);
    expect(getActivePlanKey()).toBeNull();

    vi.advanceTimersByTime(1);
    const key = getActivePlanKey();
    expect(key).not.toBeNull();
    expect(localStorage.getItem(key!)).not.toBeNull();
  });

  it('chamadas próximas em sequência coalescem em uma única gravação', () => {
    vi.useFakeTimers();
    const save = criarSavePlanoDebounced(300);
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    save({ ...planoExemplo(), planoNome: 'um' });
    vi.advanceTimersByTime(100);
    save({ ...planoExemplo(), planoNome: 'dois' });
    vi.advanceTimersByTime(100);
    save({ ...planoExemplo(), planoNome: 'três' });
    vi.advanceTimersByTime(300);

    const key = getActivePlanKey()!;
    const stored = JSON.parse(localStorage.getItem(key) ?? '{}');
    expect(stored.planoNome).toBe('três');

    // Apenas uma escrita no payload do plano (excluindo ACTIVE_KEY/INDEX_KEY/probe).
    const writes = setItemSpy.mock.calls.filter(([k]) => k === key);
    expect(writes).toHaveLength(1);
  });

  it('flush() escreve imediatamente o pendente sem esperar o delay', () => {
    vi.useFakeTimers();
    const save = criarSavePlanoDebounced(300);

    save(planoExemplo());
    expect(getActivePlanKey()).toBeNull();

    save.flush();
    const key = getActivePlanKey();
    expect(key).not.toBeNull();
    expect(localStorage.getItem(key!)).not.toBeNull();
  });

  it('cancel() descarta o pendente sem escrever', () => {
    vi.useFakeTimers();
    const save = criarSavePlanoDebounced(300);

    save(planoExemplo());
    save.cancel();

    vi.advanceTimersByTime(1000);
    expect(getActivePlanKey()).toBeNull();
  });

  it('flush() sem chamada anterior é no-op (não lança)', () => {
    const save = criarSavePlanoDebounced(300);
    expect(() => save.flush()).not.toThrow();
    expect(getAtivoId()).toBeNull();
  });
});
