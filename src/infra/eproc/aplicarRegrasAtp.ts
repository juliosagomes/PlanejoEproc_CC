import type { CatalogoUnidade, FonteResultado, RegraAtpUnidade } from '@/domain';
import { parseRegraAtpDetalhe } from './parseRegraAtpDetalhe';
import { parseRegrasAtp } from './parseRegrasAtp';
import type { ColetaRegrasAtp, FonteBruta } from './tipos';

export interface RegrasAtpMontadas {
  /** Lista desta coleta; vazia quando a fonte não veio `ok`. */
  regras: RegraAtpUnidade[];
  resultado?: FonteResultado;
  /** Quantas regras ganharam detalhe nesta coleta. */
  detalhadas: number;
}

/**
 * A listagem desta coleta, com o detalhe de cada regra (decisoes.md#D-46).
 *
 * O detalhe **não trazido agora é mantido** do catálogo anterior, pelo nº:
 * sincronizar sem a caixa do detalhe completo não pode apagar o que foi lido
 * antes. Regra que saiu da listagem sai do catálogo, com o detalhe junto.
 */
export function montarRegrasAtp(
  lista: FonteBruta | undefined,
  detalhes: Record<string, string> | undefined,
  falhas: Record<string, string> | undefined,
  anteriores: RegraAtpUnidade[] | undefined,
  agora: string,
): RegrasAtpMontadas {
  if (!lista) return { regras: [], detalhadas: 0 };
  if (lista.status !== 'ok') {
    return {
      regras: [],
      detalhadas: 0,
      resultado: { status: lista.status, itens: 0, ...(lista.motivo ? { motivo: lista.motivo } : {}) },
    };
  }

  let regras: RegraAtpUnidade[];
  try {
    regras = lista.fragmentos.flatMap((f) => parseRegrasAtp(f));
  } catch (err) {
    return {
      regras: [],
      detalhadas: 0,
      resultado: { status: 'falhou', itens: 0, motivo: err instanceof Error ? err.message : String(err) },
    };
  }

  const antes = new Map((anteriores ?? []).map((r) => [r.numero, r]));
  const recusadas: number[] = Object.keys(falhas ?? {}).map(Number);
  let detalhadas = 0;

  regras = regras.map((regra) => {
    const fragmento = detalhes?.[regra.numero];
    if (fragmento) {
      try {
        const { regra: detalhe } = parseRegraAtpDetalhe(fragmento);
        detalhadas += 1;
        return { ...regra, detalhe, detalheEm: agora };
      } catch {
        recusadas.push(regra.numero);
      }
    }
    const velha = antes.get(regra.numero);
    return velha?.detalhe
      ? { ...regra, detalhe: velha.detalhe, ...(velha.detalheEm ? { detalheEm: velha.detalheEm } : {}) }
      : regra;
  });

  const motivo = recusadas.length
    ? `Sem o detalhe de ${recusadas.length} regra(s): ${recusadas.sort((a, b) => a - b).join(', ')}.`
    : undefined;
  return {
    regras,
    detalhadas,
    resultado: { status: regras.length ? 'ok' : 'vazio', itens: regras.length, ...(motivo ? { motivo } : {}) },
  };
}

/**
 * Atualiza o catálogo gravado com uma coleta só das regras, como a do botão
 * "Sincronizar esta regra". O resto do catálogo fica como está.
 */
export function aplicarRegrasAtpNoCatalogo(
  catalogo: CatalogoUnidade,
  coleta: ColetaRegrasAtp,
  agora: string = new Date().toISOString(),
): { catalogo: CatalogoUnidade; detalhadas: number; erro?: string } {
  const m = montarRegrasAtp(coleta.lista, coleta.detalhes, coleta.falhas, catalogo.regrasAtp, agora);
  if (m.resultado?.status !== 'ok') {
    return {
      catalogo,
      detalhadas: 0,
      erro: coleta.erro ?? m.resultado?.motivo ?? 'A listagem de regras de ATP não veio.',
    };
  }
  return {
    catalogo: {
      ...catalogo,
      regrasAtp: m.regras,
      fontes: { ...catalogo.fontes, regrasAtp: m.resultado },
    },
    detalhadas: m.detalhadas,
  };
}
