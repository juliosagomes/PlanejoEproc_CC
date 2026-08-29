import { describe, expect, it } from 'vitest';
import { deveAbrirNaPrimeiraVez, podeAbrirAgora } from './abertura';

function abre(vistoVersao: number | null, versaoAtual = 1, somenteLeitura = false) {
  return deveAbrirNaPrimeiraVez({ vistoVersao, versaoAtual, somenteLeitura });
}

describe('deveAbrirNaPrimeiraVez', () => {
  it('abre para quem nunca viu', () => {
    expect(abre(null)).toBe(true);
  });

  it('não reabre para quem já viu esta versão', () => {
    expect(abre(1, 1)).toBe(false);
  });

  it('reabre quando o roteiro ganha versão nova', () => {
    expect(abre(1, 2)).toBe(true);
  });

  it('não reabre para quem já viu uma versão MAIS nova', () => {
    // Voltou para um build antigo: mostrar informação velha para quem tem a
    // recente na cabeça é pior do que não mostrar nada.
    expect(abre(3, 2)).toBe(false);
  });

  it('nunca se impõe numa sessão de visualização', () => {
    // O roteiro inteiro é sobre editar (decisoes.md#D-19). O botão da barra
    // lateral continua abrindo — isto aqui é só a abertura automática.
    expect(abre(null, 1, true)).toBe(false);
    expect(abre(1, 2, true)).toBe(false);
  });
});

describe('podeAbrirAgora', () => {
  it('abre quando está pendente e não há nada na frente', () => {
    expect(podeAbrirAgora({ pendente: true, codigosPendentes: false })).toBe(true);
  });

  it('cede a vez aos códigos da lotação recém-criada', () => {
    // Os códigos aparecem uma única vez e o servidor não sabe recuperá-los
    // (decisoes.md#D-8) — o tutorial espera.
    expect(podeAbrirAgora({ pendente: true, codigosPendentes: true })).toBe(false);
  });

  it('abre assim que os códigos são dispensados', () => {
    expect(podeAbrirAgora({ pendente: true, codigosPendentes: false })).toBe(true);
  });

  it('não abre o que não estava pendente', () => {
    expect(podeAbrirAgora({ pendente: false, codigosPendentes: false })).toBe(false);
  });
});
