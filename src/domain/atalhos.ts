/* ============================================================================
 * ATALHOS DE LOCALIZADOR (decisoes.md#D-30, D-40)
 *
 * Um atalho é um nó que **representa** outro localizador do mesmo plano — o
 * "continua em…" que evita puxar uma seta de um canto a outro do quadro. Não é
 * um localizador novo: não tem nome próprio (mostra o do alvo), não entra no
 * checklist, e a aresta que chega nele, ou sai dele, vale como aresta do alvo.
 *
 * Um nível só: atalho aponta para localizador, nunca para outro atalho. Quem
 * cria resolve isso na hora (`alvoReal`), então ninguém precisa seguir cadeia.
 *
 * O atalho para **outro plano** (D-40) é a mudança de fluxo: o processo sai
 * deste desenho e continua num localizador de outro. O alvo não está em
 * `nodes`, então o nó efetivo não existe aqui; o nome vem da referência.
 * ========================================================================== */

/**
 * Para onde aponta um atalho para outro plano. Os ids acham o destino no silo
 * onde o atalho foi ligado; os nomes são a reserva para quando os ids mudam —
 * importar um plano, ou baixá-lo do servidor, gera id novo.
 */
export interface RefOutroPlano {
  planoId: string;
  noId: string;
  planoNome: string;
  nome: string;
}

/** Atalho recém-criado, que ainda não aponta para lugar nenhum. */
export const REF_OUTRO_PLANO_VAZIA: RefOutroPlano = { planoId: '', noId: '', planoNome: '', nome: '' };

interface NoLike {
  id: string;
  data: { nome: string; atalhoPara?: string; atalhoOutroPlano?: RefOutroPlano };
}

export function ehAtalho(n: { data: { atalhoPara?: string; atalhoOutroPlano?: RefOutroPlano } }): boolean {
  return typeof n.data.atalhoPara === 'string' || n.data.atalhoOutroPlano !== undefined;
}

export function ehAtalhoOutroPlano(n: { data: { atalhoOutroPlano?: RefOutroPlano } }): boolean {
  return n.data.atalhoOutroPlano !== undefined;
}

/**
 * O localizador que este nó representa: ele mesmo, ou o alvo do atalho.
 * `undefined` quando o nó não existe, é atalho cujo alvo foi apagado, ou é
 * atalho para outro plano — o alvo dele não está nesta lista.
 */
export function noEfetivo<T extends NoLike>(nodes: readonly T[], id: string): T | undefined {
  const n = nodes.find((x) => x.id === id);
  if (!n || !ehAtalho(n)) return n;
  const alvo = nodes.find((x) => x.id === n.data.atalhoPara);
  return alvo && !ehAtalho(alvo) ? alvo : undefined;
}

/** Nome do localizador que o nó representa; vazio para atalho órfão. */
export function nomeEfetivo(nodes: readonly NoLike[], id: string): string {
  const externo = nodes.find((x) => x.id === id)?.data.atalhoOutroPlano;
  if (externo) return externo.nome;
  return noEfetivo(nodes, id)?.data.nome ?? '';
}

/** "Aguardando prazo (plano "Execuções")" — a ponta de seta que sai do desenho. */
export function rotuloOutroPlano(ref: RefOutroPlano): string {
  if (!ref.nome.trim() && !ref.planoNome.trim()) return '';
  return `${ref.nome.trim() || 'sem nome'} (plano "${ref.planoNome.trim() || 'sem nome'}")`;
}

/** O alvo de verdade para um novo atalho: apontar para um atalho é apontar para o alvo dele. */
export function alvoReal(nodes: readonly NoLike[], id: string): string | undefined {
  return noEfetivo(nodes, id)?.id;
}

/** Ids dos atalhos que apontam para `alvoId`. */
export function atalhosPara(nodes: readonly NoLike[], alvoId: string): string[] {
  return nodes.filter((n) => n.data.atalhoPara === alvoId).map((n) => n.id);
}

export interface PlanoComNos {
  id: string;
  plano: { planoNome: string; nodes: readonly NoLike[] };
}

/** Os localizadores de verdade de um plano: o que pode ser destino de atalho. */
export function destinosPossiveis<T extends NoLike>(nodes: readonly T[]): T[] {
  return nodes.filter((n) => !ehAtalho(n));
}

/**
 * Acha o destino de um atalho para outro plano entre os `planos` dados (que
 * não devem incluir o plano do próprio atalho). Primeiro pelos ids; se o plano
 * ou o nó não estão mais lá, pelos nomes — no plano do id e depois nos planos
 * com o nome de reserva. Devolve a referência atualizada, ou `null` se o
 * destino sumiu (atalho órfão).
 */
export function resolverOutroPlano(
  ref: RefOutroPlano,
  planos: readonly PlanoComNos[],
): RefOutroPlano | null {
  const nomePlano = ref.planoNome.trim();
  const nome = ref.nome.trim();
  const candidatos = [
    planos.find((p) => p.id === ref.planoId),
    ...(nomePlano ? planos.filter((p) => p.id !== ref.planoId && p.plano.planoNome.trim() === nomePlano) : []),
  ];
  for (const p of candidatos) {
    if (!p) continue;
    const nos = destinosPossiveis(p.plano.nodes);
    const n = nos.find((x) => x.id === ref.noId) ?? (nome ? nos.find((x) => x.data.nome.trim() === nome) : undefined);
    if (n) return { planoId: p.id, noId: n.id, planoNome: p.plano.planoNome, nome: n.data.nome };
  }
  return null;
}

export function mesmaRefOutroPlano(a: RefOutroPlano, b: RefOutroPlano): boolean {
  return a.planoId === b.planoId && a.noId === b.noId && a.planoNome === b.planoNome && a.nome === b.nome;
}
