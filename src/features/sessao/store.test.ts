import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SCHEMA_VERSION, type Plano } from '@/domain';
import { useCanvasStore } from '@/features/canvas/store';
import {
  comEscopo,
  criarPlano,
  getEscopo,
  listPlanos,
  setEscopo,
  sobrescreverPlano,
} from '@/infra/storage';
import { listLotacoes } from '@/infra/sync/lotacoes';

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

import { criarWorkspace, sincronizar, SyncError } from '@/infra/sync/client';
import { useSessaoStore } from './store';

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

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  setEscopo(null);
  useSessaoStore.setState({
    sessao: null,
    entrando: false,
    erro: null,
    lotacoes: [],
    codigosNovaLotacao: null,
  });
  useCanvasStore.setState({
    nodes: [],
    edges: [],
    selectedId: null,
    planoNome: 'Plano sem título',
    flowMode: 'organic',
    somenteLeitura: false,
  });
});

describe('entrarLocal', () => {
  it('aponta o escopo para o silo local e carrega o plano ativo no canvas', () => {
    comEscopo({ tipo: 'local' }, () => {
      const { id } = criarPlano('Meu plano local');
      sobrescreverPlano(id, plano('Meu plano local'));
    });

    useSessaoStore.getState().entrarLocal();

    expect(getEscopo()).toEqual({ tipo: 'local' });
    expect(useSessaoStore.getState().sessao).toEqual({ tipo: 'local' });
    expect(useCanvasStore.getState().planoNome).toBe('Meu plano local');
  });

  it('silo vazio ganha um plano em branco já registrado no índice', () => {
    useSessaoStore.getState().entrarLocal();

    expect(useCanvasStore.getState().planoNome).toBe('Plano sem título');
    expect(useCanvasStore.getState().nodes).toEqual([]);
    // Registrado de verdade — senão o seletor diria "nenhum plano salvo"
    // enquanto o usuário já estaria editando.
    expect(listPlanos()).toHaveLength(1);
  });
});

