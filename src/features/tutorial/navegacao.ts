import { TOTAL_PASSOS } from './roteiro';

/* ============================================================================
 * NAVEGAÇÃO ENTRE SLIDES
 *
 * Funções puras sobre o índice. Vivem fora do componente porque é aqui que
 * moram os erros de borda (passar de 8, voltar para -1, clicar numa bolinha que
 * não existe), e testá-las sem renderizar nada custa quase zero — o projeto não
 * tem @testing-library, então o que não sair do componente não é testado.
 * ========================================================================== */

/** Mantém o índice dentro de [0, TOTAL_PASSOS-1]. */
export function limitar(indice: number): number {
  if (!Number.isFinite(indice)) return 0;
  const inteiro = Math.trunc(indice);
  if (inteiro < 0) return 0;
  if (inteiro > TOTAL_PASSOS - 1) return TOTAL_PASSOS - 1;
  return inteiro;
}

export function proximo(indice: number): number {
  return limitar(limitar(indice) + 1);
}

export function anterior(indice: number): number {
  return limitar(limitar(indice) - 1);
}

export function ehUltimo(indice: number): boolean {
  return limitar(indice) === TOTAL_PASSOS - 1;
}

export function ehPrimeiro(indice: number): boolean {
  return limitar(indice) === 0;
}

/**
 * Rótulo do botão de avançar.
 *
 * O botão é o **mesmo elemento** nos 8 passos — só o texto muda. Renderizar um
 * botão diferente no último slide faria o React remontar o nó e o foco cairia
 * no `<body>` bem na hora em que o usuário mais precisa dele.
 */
export function rotuloAvancar(indice: number): string {
  return ehUltimo(indice) ? 'Concluir' : 'Próximo';
}
