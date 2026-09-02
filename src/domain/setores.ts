import { flagsPadrao, proximaCor, type DefinicaoFlag } from './flags';

/**
 * Setores da **unidade** — a lista de marcadores que vale para todos os planos
 * do silo (decisoes.md#D-26, emenda ao D-22).
 *
 * O que mudou em relação ao D-22: a lista deixou de ser vocabulário de um
 * desenho só e virou vocabulário da unidade, porque a pergunta que o usuário faz
 * — "o que o Setor de Cálculo trabalha aqui?" — atravessa planos, e sem id
 * compartilhado não há como cruzar.
 *
 * O que **não** mudou: a lista continua plana (setor e servidor são o mesmo tipo
 * de marcador), o nó continua guardando id, e a cor continua sendo índice.
 */
export const SETORES_VERSION = 1 as const;

export type SetoresVersion = typeof SETORES_VERSION;

export interface SetoresUnidade {
  version: SetoresVersion;
  itens: DefinicaoFlag[];
}

/** Com o que uma unidade sem lista gravada começa. */
export function setoresPadrao(): SetoresUnidade {
  return { version: SETORES_VERSION, itens: flagsPadrao() };
}

/**
 * Chave de deduplicação: minúsculas, sem acento, espaços colapsados. "Setor de
 * Cálculo", "SETOR DE CALCULO" e "setor  de  calculo" são o mesmo setor.
 *
 * A comparação é por rótulo, e não por sigla, porque a sigla é sugerida
 * automaticamente e não precisa ser única — dois setores distintos podem
 * legitimamente compartilhar "SC".
 */
export function normalizarRotulo(label: string): string {
  return label
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export interface FusaoSetores {
  itens: DefinicaoFlag[];
  /**
   * Id que entrou → id que sobreviveu. Só contém as entradas que **mudaram** de
   * id; quem casou consigo mesmo fica de fora, para o chamador poder decidir
   * pela existência de remapeamento sem comparar chave a chave.
   */
  remap: Map<string, string>;
}

/**
 * Funde uma lista que está chegando (o retrato guardado num plano) na lista
 * corrente da unidade. Pura.
 *
 * O sobrevivente é sempre quem já estava em `atual`: rótulo e cor da unidade
 * mandam, e um plano importado não repinta os chips de quem o abriu. Casa
 * primeiro por id — é o que faz os ids fixos `flag-espera`/`flag-fixo` casarem
 * sozinhos, sem depender de o rótulo nunca ter sido editado — e depois por
 * rótulo normalizado.
 */
export function fundirSetores(
  atual: readonly DefinicaoFlag[],
  entrando: readonly DefinicaoFlag[],
): FusaoSetores {
  const itens = [...atual];
  const remap = new Map<string, string>();

  const porId = new Map(itens.map((f) => [f.id, f]));
  const porRotulo = new Map(itens.map((f) => [normalizarRotulo(f.label), f]));

  for (const novo of entrando) {
    const porIdHit = porId.get(novo.id);
    if (porIdHit) continue;

    const chave = normalizarRotulo(novo.label);
    const porRotuloHit = porRotulo.get(chave);
    if (porRotuloHit) {
      remap.set(novo.id, porRotuloHit.id);
      continue;
    }

    // Entra como está, menos a cor: a paleta é da lista fundida, e repetir a
    // cor de um setor já existente tornaria os dois chips indistinguíveis.
    const item: DefinicaoFlag = { ...novo, cor: proximaCor(itens) };
    itens.push(item);
    porId.set(item.id, item);
    porRotulo.set(chave, item);
  }

  return { itens, remap };
}
