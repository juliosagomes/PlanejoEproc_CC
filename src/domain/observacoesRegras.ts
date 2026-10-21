/* ============================================================================
 * OBSERVAÇÕES DAS REGRAS DE ATP (decisoes.md#D-46)
 *
 * Um resumo livre, escrito pelo usuário, do que cada regra da unidade faz.
 * Mora numa chave própria por silo, **fora do catálogo da unidade**, porque
 * sincronizar regrava o catálogo inteiro — mesmo motivo das anotações (D-25).
 * A chave é o nº da regra no Eproc.
 * ========================================================================== */

export const OBSERVACOES_REGRAS_VERSION = 1 as const;

export interface ObservacoesRegrasUnidade {
  version: typeof OBSERVACOES_REGRAS_VERSION;
  /** Nº da regra (como texto, por ser chave de JSON) → observação. */
  itens: Record<string, string>;
}

/** Grava a observação, ou tira a chave quando ela fica vazia. */
export function definirObservacao(
  itens: Readonly<Record<string, string>>,
  numero: number,
  texto: string,
): Record<string, string> {
  const { [String(numero)]: _anterior, ...resto } = itens;
  const limpo = texto.trim();
  return limpo ? { ...resto, [String(numero)]: limpo } : resto;
}
