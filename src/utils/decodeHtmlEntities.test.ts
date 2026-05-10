import { describe, expect, it } from 'vitest';
import { decodeHtmlEntities } from './decodeHtmlEntities';

describe('decodeHtmlEntities', () => {
  it('decodifica decimal simples (BMP)', () => {
    // U+2699 ⚙ — engrenagem usada no prefixo de localizadores de erro.
    expect(decodeHtmlEntities('&#9881;')).toBe('⚙');
  });

  it('decodifica hex em minúsculo e maiúsculo', () => {
    expect(decodeHtmlEntities('&#xfe0f;')).toBe('\u{FE0F}');
    expect(decodeHtmlEntities('&#XFE0F;')).toBe('\u{FE0F}');
  });

  it('decodifica code points fora do BMP (emojis)', () => {
    // U+1F4DD 📝 (memo) — aparece em "Minutar (Secretaria)".
    expect(decodeHtmlEntities('&#128221;')).toBe('📝');
  });

  it('reconstrói emoji ZWJ multi-código (👩🏽‍🔬 = mulher cientista pele média)', () => {
    // Sequência exata do localizador "Habilitar Perito" no XLS de exemplo.
    const seq = '&#128105;&#127997;&#8205;&#128300;';
    expect(decodeHtmlEntities(seq)).toBe('\u{1F469}\u{1F3FD}\u{200D}\u{1F52C}');
  });

  it('preserva texto ao redor das entidades', () => {
    expect(decodeHtmlEntities('&#128221; Minutar (Secretaria)')).toBe(
      '📝 Minutar (Secretaria)',
    );
  });

  it('strings sem entidades passam intactas', () => {
    expect(decodeHtmlEntities('Aguardando despacho')).toBe('Aguardando despacho');
    expect(decodeHtmlEntities('')).toBe('');
  });

  it('preserva entidade com code point inválido (acima de U+10FFFF)', () => {
    const invalid = '&#9999999;';
    expect(decodeHtmlEntities(invalid)).toBe(invalid);
  });

  it('não decodifica entidades nomeadas (escopo deliberadamente limitado)', () => {
    expect(decodeHtmlEntities('&amp;')).toBe('&amp;');
    expect(decodeHtmlEntities('&lt;tag&gt;')).toBe('&lt;tag&gt;');
  });

  it('decodifica múltiplas entidades na mesma string', () => {
    expect(decodeHtmlEntities('&#128240; CERTDJEN &#128240;')).toBe('📰 CERTDJEN 📰');
  });
});
