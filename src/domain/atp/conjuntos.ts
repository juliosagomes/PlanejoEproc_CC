/* ============================================================================
 * CONJUNTOS (decisoes.md#D-29, estendido no D-41)
 *
 * Três catálogos da regra de ATP são grandes demais para chips: eventos (1.077),
 * tipos de documento (760) e tipos de petição (128). Uma regra do tipo
 * "qualquer evento, exceto os de mera ciência" seleciona mais de mil deles, e o
 * modal virava uma parede de chips. Conjunto é um **atalho de seleção e de
 * leitura**: o plano continua gravando a lista explícita de códigos (é ela que
 * se marca no Eproc), e o conjunto só ajuda a montá-la e a descrevê-la.
 *
 * Os conjuntos padrão são **regras sobre o rótulo**, e não listas de códigos: o
 * catálogo embutido muda de versão e de tribunal, e uma regra continua valendo
 * para o item novo que siga a mesma redação. As regras de cada catálogo moram
 * em arquivo próprio (`conjuntosEvento.ts`, `conjuntosPeticao.ts`,
 * `conjuntosDocumento.ts`); aqui fica o que é comum aos três.
 * ========================================================================== */

/** Os catálogos que têm conjuntos. Os nomes são os mesmos de `CatalogoId`. */
export const CATALOGOS_COM_CONJUNTO = ['eventos', 'tiposPeticao', 'documentos'] as const;

export type CatalogoConjunto = (typeof CATALOGOS_COM_CONJUNTO)[number];

export function temConjuntos(catalogo: string): catalogo is CatalogoConjunto {
  return (CATALOGOS_COM_CONJUNTO as readonly string[]).includes(catalogo);
}

export interface RegraConjunto {
  id: string;
  rotulo: string;
  /** Ausente nos catálogos de lista plana. */
  categoria?: string;
  /** Uma frase para o usuário saber o critério sem abrir a lista. */
  descricao: string;
  /** Casam com o rótulo **normalizado** (`normalizarRotuloCatalogo`). */
  inclui: readonly RegExp[];
  exclui?: readonly RegExp[];
}

/**
 * Sem acento e em minúsculas. A redação dos catálogos é inconsistente —
 * "Decisao/Despacho", "prisao", "NAO-PERSECUÇAO", caixa alta ao lado de caixa
 * baixa —, e regra com acento erraria metade dos casos.
 */
export function normalizarRotuloCatalogo(rotulo: string): string {
  return rotulo.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();
}

/** Conjunto já resolvido contra um catálogo — padrão ou criado pelo usuário. */
export interface Conjunto {
  id: string;
  rotulo: string;
  categoria?: string;
  descricao?: string;
  ids: readonly string[];
  personalizado: boolean;
}

interface ItemCatalogo {
  value: string;
  label: string;
}

export function resolverConjuntosPadrao(
  itens: readonly ItemCatalogo[],
  regras: readonly RegraConjunto[],
): Conjunto[] {
  const normalizados = itens.map((e) => ({ id: e.value, rotulo: normalizarRotuloCatalogo(e.label) }));
  return regras.map((r) => ({
    id: r.id,
    rotulo: r.rotulo,
    ...(r.categoria ? { categoria: r.categoria } : {}),
    descricao: r.descricao,
    personalizado: false,
    ids: normalizados
      .filter(
        (e) =>
          r.inclui.some((re) => re.test(e.rotulo)) && !(r.exclui ?? []).some((re) => re.test(e.rotulo)),
      )
      .map((e) => e.id),
  }));
}

/* ============================================================================
 * RESUMO DE UMA SELEÇÃO
 * ========================================================================== */

/**
 * Até quantas peças (conjuntos + itens avulsos) a forma "Todos − x, y, z" ainda
 * se lê de relance. Acima disso, a exclusão deixa de ser resumo e vira lista.
 */
export const LIMITE_EXCLUSAO = 5;