describe('entrarComCodigo', () => {
  it('abre o silo do workspaceId devolvido pelo servidor e aplica os planos', async () => {
    vi.mocked(sincronizar).mockResolvedValue({
      workspaceId: 'ws-1',
      nome: '2ª Vara Cível',
      permissao: 'leitura',
      planos: [
        {
          remotoId: 'r-1',
          nome: 'Fluxo de cumprimento',
          atualizadoEm: new Date().toISOString(),
          plano: plano('Fluxo de cumprimento'),
        },
      ],
    });

    const ok = await useSessaoStore.getState().entrarComCodigo('  cod-leitura  ');

    expect(ok).toBe(true);
    expect(getEscopo()).toEqual({ tipo: 'lotacao', workspaceId: 'ws-1' });
    expect(listPlanos().map((p) => p.nome)).toEqual(['Fluxo de cumprimento']);
    expect(useSessaoStore.getState().sessao).toEqual({
      tipo: 'lotacao',
      workspaceId: 'ws-1',
      nome: '2ª Vara Cível',
      codigo: 'cod-leitura',
      permissao: 'leitura',
    });
  });

  it('com código de edição, guarda também o código de leitura devolvido', async () => {
    vi.mocked(sincronizar).mockResolvedValue({
      workspaceId: 'ws-1',
      nome: '2ª Vara Cível',
      permissao: 'edicao',
      planos: [],
      codigoLeitura: 'cod-leitura',
    });

    await useSessaoStore.getState().entrarComCodigo('cod-edicao');

    expect(useSessaoStore.getState().sessao).toMatchObject({
      codigo: 'cod-edicao',
      codigoLeitura: 'cod-leitura',
      permissao: 'edicao',
    });
  });

  it('implantação antiga sem `codigoLeitura` não impede a entrada', async () => {
    vi.mocked(sincronizar).mockResolvedValue({
      workspaceId: 'ws-1',
      nome: '2ª Vara Cível',
      permissao: 'edicao',
      planos: [],
    });

    const ok = await useSessaoStore.getState().entrarComCodigo('cod-edicao');

    expect(ok).toBe(true);
    const { sessao } = useSessaoStore.getState();
    expect(sessao).toMatchObject({ permissao: 'edicao' });
    expect(sessao?.tipo === 'lotacao' && sessao.codigoLeitura).toBeUndefined();
  });

  it('guarda a lotação para reentrada em um clique', async () => {
    vi.mocked(sincronizar).mockResolvedValue({
      workspaceId: 'ws-1',
      nome: '2ª Vara Cível',
      permissao: 'edicao',
      planos: [],
    });

    await useSessaoStore.getState().entrarComCodigo('cod-edicao');

    expect(listLotacoes()).toHaveLength(1);
    expect(listLotacoes()[0]).toMatchObject({
      workspaceId: 'ws-1',
      nome: '2ª Vara Cível',
      codigo: 'cod-edicao',
      permissao: 'edicao',
    });
  });

  it('não deixa o silo local visível dentro da lotação', async () => {
    comEscopo({ tipo: 'local' }, () => criarPlano('Plano do modo local'));
    vi.mocked(sincronizar).mockResolvedValue({
      workspaceId: 'ws-1',
      nome: 'Vara',
      permissao: 'edicao',
      planos: [],
    });

    await useSessaoStore.getState().entrarComCodigo('cod');

    // A lotação veio vazia, então só existe o plano em branco criado na entrada.
    expect(listPlanos().map((p) => p.nome)).toEqual(['Plano sem título']);
    expect(comEscopo({ tipo: 'local' }, () => listPlanos()).map((p) => p.nome)).toEqual([
      'Plano do modo local',
    ]);
  });

  it('entrar com código de leitura não cria plano nem marca o canvas como editável', async () => {
    vi.mocked(sincronizar).mockResolvedValue({
      workspaceId: 'ws-1',
      nome: 'Vara',
      permissao: 'leitura',
      planos: [],
    });

    await useSessaoStore.getState().entrarComCodigo('cod-leitura');

    // O plano em branco de cortesia é a primeira escrita da sessão — e uma
    // sessão de visualização não escreve (decisoes.md#D-19).
    expect(listPlanos()).toEqual([]);
    expect(useCanvasStore.getState().somenteLeitura).toBe(true);
  });

  it('voltar para o modo local destrava o canvas', async () => {
    vi.mocked(sincronizar).mockResolvedValue({
      workspaceId: 'ws-1',
      nome: 'Vara',
      permissao: 'leitura',
      planos: [],
    });
    await useSessaoStore.getState().entrarComCodigo('cod-leitura');
    expect(useCanvasStore.getState().somenteLeitura).toBe(true);

    useSessaoStore.getState().entrarLocal();
    expect(useCanvasStore.getState().somenteLeitura).toBe(false);
  });

  it('em caso de erro não troca o escopo nem a sessão', async () => {
    vi.mocked(sincronizar).mockRejectedValue(new SyncError('Código não encontrado.'));

    const ok = await useSessaoStore.getState().entrarComCodigo('errado');

    expect(ok).toBe(false);
    expect(getEscopo()).toBeNull();
    expect(useSessaoStore.getState().sessao).toBeNull();
    expect(useSessaoStore.getState().erro).toBe('Código não encontrado.');
  });

  it('código em branco é ignorado sem chamar a rede', async () => {
    const ok = await useSessaoStore.getState().entrarComCodigo('   ');

    expect(ok).toBe(false);
    expect(sincronizar).not.toHaveBeenCalled();
  });
});

