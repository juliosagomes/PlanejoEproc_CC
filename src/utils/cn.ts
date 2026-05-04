/**
 * Concatena classNames de forma resiliente a falsy/condicionais.
 *
 * Aceita strings, valores falsy (filtrados) e objetos `{ classe: condicao }`.
 * Substitui o padrão `cls(...xs.filter(Boolean).join(' '))` do BETA_2.
 *
 * Não usamos `clsx` para evitar uma dependência por uma função de 12 linhas.
 */
export function cn(
  ...args: Array<string | false | null | undefined | Record<string, unknown>>
): string {
  const out: string[] = [];
  for (const a of args) {
    if (!a) continue;
    if (typeof a === 'string') {
      out.push(a);
      continue;
    }
    for (const [chave, valor] of Object.entries(a)) {
      if (valor) out.push(chave);
    }
  }
  return out.join(' ');
}