export type ResumoSelecao =
  | { modo: 'vazio' }
  | { modo: 'todos'; total: number }
  /** A seleção é a união de `conjuntos` mais os `avulsos`. */
  | { modo: 'inclusao'; conjuntos: Conjunto[]; avulsos: string[]; total: number }
  /** A seleção é tudo, menos os `conjuntos` e menos os `avulsos`. */
  | { modo: 'exclusao'; conjuntos: Conjunto[]; avulsos: string[]; total: number };

/**
 * Cobre `alvo` com conjuntos inteiramente contidos nele, maiores primeiro; o
 * que sobra vira avulso. Guloso, e não ótimo — mas a pergunta aqui é "como
 * dizer isto em poucas palavras", não um problema de cobertura exata.
 */
function cobrir(alvo: ReadonlySet<string>, conjuntos: readonly Conjunto[]) {
  const candidatos = conjuntos
    .filter((c) => c.ids.length > 0 && c.ids.every((id) => alvo.has(id)))
    .sort((a, b) => b.ids.length - a.ids.length);
  const coberto = new Set<string>();
  const escolhidos: Conjunto[] = [];
  for (const c of candidatos) {
    if (c.ids.every((id) => coberto.has(id))) continue;
    escolhidos.push(c);
    for (const id of c.ids) coberto.add(id);
  }
  const avulsos = [...alvo].filter((id) => !coberto.has(id));
  return { escolhidos, avulsos };
}

/**
 * Descreve a seleção pelo caminho mais curto: "estes conjuntos e mais estes
 * itens", ou "tudo, exceto estes conjuntos e estes itens". A exclusão vence
 * quando cabe em `LIMITE_EXCLUSAO` peças e não é mais longa que a inclusão —
 * no empate, ela: "todos menos um" se lê melhor que a lista do que sobrou.
 *
 * Ids fora do `universo` (item que saiu do catálogo) entram como avulsos da
 * inclusão: sumir com eles esconderia algo gravado no plano.
 */
export function resumirSelecao(
  selecionados: readonly string[],
  universo: readonly string[],
  conjuntos: readonly Conjunto[],
): ResumoSelecao {
  const sel = new Set(selecionados);
  if (sel.size === 0) return { modo: 'vazio' };
  const todos = new Set(universo);
  const foraDoUniverso = [...sel].filter((id) => !todos.has(id));
  if (foraDoUniverso.length === 0 && universo.every((id) => sel.has(id))) {
    return { modo: 'todos', total: sel.size };
  }

  const inc = cobrir(sel, conjuntos);
  const resumoInc = {
    modo: 'inclusao' as const,
    conjuntos: inc.escolhidos,
    avulsos: inc.avulsos,
    total: sel.size,
  };
  if (foraDoUniverso.length > 0) return resumoInc;

  const complemento = new Set(universo.filter((id) => !sel.has(id)));
  const exc = cobrir(complemento, conjuntos);
  const custoExc = exc.escolhidos.length + exc.avulsos.length;
  const custoInc = inc.escolhidos.length + inc.avulsos.length;
  if (custoExc <= LIMITE_EXCLUSAO && custoExc <= custoInc) {
    return { modo: 'exclusao', conjuntos: exc.escolhidos, avulsos: exc.avulsos, total: sel.size };
  }
  return resumoInc;
}

/* ============================================================================
 * CONJUNTOS PERSONALIZADOS (da unidade)
 * ========================================================================== */

export const CONJUNTOS_VERSION = 1 as const;

export interface ConjuntoPersonalizado {
  id: string;
  rotulo: string;
  ids: string[];
}

/**
 * A lista é da **unidade** — uma chave por silo e por catálogo, como os setores
 * (D-26) —, e não do plano: o plano já grava os códigos explícitos, então o
 * conjunto é só um atalho de quem monta a regra, e não precisa viajar com ele.
 */
export interface ConjuntosUnidade {
  version: typeof CONJUNTOS_VERSION;
  itens: ConjuntoPersonalizado[];
}
