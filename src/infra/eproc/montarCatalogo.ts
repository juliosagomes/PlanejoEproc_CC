import {
  CATALOGO_UNIDADE_VERSION,
  type CatalogoUnidade,
  type FonteId,
  type FonteResultado,
  type LocalizadorUnidade,
  type UnidadeEproc,
} from '@/domain';
import { semDecoracao } from './nomeLocalizador';
import type { OpcaoLocalizador } from './parseSelectLocalizadores';

/**
 * Junta as duas fontes de localizador num catálogo só.
 *
 * A listagem do órgão manda: ela é o conjunto da unidade, e é a única que traz a
 * flag de sistema, a descrição e o total de processos. O `<select>` entra só
 * para anexar o **id do Eproc** — ele lista bem mais coisa (431 opções contra
 * 179 localizadores do órgão numa unidade real), e o excedente é ignorado de
 * propósito.
 *
 * O casamento é por sigla canonizada. Casar por nome não serviria: em 67 dos 431
 * localizadores reais a sigla difere do nome, e é a sigla que aparece nas duas
 * telas na mesma coluna conceitual.
 */
export function anexarIds(
  daListagem: LocalizadorUnidade[],
  doSelect: OpcaoLocalizador[],
): { itens: LocalizadorUnidade[]; casados: number } {
  const porSigla = new Map<string, string>();
  for (const opcao of doSelect) {
    const chave = semDecoracao(opcao.sigla);
    if (!chave || porSigla.has(chave)) continue;
    porSigla.set(chave, opcao.eprocId);
  }

  let casados = 0;
  const itens = daListagem.map((item) => {
    const eprocId = porSigla.get(semDecoracao(item.sigla));
    if (!eprocId) return item;
    casados += 1;
    return { ...item, eprocId };
  });

  return { itens, casados };
}

/** Deduplica por sigla canonizada, preservando a ordem de chegada. */
export function deduplicar(itens: LocalizadorUnidade[]): {
  itens: LocalizadorUnidade[];
  duplicados: number;
} {
  const vistos = new Set<string>();
  const saida: LocalizadorUnidade[] = [];
  let duplicados = 0;

  for (const item of itens) {
    const chave = semDecoracao(item.sigla);
    if (chave && vistos.has(chave)) {
      duplicados += 1;
      continue;
    }
    if (chave) vistos.add(chave);
    saida.push(item);
  }

  return { itens: saida, duplicados };
}

export interface MontagemCatalogo {
  unidade: UnidadeEproc;
  localizadores: LocalizadorUnidade[];
  fontes: Partial<Record<FonteId, FonteResultado>>;
  /** Injetável para teste; padrão é agora. */
  agora?: string;
}

export function montarCatalogoUnidade(m: MontagemCatalogo): CatalogoUnidade {
  return {
    version: CATALOGO_UNIDADE_VERSION,
    unidade: m.unidade,
    coletadoEm: m.agora ?? new Date().toISOString(),
    localizadores: m.localizadores,
    fontes: m.fontes,
  };
}
