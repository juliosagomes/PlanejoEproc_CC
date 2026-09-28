import { describe, expect, it } from 'vitest';
import { chaveAnotacao } from './chaveAnotacao';

/* ============================================================================
 * A chave da anotação (decisoes.md#D-25).
 *
 * O que está sob teste não é a string em si — é a promessa de que a anotação
 * continua colada no recurso quando o nome chega escrito de outro jeito, que é
 * o que acontece entre o XLS e a coleta da unidade.
 * ========================================================================== */

describe('chaveAnotacao', () => {
  it('localizador casa apesar de emoji, acento e caixa', () => {
    const a = chaveAnotacao('Localizador', '📝 Minutar (Secretaria)');
    expect(chaveAnotacao('Localizador', 'MINUTAR SECRETARIA')).toBe(a);
    expect(chaveAnotacao('Localizador', 'minutar (secretaria)')).toBe(a);
  });

  it('localizador casa CITACAO com Citação — a cedilha não vira espaço', () => {
    expect(chaveAnotacao('Localizador', 'CITACAO DJE')).toBe(
      chaveAnotacao('Localizador', 'Citação DJE'),
    );
  });

  it('os outros tipos normalizam caixa e espaço, mas preservam a pontuação', () => {
    expect(chaveAnotacao('Modelo', '  Despacho   citação ')).toBe(
      chaveAnotacao('Modelo', 'DESPACHO CITAÇÃO'),
    );
    // Aqui a régua do localizador colapsaria os dois, e nomes de modelo se
    // distinguem por pontuação com frequência demais para isso.
    expect(chaveAnotacao('Modelo', 'Despacho - citação')).not.toBe(
      chaveAnotacao('Modelo', 'Despacho citação'),
    );
  });

  it('o mesmo nome em tipos diferentes são anotações diferentes', () => {
    expect(chaveAnotacao('Modelo', 'Intimação')).not.toBe(
      chaveAnotacao('Texto padrão', 'Intimação'),
    );
  });
});
