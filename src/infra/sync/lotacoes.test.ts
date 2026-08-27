import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findLotacao, listLotacoes, registrarLotacao } from './lotacoes';

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

/** `ordem` vira o `ultimoAcesso`, que é o critério de ordenação da lista. */
function registrar(id: string, ordem: number, permissao: 'leitura' | 'edicao' = 'leitura') {
  registrarLotacao({
    workspaceId: id,
    nome: `Lotação ${id}`,
    codigo: `cod-${id}`,
    permissao,
    ultimoAcesso: new Date(Date.UTC(2026, 0, 1, 0, 0, ordem)).toISOString(),
  });
}

describe('registrarLotacao', () => {
  it('promove a permissão quando se entra com o código de edição', () => {
    registrar('ws-1', 1, 'leitura');
    registrar('ws-1', 2, 'edicao');
    expect(listLotacoes()).toHaveLength(1);
    expect(findLotacao('ws-1')?.permissao).toBe('edicao');
  });

  it('preserva a permissão maior ao reentrar com o código de leitura', () => {
    registrar('ws-1', 1, 'edicao');
    registrar('ws-1', 2, 'leitura');
    expect(findLotacao('ws-1')?.permissao).toBe('edicao');
    expect(findLotacao('ws-1')?.codigo).toBe('cod-ws-1');
  });

  it('mantém no máximo 20 lotações, descartando as mais antigas', () => {
    // O teto existe porque esta chave é replicada por chrome.storage.sync,
    // que limita 8 KB por item (decisoes.md#D-14).
    for (let i = 1; i <= 25; i += 1) registrar(`ws-${i}`, i);

    const lista = listLotacoes();
    expect(lista).toHaveLength(20);
    expect(lista[0]?.workspaceId).toBe('ws-25');
    expect(findLotacao('ws-1')).toBeUndefined();
    expect(findLotacao('ws-6')).toBeDefined();
  });

  it('reentrar numa já conhecida não expulsa ninguém — só reordena', () => {
    for (let i = 1; i <= 20; i += 1) registrar(`ws-${i}`, i);
    registrar('ws-1', 99); // a mais antiga, acessada de novo

    const lista = listLotacoes();
    expect(lista).toHaveLength(20);
    expect(lista[0]?.workspaceId).toBe('ws-1');
    expect(findLotacao('ws-2')).toBeDefined();
  });

  it('com a lista cheia, uma lotação nova empurra a mais antiga para fora', () => {
    for (let i = 1; i <= 20; i += 1) registrar(`ws-${i}`, i);
    registrar('ws-nova', 99);

    expect(listLotacoes()).toHaveLength(20);
    expect(findLotacao('ws-nova')).toBeDefined();
    expect(findLotacao('ws-1')).toBeUndefined();
  });
});
