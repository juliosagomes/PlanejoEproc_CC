import { describe, expect, it } from 'vitest';
import { SincronizarResponseSchema } from './syncSchema';

/**
 * O contrato que importa aqui é a assimetria de D-10: `codigoLeitura` é
 * acessório e nunca pode derrubar a validação da resposta inteira.
 */
describe('SincronizarResponseSchema', () => {
  const base = {
    ok: true as const,
    workspaceId: 'ws-1',
    nome: '2ª Vara Cível',
    planos: [],
    permissao: 'edicao' as const,
  };

  it('aceita a resposta com `codigoLeitura`', () => {
    const r = SincronizarResponseSchema.safeParse({ ...base, codigoLeitura: 'cod-l' });

    expect(r.success).toBe(true);
    expect(r.success && r.data.ok && r.data.codigoLeitura).toBe('cod-l');
  });

  it('aceita a resposta de implantação antiga, sem `codigoLeitura`', () => {
    const r = SincronizarResponseSchema.safeParse(base);

    expect(r.success).toBe(true);
    expect(r.success && r.data.ok && r.data.codigoLeitura).toBeUndefined();
  });

  it('rejeita `codigoLeitura` que não seja string', () => {
    const r = SincronizarResponseSchema.safeParse({ ...base, codigoLeitura: 42 });

    expect(r.success).toBe(false);
  });
});
