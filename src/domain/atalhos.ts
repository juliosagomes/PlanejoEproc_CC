/* ============================================================================
 * ATALHOS DE LOCALIZADOR (decisoes.md#D-30)
 *
 * Um atalho é um nó que **representa** outro localizador do mesmo plano — o
 * "continua em…" que evita puxar uma seta de um canto a outro do quadro. Não é
 * um localizador novo: não tem nome próprio (mostra o do alvo), não entra no
 * checklist, e a aresta que chega nele, ou sai dele, vale como aresta do alvo.
 *
 * Um nível só: atalho aponta para localizador, nunca para outro atalho. Quem
 * cria resolve isso na hora (`alvoReal`), então ninguém precisa seguir cadeia.
 * ========================================================================== */

interface NoLike {
  id: string;
  data: { nome: string; atalhoPara?: string };
}

export function ehAtalho(n: { data: { atalhoPara?: string } }): boolean {
  return typeof n.data.atalhoPara === 'string';
}

/**
 * O localizador que este nó representa: ele mesmo, ou o alvo do atalho.
 * `undefined` quando o nó não existe, ou é atalho cujo alvo foi apagado.
 */
export function noEfetivo<T extends NoLike>(nodes: readonly T[], id: string): T | undefined {
  const n = nodes.find((x) => x.id === id);
  if (!n || !ehAtalho(n)) return n;
  const alvo = nodes.find((x) => x.id === n.data.atalhoPara);
  return alvo && !ehAtalho(alvo) ? alvo : undefined;
}

/** Nome do localizador que o nó representa; vazio para atalho órfão. */
export function nomeEfetivo(nodes: readonly NoLike[], id: string): string {
  return noEfetivo(nodes, id)?.data.nome ?? '';
}

/** O alvo de verdade para um novo atalho: apontar para um atalho é apontar para o alvo dele. */
export function alvoReal(nodes: readonly NoLike[], id: string): string | undefined {
  return noEfetivo(nodes, id)?.id;
}

/** Ids dos atalhos que apontam para `alvoId`. */
export function atalhosPara(nodes: readonly NoLike[], alvoId: string): string[] {
  return nodes.filter((n) => n.data.atalhoPara === alvoId).map((n) => n.id);
}
