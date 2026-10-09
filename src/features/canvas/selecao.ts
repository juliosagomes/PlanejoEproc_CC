/**
 * Pergunta antes de apagar uma seleção múltipla. Apagar um localizador leva as
 * transições dele junto, e com a caixa de seleção é fácil apanhar um nó a mais
 * sem perceber — por isso a contagem aparece na pergunta.
 */
export function confirmarApagarSelecao(nos: number, arestas: number, pecas = 0): boolean {
  const partes = [
    nos > 0 && `${nos} localizador${nos > 1 ? 'es' : ''}`,
    arestas > 0 && `${arestas} transiç${arestas > 1 ? 'ões' : 'ão'}`,
    pecas > 0 && `${pecas} nota${pecas > 1 ? 's' : ''} ou entrada${pecas > 1 ? 's' : ''} por evento`,
  ].filter(Boolean);
  const extra = nos > 0 ? '\n\nAs transições ligadas a esses localizadores também saem.' : '';
  return window.confirm(`Apagar ${partes.join(' e ')}?${extra}`);
}
