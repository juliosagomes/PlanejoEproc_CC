import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SCHEMA_VERSION, type Plano } from '@/domain';
import { criarPlano, listPlanos, setEscopo, sobrescreverPlano } from '@/infra/storage';
import { listTombstones, registrarTombstone } from '@/infra/sync/lotacoes';
import { findEntradaPorLocal, registrarEntrada } from '@/infra/sync/syncMap';

// O cliente HTTP é o único ponto de rede; mockado, o resto da store roda de
// verdade contra o localStorage do jsdom.
vi.mock('@/infra/sync/client', async () => {
  const real = await vi.importActual<typeof import('@/infra/sync/client')>(
    '@/infra/sync/client',
  );
  return {
    ...real,
    sincronizar: vi.fn(),
    publicar: vi.fn(),
    criarWorkspace: vi.fn(),
  };
});

import { publicar, sincronizar, SyncError } from '@/infra/sync/client';
import { useSessaoStore } from '@/features/sessao/store';
import { useSyncStore } from './store';

const WORKSPACE_ID = 'ws-teste';

function plano(nome: string): Plano {
  return {
    version: SCHEMA_VERSION,
    planoNome: nome,
    flowMode: 'organic',
    flags: [],
    nodes: [],
    edges: [],
  };
}

/** Cria um plano local já vinculado a um `remotoId` (como se já publicado). */
function criarPlanoSincronizado(nome: string, remotoId: string): string {
  const { id } = criarPlano(nome);
  sobrescreverPlano(id, plano(nome));
  registrarEntrada({
    localId: id,
    remotoId,
    workspaceCodigo: 'codigo-edicao',
    papel: 'dono',
    ultimaSincronizacao: new Date().toISOString(),
  });
  return id;
}