describe('criarLotacao', () => {
  beforeEach(() => {
    vi.mocked(criarWorkspace).mockResolvedValue({
      workspaceId: 'ws-novo',
      codigoLeitura: 'cod-leitura',
      codigoEdicao: 'cod-edicao',
    });
  });

  it('entra na lotação nova com permissão de edição e expõe os códigos uma vez', async () => {
    const ok = await useSessaoStore.getState().criarLotacao('1ª Vara de Família', false);

    expect(ok).toBe(true);
    expect(getEscopo()).toEqual({ tipo: 'lotacao', workspaceId: 'ws-novo' });
    expect(useSessaoStore.getState().sessao).toMatchObject({
      tipo: 'lotacao',
      nome: '1ª Vara de Família',
      permissao: 'edicao',
    });
    expect(useSessaoStore.getState().codigosNovaLotacao).toEqual({
      nome: '1ª Vara de Família',
      codigoLeitura: 'cod-leitura',
      codigoEdicao: 'cod-edicao',
    });
  });

  it('não leva os planos locais quando o usuário não pede', async () => {
    comEscopo({ tipo: 'local' }, () => criarPlano('Fica no local'));

    await useSessaoStore.getState().criarLotacao('Vara nova', false);

    expect(vi.mocked(criarWorkspace).mock.calls[0]?.[1]).toEqual([]);
    expect(listPlanos().map((p) => p.nome)).toEqual(['Plano sem título']);
  });

  it('leva os planos do modo local mantendo os originais lá', async () => {
    comEscopo({ tipo: 'local' }, () => {
      const { id } = criarPlano('Fluxo pronto');
      sobrescreverPlano(id, plano('Fluxo pronto'));
    });

    await useSessaoStore.getState().criarLotacao('Vara nova', true);

    const enviados = vi.mocked(criarWorkspace).mock.calls[0]?.[1] ?? [];
    expect(enviados).toHaveLength(1);
    expect(enviados[0]?.plano.planoNome).toBe('Fluxo pronto');
    // Copiado para o silo da lotação…
    expect(listPlanos().map((p) => p.nome)).toEqual(['Fluxo pronto']);
    // …e preservado no modo local.
    expect(comEscopo({ tipo: 'local' }, () => listPlanos())).toHaveLength(1);
  });

  it('nome em branco não chama a rede', async () => {
    const ok = await useSessaoStore.getState().criarLotacao('   ', false);

    expect(ok).toBe(false);
    expect(criarWorkspace).not.toHaveBeenCalled();
  });
});

describe('sair', () => {
  it('zera o escopo e a sessão, deixando o canvas em branco', async () => {
    vi.mocked(sincronizar).mockResolvedValue({
      workspaceId: 'ws-1',
      nome: 'Vara',
      permissao: 'edicao',
      planos: [
        {
          remotoId: 'r-1',
          nome: 'Algum plano',
          atualizadoEm: new Date().toISOString(),
          plano: plano('Algum plano'),
        },
      ],
    });
    await useSessaoStore.getState().entrarComCodigo('cod');

    useSessaoStore.getState().sair();

    expect(getEscopo()).toBeNull();
    expect(useSessaoStore.getState().sessao).toBeNull();
    expect(useCanvasStore.getState().nodes).toEqual([]);
    // Os planos da lotação continuam no silo, prontos para a próxima entrada.
    expect(
      comEscopo({ tipo: 'lotacao', workspaceId: 'ws-1' }, () => listPlanos()),
    ).toHaveLength(1);
  });
});

describe('esquecer', () => {
  it('remove a lotação da lista de recentes sem apagar os planos', async () => {
    vi.mocked(sincronizar).mockResolvedValue({
      workspaceId: 'ws-1',
      nome: 'Vara',
      permissao: 'edicao',
      planos: [
        {
          remotoId: 'r-1',
          nome: 'Algum plano',
          atualizadoEm: new Date().toISOString(),
          plano: plano('Algum plano'),
        },
      ],
    });
    await useSessaoStore.getState().entrarComCodigo('cod');

    useSessaoStore.getState().esquecer('ws-1');

    expect(useSessaoStore.getState().lotacoes).toEqual([]);
    expect(
      comEscopo({ tipo: 'lotacao', workspaceId: 'ws-1' }, () => listPlanos()),
    ).toHaveLength(1);
  });
});
