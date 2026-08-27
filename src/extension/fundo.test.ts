import { beforeEach, describe, expect, it, vi } from 'vitest';
import { esquecerLotacao, registrarLotacao } from '@/infra/sync/lotacoes';
import { limparUltimaLotacao, setUltimaLotacao } from '@/infra/sync/sessaoPersistida';
import { alvoDeFundo, textoDoResumo } from './fundo';

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

function registrar(workspaceId: string, permissao: 'leitura' | 'edicao' = 'edicao') {
  registrarLotacao({
    workspaceId,
    nome: `Lotação ${workspaceId}`,
    codigo: `cod-${workspaceId}`,
    permissao,
    ultimoAcesso: new Date().toISOString(),
  });
}

describe('alvoDeFundo', () => {
  it('não sincroniza nada em modo local', () => {
    registrar('ws-1');
    limparUltimaLotacao();
    expect(alvoDeFundo()).toBeNull();
  });

  it('resolve o código a partir da lotação conhecida', () => {
    registrar('ws-1', 'leitura');
    setUltimaLotacao('ws-1');
    expect(alvoDeFundo()).toEqual({
      workspaceId: 'ws-1',
      codigo: 'cod-ws-1',
      permissao: 'leitura',
    });
  });

  it('escolhe a última aberta, não a mais recém-registrada', () => {
    registrar('ws-1');
    setUltimaLotacao('ws-1');
    registrar('ws-2');
    expect(alvoDeFundo()?.workspaceId).toBe('ws-1');
  });

  it('desiste quando a lotação foi esquecida — o código foi embora junto', () => {
    registrar('ws-1');
    setUltimaLotacao('ws-1');
    esquecerLotacao('ws-1');
    expect(alvoDeFundo()).toBeNull();
  });
});

describe('textoDoResumo', () => {
  it('é vazio quando nada mudou (não há o que notificar)', () => {
    expect(textoDoResumo({ recebidos: 0, atualizados: 0, removidos: 0 })).toBe('');
  });

  it('lista só o que aconteceu', () => {
    expect(textoDoResumo({ recebidos: 3, atualizados: 0, removidos: 0 })).toBe(
      '3 plano(s) novo(s)',
    );
  });

  it('junta as três contagens', () => {
    expect(textoDoResumo({ recebidos: 1, atualizados: 2, removidos: 3 })).toBe(
      '1 plano(s) novo(s) · 2 atualizado(s) · 3 removido(s)',
    );
  });
});
