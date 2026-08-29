/* ============================================================================
 * QUANDO O TUTORIAL ABRE SOZINHO
 *
 * Duas perguntas separadas de propósito:
 *
 *   deveAbrirNaPrimeiraVez — "esta pessoa ainda precisa ver isto?"  (uma vez,
 *                            no primeiro render do editor)
 *   podeAbrirAgora         — "e é uma boa hora?"                   (a cada
 *                            render, porque a resposta muda)
 *
 * Juntá-las num `useEffect` seria mais curto e traria de volta o piscar: o
 * editor apareceria por um quadro sem o tutorial, e os slides cairiam na tela
 * depois. Como `getStorage()` é síncrono e `main.tsx` só renderiza depois de
 * `inicializarPlataforma()`, a primeira pergunta cabe num inicializador
 * preguiçoso de `useState` e o modal já sai no primeiro quadro.
 * ========================================================================== */

export interface ArgsPrimeiraVez {
  /** Versão do roteiro que este navegador já viu (`infra/storage/tutorial`). */
  vistoVersao: number | null;
  versaoAtual: number;
  /** Sessão de visualização (decisoes.md#D-19). */
  somenteLeitura: boolean;
}

/**
 * O roteiro inteiro é sobre editar — sincronizar, criar nó, conectar, digitar
 * resumo. Numa sessão de visualização nada disso é possível, então o tutorial
 * não se impõe; continua acessível pelo botão da barra lateral.
 *
 * Consequência proposital: como a marca só é gravada ao **fechar** um tutorial
 * aberto, a sessão de leitura nunca a grava. Quem entrar depois com o código de
 * edição ainda ganha a abertura automática.
 */
export function deveAbrirNaPrimeiraVez({
  vistoVersao,
  versaoAtual,
  somenteLeitura,
}: ArgsPrimeiraVez): boolean {
  if (somenteLeitura) return false;
  if (vistoVersao === null) return true;
  // `<` e não `!==`: quem voltou para um build antigo já viu um roteiro mais
  // novo do que este: reabrir seria mostrar informação velha para quem tem a
  // recente na cabeça.
  return vistoVersao < versaoAtual;
}

export interface ArgsAgora {
  /** Resultado de `deveAbrirNaPrimeiraVez`, ainda não consumido. */
  pendente: boolean;
  /** O `CodigosLotacaoModal` está na tela. */
  codigosPendentes: boolean;
}

/**
 * O `CodigosLotacaoModal` aparece exatamente no primeiro carregamento do editor
 * de uma lotação recém-criada — o mesmo instante em que o tutorial quer abrir.
 * E ele é o que não pode perder a disputa: o scrim dele não fecha por clique e o
 * botão fica travado atrás de um checkbox, porque os códigos de acesso são
 * exibidos **uma única vez** e o servidor não sabe recuperá-los
 * (decisoes.md#D-8).
 *
 * Resolver por z-index ou por ordem de irmãos no JSX seria um contrato
 * invisível, do tipo que a próxima pessoa quebra ao reordenar o `App.tsx`.
 * Ceder a vez aqui é explícito, e como é calculado no render o tutorial abre no
 * mesmo quadro em que os códigos somem.
 */
export function podeAbrirAgora({ pendente, codigosPendentes }: ArgsAgora): boolean {
  return pendente && !codigosPendentes;
}
