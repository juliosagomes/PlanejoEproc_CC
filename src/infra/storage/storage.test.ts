import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SCHEMA_VERSION, type Plano } from '@/domain';
import { setEscopo } from './escopo';
import {
  BACKUP_KEY_PREFIX,
  LEGACY_KEY,
  criarPlano,
  criarSavePlanoDebounced,
  duplicarPlano,
  excluirPlano,
  excluirTodosPlanos,
  getActivePlanKey,
  getAtivoId,
  importarPlano,
  importarPlanos,
  listPlanos,
  loadPlano,
  planoVazio,
  renomearPlano,
  savePlano,
  setAtivo,
  sobrescreverPlano,
} from './storage';

/**
 * Chaves do modo local, escritas à mão de propósito: são as mesmas de antes
 * do conceito de escopo existir. Se alguém mudar o prefixo, estes testes
 * quebram — que é exatamente o alarme desejado, porque isso deixaria os
 * planos já salvos dos usuários inacessíveis.
 */
const INDEX_KEY = 'planejoeproc:plans:index';
const ACTIVE_KEY = 'planejoeproc:plans:active';

function getPlanKey(id: string): string {
  return `planejoeproc:plan:${id}`;
}

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
  setEscopo({ tipo: 'local' });
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

  // `planoExemplo` não tem `dobra`, então o teste acima já prova que o campo é
  // de fato opcional (plano antigo não vai para o backup de corrompido). Este
  // fecha o outro lado: com dobra, ela sobrevive ao round-trip.
  it('round-trip preserva a dobra manual da aresta', () => {
    const original = planoExemplo();
    const [aresta] = original.edges;
    if (!aresta) throw new Error('fixture sem aresta');
    aresta.data.dobra = { fracaoX: 0.2, desvioY: -40 };

    savePlano(original);

    expect(loadPlano().edges[0]?.data.dobra).toEqual({ fracaoX: 0.2, desvioY: -40 });
  });

  // `z.number()` sozinho barra NaN mas deixa passar Infinity, que viraria uma
  // coordenada de path inválida. Um plano assim é dado corrompido: vai para o
  // backup e o app abre vazio, em vez de desenhar lixo.
  it('rejeita dobra com valor não-finito', () => {
    const original = planoExemplo();
    savePlano(original);
    const chave = getPlanKey(getAtivoId()!);
    const bruto = JSON.parse(localStorage.getItem(chave)!) as Plano;
    bruto.edges[0]!.data.dobra = { fracaoX: 1e999 }; // Infinity após o parse
    localStorage.setItem(chave, JSON.stringify(bruto));

    expect(loadPlano()).toEqual(planoVazio());
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

  it('importarPlanos registra cada plano e ativa o último', () => {
    const a = criarPlano('Existente').id;
    const { ids, ativoId } = importarPlanos([
      planoExemplo('Bundle 1'),
      planoExemplo('Bundle 2'),
      planoExemplo('Bundle 3'),
    ]);
    expect(ids).toHaveLength(3);
    expect(ativoId).toBe(ids[2]);
    expect(getAtivoId()).toBe(ids[2]);

    const lista = listPlanos();
    expect(lista).toHaveLength(4);
    expect(lista.some((e) => e.id === a)).toBe(true);
    expect(loadPlano(ids[0]!).planoNome).toBe('Bundle 1');
    expect(loadPlano(ids[2]!).planoNome).toBe('Bundle 3');
  });

  it('importarPlanos com lista vazia é no-op e preserva o ativo', () => {
    const a = criarPlano('A').id;
    const { ids, ativoId } = importarPlanos([]);
    expect(ids).toEqual([]);
    expect(ativoId).toBeNull();
    expect(getAtivoId()).toBe(a);
    expect(listPlanos()).toHaveLength(1);
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

  it('sobrescreverPlano atualiza payload e nome no índice mantendo o id', () => {
    const { id } = criarPlano('Original');
    const outro = criarPlano('Outro').id;

    sobrescreverPlano(id, planoExemplo('Vindo do sync'));

    expect(loadPlano(id).planoNome).toBe('Vindo do sync');
    expect(listPlanos().find((e) => e.id === id)?.nome).toBe('Vindo do sync');
    // Não mexe no ativo — "Outro" continua sendo o plano ativo.
    expect(getAtivoId()).toBe(outro);
  });

  it('sobrescreverPlano com id inexistente é no-op', () => {
    sobrescreverPlano('não-existe', planoExemplo());
    expect(listPlanos()).toEqual([]);
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

describe('isolamento entre silos', () => {
  const LOTACAO_A = { tipo: 'lotacao', workspaceId: 'ws-a' } as const;
  const LOTACAO_B = { tipo: 'lotacao', workspaceId: 'ws-b' } as const;
  const LOCAL = { tipo: 'local' } as const;

  it('planos do modo local não aparecem dentro de uma lotação', () => {
    criarPlano('Plano local');
    expect(listPlanos().map((p) => p.nome)).toEqual(['Plano local']);

    setEscopo(LOTACAO_A);
    expect(listPlanos()).toEqual([]);
    expect(getAtivoId()).toBeNull();
  });

  it('voltar ao modo local traz os planos de volta intactos', () => {
    const { id } = criarPlano('Plano local');
    savePlano({ ...planoExemplo('Plano local'), planoNome: 'Plano local' });

    setEscopo(LOTACAO_A);
    criarPlano('Plano da lotação A');

    setEscopo(LOCAL);
    expect(listPlanos().map((p) => p.nome)).toEqual(['Plano local']);
    expect(getAtivoId()).toBe(id);
    expect(loadPlano(id).nodes).toHaveLength(1);
  });

  it('duas lotações não enxergam os planos uma da outra', () => {
    setEscopo(LOTACAO_A);
    criarPlano('Plano A');

    setEscopo(LOTACAO_B);
    expect(listPlanos()).toEqual([]);
    criarPlano('Plano B');

    setEscopo(LOTACAO_A);
    expect(listPlanos().map((p) => p.nome)).toEqual(['Plano A']);
  });

  it('excluir dentro de uma lotação não toca no silo local', () => {
    criarPlano('Plano local');

    setEscopo(LOTACAO_A);
    const { id } = criarPlano('Plano A');
    excluirPlano(id);
    expect(listPlanos()).toEqual([]);

    setEscopo(LOCAL);
    expect(listPlanos().map((p) => p.nome)).toEqual(['Plano local']);
  });

  it('a migração da chave legada só roda no modo local', () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(planoExemplo('Legado')));

    setEscopo(LOTACAO_A);
    expect(listPlanos()).toEqual([]);

    setEscopo(LOCAL);
    expect(listPlanos().map((p) => p.nome)).toEqual(['Legado']);
  });

  it('apagar todos limpa o silo corrente e nenhum outro', () => {
    // O risco que este teste cerca: `planejoeproc:` é prefixo de
    // `planejoeproc:lot:…`, então uma varredura por prefixo no modo local
    // levaria junto os planos de todas as lotações (decisoes.md#D-18).
    setEscopo(LOTACAO_A);
    criarPlano('Plano A');

    setEscopo(LOCAL);
    const { id } = criarPlano('Plano local 1');
    criarPlano('Plano local 2');

    expect(excluirTodosPlanos()).toBe(2);
    expect(listPlanos()).toEqual([]);
    expect(getAtivoId()).toBeNull();
    expect(localStorage.getItem(getPlanKey(id))).toBeNull();

    setEscopo(LOTACAO_A);
    expect(listPlanos().map((p) => p.nome)).toEqual(['Plano A']);
  });

  it('apagar todos num silo vazio é no-op e devolve zero', () => {
    setEscopo(LOCAL);
    expect(excluirTodosPlanos()).toBe(0);
    expect(listPlanos()).toEqual([]);
  });
});
