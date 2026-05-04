/**
 * Gerador de IDs únicos por sessão. Counter base é `Date.now()` no carregamento
 * do módulo + sequência incremental. Garante unicidade e ordem por criação.
 *
 * Não usar para chaves persistidas que precisem ser globalmente únicas
 * (ex.: entre máquinas) — basta para nodes/edges/subitems do plano corrente.
 */
let counter = Date.now();

export function uid(prefix: string = 'id'): string {
  counter += 1;
  return `${prefix}-${counter.toString(36)}`;
}