function entrarNaLotacao(permissao: 'leitura' | 'edicao' = 'edicao') {
  setEscopo({ tipo: 'lotacao', workspaceId: WORKSPACE_ID });
  useSessaoStore.setState({
    sessao: {
      tipo: 'lotacao',
      workspaceId: WORKSPACE_ID,
      nome: 'Vara de teste',
      codigo: permissao === 'edicao' ? 'codigo-edicao' : 'codigo-leitura',
      permissao,
    },
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  useSyncStore.setState({
    publicando: false,
    sincronizando: false,
    ultimoErro: null,
    ultimoPull: null,
    ultimoPush: null,
  });
  useSessaoStore.setState({ sessao: null });
  setEscopo(null);
});

describe('baixarDoServidor (pull)', () => {
  it('sobrescreve o plano já conhecido em vez de duplicar', async () => {
    entrarNaLotacao();
    const localId = criarPlanoSincronizado('Nome antigo', 'r-1');

    vi.mocked(sincronizar).mockResolvedValue({
      workspaceId: WORKSPACE_ID,
      nome: 'Vara de teste',
      permissao: 'edicao',
      planos: [
        {
          remotoId: 'r-1',
          nome: 'Nome novo',
          atualizadoEm: new Date().toISOString(),
          plano: plano('Nome novo'),
        },
      ],
    });

    await useSyncStore.getState().baixarDoServidor();

    const index = listPlanos();
    expect(index).toHaveLength(1);
    expect(index[0]?.id).toBe(localId);
    expect(index[0]?.nome).toBe('Nome novo');
    expect(useSyncStore.getState().ultimoPull).toEqual({
      recebidos: 0,
      atualizados: 1,
      removidos: 0,
    });
  });

  it('remove localmente o plano cujo remotoId sumiu do servidor', async () => {
    entrarNaLotacao();
    criarPlanoSincronizado('Some do servidor', 'r-1');
    criarPlanoSincronizado('Continua', 'r-2');

    vi.mocked(sincronizar).mockResolvedValue({
      workspaceId: WORKSPACE_ID,
      nome: 'Vara de teste',
      permissao: 'edicao',
      planos: [
        {
          remotoId: 'r-2',
          nome: 'Continua',
          atualizadoEm: new Date().toISOString(),
          plano: plano('Continua'),
        },
      ],
    });

    await useSyncStore.getState().baixarDoServidor();

    expect(listPlanos().map((p) => p.nome)).toEqual(['Continua']);
    expect(useSyncStore.getState().ultimoPull?.removidos).toBe(1);
  });

  it('preserva o rascunho local que nunca foi publicado', async () => {
    entrarNaLotacao();
    criarPlano('Rascunho local');

    vi.mocked(sincronizar).mockResolvedValue({
      workspaceId: WORKSPACE_ID,
      nome: 'Vara de teste',
      permissao: 'edicao',
      planos: [],
    });

    await useSyncStore.getState().baixarDoServidor();

    expect(listPlanos().map((p) => p.nome)).toEqual(['Rascunho local']);
    expect(useSyncStore.getState().ultimoPull?.removidos).toBe(0);
  });

  it('registra o erro sem alterar os planos locais', async () => {
    entrarNaLotacao();
    criarPlanoSincronizado('Intocado', 'r-1');
    vi.mocked(sincronizar).mockRejectedValue(new SyncError('Código não encontrado.'));

    await useSyncStore.getState().baixarDoServidor();

    expect(useSyncStore.getState().ultimoErro).toBe('Código não encontrado.');
    expect(listPlanos().map((p) => p.nome)).toEqual(['Intocado']);
  });
});

describe('enviarAoServidor (push)', () => {
  it('envia todos os planos da lotação junto com os tombstones', async () => {
    entrarNaLotacao();
    criarPlanoSincronizado('Plano 1', 'r-1');
    criarPlano('Plano 2 (novo)');
    registrarTombstone(WORKSPACE_ID, 'r-excluido');

    vi.mocked(publicar).mockResolvedValue({ publicados: [], removidos: ['r-excluido'] });

    await useSyncStore.getState().enviarAoServidor();

    expect(publicar).toHaveBeenCalledTimes(1);
    const [codigo, payload, remover] = vi.mocked(publicar).mock.calls[0]!;
    expect(codigo).toBe('codigo-edicao');
    expect(payload).toHaveLength(2);
    expect(remover).toEqual(['r-excluido']);
    expect(useSyncStore.getState().ultimoPush).toEqual({ enviados: 2, removidos: 1 });
  });

  it('limpa os tombstones no sucesso', async () => {
    entrarNaLotacao();
    registrarTombstone(WORKSPACE_ID, 'r-excluido');
    vi.mocked(publicar).mockResolvedValue({ publicados: [], removidos: ['r-excluido'] });

    await useSyncStore.getState().enviarAoServidor();

    expect(listTombstones(WORKSPACE_ID)).toEqual([]);
  });

  it('mantém os tombstones quando a publicação falha — vão na próxima tentativa', async () => {
    entrarNaLotacao();
    registrarTombstone(WORKSPACE_ID, 'r-excluido');
    vi.mocked(publicar).mockRejectedValue(new SyncError('Falha de rede.'));

    await useSyncStore.getState().enviarAoServidor();

    expect(useSyncStore.getState().ultimoErro).toBe('Falha de rede.');
    expect(listTombstones(WORKSPACE_ID)).toEqual(['r-excluido']);
  });

  it('vincula ao mapa os planos publicados pela primeira vez', async () => {
    entrarNaLotacao();
    const { id } = criarPlano('Estreante');
    vi.mocked(publicar).mockResolvedValue({ publicados: [], removidos: [] });

    expect(findEntradaPorLocal(id)).toBeUndefined();
    await useSyncStore.getState().enviarAoServidor();

    expect(findEntradaPorLocal(id)?.remotoId).toBeTruthy();
  });

  it('não publica com código de leitura', async () => {
    entrarNaLotacao('leitura');
    criarPlano('Qualquer');

    await useSyncStore.getState().enviarAoServidor();

    expect(publicar).not.toHaveBeenCalled();
  });
});

describe('excluirPlanoDaSessao', () => {
  it('marca a exclusão para propagar quando o plano já existia no servidor', () => {
    entrarNaLotacao();
    const localId = criarPlanoSincronizado('Publicado', 'r-1');

    useSyncStore.getState().excluirPlanoDaSessao(localId);

    expect(listPlanos()).toEqual([]);
    expect(listTombstones(WORKSPACE_ID)).toEqual(['r-1']);
    expect(findEntradaPorLocal(localId)).toBeUndefined();
  });

  it('não cria tombstone para plano nunca publicado', () => {
    entrarNaLotacao();
    const { id } = criarPlano('Nunca publicado');

    useSyncStore.getState().excluirPlanoDaSessao(id);

    expect(listPlanos()).toEqual([]);
    expect(listTombstones(WORKSPACE_ID)).toEqual([]);
  });

  it('no modo local apenas exclui, sem tombstone', () => {
    setEscopo({ tipo: 'local' });
    useSessaoStore.setState({ sessao: { tipo: 'local' } });
    const { id } = criarPlano('Plano local');

    useSyncStore.getState().excluirPlanoDaSessao(id);

    expect(listPlanos()).toEqual([]);
    expect(listTombstones(WORKSPACE_ID)).toEqual([]);
  });
});
