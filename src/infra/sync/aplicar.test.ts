import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SCHEMA_VERSION, type Plano } from '@/domain';
import { criarPlano, setEscopo, sobrescreverPlano } from '@/infra/storage';
import { registrarEntrada } from './syncMap';
import { aplicarSincronizacao, diffSincronizacao } from './aplicar';
import type { SincronizarPlanoItem } from './syncSchema';

/* ============================================================================
 * `diffSincronizacao` é o que sustenta a verificação de fundo do D-17: a
 * extensão pergunta ao servidor e avisa, mas não baixa. Os dois riscos que
 * estes testes cercam são opostos e igualmente ruins:
 *
 *  - falso negativo → o colega publicou e ninguém fica sabendo;
 *  - falso positivo → notificação a cada 15 min, e em um dia o usuário desliga
 *    a verificação (e aí perde os avisos de verdade).
 * ========================================================================== */

const WORKSPACE_ID = 'ws-diff';
const CODIGO = 'cod-1';

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

function itemRemoto(
  remotoId: string,
  nome: string,
  atualizadoEm: string,
): SincronizarPlanoItem {
  return { remotoId, nome, atualizadoEm, plano: plano(nome) };
}

/** Plano local já vinculado a um remoto, com o carimbo do servidor gravado. */
function jaSincronizado(nome: string, remotoId: string, remotoAtualizadoEm?: string) {
  const { id } = criarPlano(nome);
  sobrescreverPlano(id, plano(nome));
  registrarEntrada({
    localId: id,
    remotoId,
    workspaceCodigo: CODIGO,
    papel: 'assinante',
    ultimaSincronizacao: new Date().toISOString(),
    ...(remotoAtualizadoEm === undefined ? {} : { remotoAtualizadoEm }),
  });
  return id;
}

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  setEscopo({ tipo: 'lotacao', workspaceId: WORKSPACE_ID });
});

describe('diffSincronizacao', () => {
  it('silo vazio: tudo que o servidor tem é novidade', () => {
    expect(
      diffSincronizacao([
        itemRemoto('r1', 'A', '2026-08-27T10:00:00.000Z'),
        itemRemoto('r2', 'B', '2026-08-27T10:00:00.000Z'),
      ]),
    ).toEqual({ recebidos: 2, atualizados: 0, removidos: 0 });
  });

  it('mesmo carimbo em tudo: nada a avisar', () => {
    jaSincronizado('A', 'r1', '2026-08-27T10:00:00.000Z');
    jaSincronizado('B', 'r2', '2026-08-27T11:00:00.000Z');

    expect(
      diffSincronizacao([
        itemRemoto('r1', 'A', '2026-08-27T10:00:00.000Z'),
        itemRemoto('r2', 'B', '2026-08-27T11:00:00.000Z'),
      ]),
    ).toEqual({ recebidos: 0, atualizados: 0, removidos: 0 });
  });

  it('carimbo diferente conta como alteração', () => {
    jaSincronizado('A', 'r1', '2026-08-27T10:00:00.000Z');

    expect(
      diffSincronizacao([itemRemoto('r1', 'A', '2026-08-27T12:30:00.000Z')]),
    ).toEqual({ recebidos: 0, atualizados: 1, removidos: 0 });
  });

  it('plano que sumiu do servidor conta como removido lá', () => {
    jaSincronizado('A', 'r1', '2026-08-27T10:00:00.000Z');
    jaSincronizado('B', 'r2', '2026-08-27T10:00:00.000Z');

    expect(
      diffSincronizacao([itemRemoto('r1', 'A', '2026-08-27T10:00:00.000Z')]),
    ).toEqual({ recebidos: 0, atualizados: 0, removidos: 1 });
  });

  it('rascunho nunca publicado não vira "removido"', () => {
    // Sem entrada no mapa de sincronização, o servidor nem sabe que ele existe.
    criarPlano('Rascunho meu');

    expect(diffSincronizacao([])).toEqual({
      recebidos: 0,
      atualizados: 0,
      removidos: 0,
    });
  });

  it('entrada antiga sem carimbo conta como alteração — uma vez só', () => {
    // Quem já usava a extensão antes do D-17 não tem `remotoAtualizadoEm`.
    // "Não sei" vira um aviso, e o pull seguinte preenche o campo.
    jaSincronizado('A', 'r1');
    const doServidor = [itemRemoto('r1', 'A', '2026-08-27T10:00:00.000Z')];

    expect(diffSincronizacao(doServidor).atualizados).toBe(1);

    aplicarSincronizacao(doServidor, CODIGO);
    expect(diffSincronizacao(doServidor).atualizados).toBe(0);
  });

  it('não escreve nada: rodar o diff não muda o silo', () => {
    jaSincronizado('A', 'r1', '2026-08-27T10:00:00.000Z');
    const antes = JSON.stringify(localStorage);

    diffSincronizacao([
      itemRemoto('r1', 'A', '2026-09-01T00:00:00.000Z'),
      itemRemoto('r9', 'Novo', '2026-09-01T00:00:00.000Z'),
    ]);

    expect(JSON.stringify(localStorage)).toBe(antes);
  });
});

describe('aplicarSincronizacao guarda o carimbo do servidor', () => {
  it('para que a verificação seguinte não anuncie mudança inexistente', () => {
    const doServidor = [itemRemoto('r1', 'A', '2026-08-27T10:00:00.000Z')];

    aplicarSincronizacao(doServidor, CODIGO);

    expect(diffSincronizacao(doServidor)).toEqual({
      recebidos: 0,
      atualizados: 0,
      removidos: 0,
    });
  });
});
