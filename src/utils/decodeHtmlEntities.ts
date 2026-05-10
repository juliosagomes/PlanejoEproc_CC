/**
 * Decodifica referências numéricas de caracteres HTML (`&#NNN;` decimal e
 * `&#xNN;` hex) na string. Usado para reverter a codificação que o Eproc
 * aplica nos exports de localizadores — o XLS gerado pelo sistema contém
 * literais como `&#128105;&#127997;&#8205;&#128300;` em vez do emoji 👩🏽‍🔬.
 *
 * Cobertura intencional:
 *  - Decimal: `&#1234;` → U+04D2
 *  - Hex: `&#xFE0F;` ou `&#XFE0F;` → U+FE0F (variation selector usado em emojis)
 *  - Code points fora do BMP (emojis em geral) via `String.fromCodePoint`.
 *  - Code points inválidos (negativos, > U+10FFFF, NaN) são preservados como
 *    a entidade original — falhar silencioso é melhor que jogar fora dado.
 *
 * Não decodifica entidades nomeadas (`&amp;`, `&lt;`, …): o Eproc não as emite
 * neste contexto, e adicionar a tabela inteira aumenta o bundle sem ganho.
 */
export function decodeHtmlEntities(input: string): string {
  return input.replace(/&#(x[0-9a-fA-F]+|X[0-9a-fA-F]+|\d+);/g, (match, body: string) => {
    const isHex = body[0] === 'x' || body[0] === 'X';
    const codePoint = isHex ? parseInt(body.slice(1), 16) : parseInt(body, 10);
    if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
      return match;
    }
    try {
      return String.fromCodePoint(codePoint);
    } catch {
      return match;
    }
  });
}
