import type {
  CatalogoUnidade,
  FonteId,
  FonteResultado,
  LocalizadorUnidade,
} from '@/domain';
import { montarUnidade } from './escopoUnidade';
import { anexarIds, deduplicar, montarCatalogoUnidade } from './montarCatalogo';
import { parseLocalizadorOrgao } from './parseLocalizadorOrgao';
import { parseSelectLocalizadores } from './parseSelectLocalizadores';
import type { ColetaUnidade, FonteBruta } from './tipos';

/**
 * Transforma o bruto que veio da aba do Eproc no catálogo do domínio.
 *
 * Roda no lado da página, não no coletor — é aqui que os parsers testados
 * existem. Princípio que governa o tratamento de erro: **resultado parcial é
 * sucesso**. Uma tela que o perfil do usuário não alcança vira um status de
 * fonte, não uma exceção; só a falta da listagem do órgão (a fonte principal) ou
 * a impossibilidade de identificar a unidade impedem gravar.
 */
export interface ResumoColeta {
  /** Localizadores gravados, já sem os de sistema. */
  localizadores: number;
  ignoradosSistema: number;
  /** Quantos casaram com um id do Eproc vindo do `<select>`. */
  comId: number;
  duplicados: number;
}

export type ResultadoColeta =
  | { ok: true; catalogo: CatalogoUnidade; resumo: ResumoColeta }
  | { ok: false; erro: string };

function resultadoDeFonte(bruta: FonteBruta | undefined, itens: number): FonteResultado {
  if (!bruta) return { status: 'falhou', motivo: 'Fonte não coletada.' };
  return {
    status: bruta.status,
    itens,
    ...(bruta.motivo ? { motivo: bruta.motivo } : {}),
  };
}

export function aplicarColeta(coleta: ColetaUnidade, agora?: string): ResultadoColeta {
  if (coleta.erro) return { ok: false, erro: coleta.erro };

  if (!coleta.escopo) {
    return {
      ok: false,
      erro:
        'Não consegui identificar em qual unidade você está. Abra uma tela normal ' +
        'do Eproc (o painel, por exemplo) e tente de novo.',
    };
  }

  const unidade = montarUnidade(coleta.host, coleta.escopo);
  if (!unidade) {
    return {
      ok: false,
      erro:
        'Não consegui ler seu login e a sigla da unidade na tela do Eproc. ' +
        'Sem os dois, gravar o catálogo misturaria unidades diferentes.',
    };
  }

  const fontes: Partial<Record<FonteId, FonteResultado>> = {};

  /* --- listagem do órgão: a fonte principal ------------------------------- */

  const brutaOrgao = coleta.fontes.localizadoresOrgao;
  let daListagem: LocalizadorUnidade[] = [];
  let ignoradosSistema = 0;

  if (brutaOrgao?.status === 'ok') {
    try {
      for (const fragmento of brutaOrgao.fragmentos) {
        const r = parseLocalizadorOrgao(fragmento);
        daListagem = daListagem.concat(r.itens);
        ignoradosSistema += r.ignoradosSistema;
      }
    } catch (err) {
      return {
        ok: false,
        erro:
          'A tela de Localizadores do Órgão veio num formato que não reconheço. ' +
          (err instanceof Error ? err.message : String(err)),
      };
    }
  } else {
    return {
      ok: false,
      erro:
        brutaOrgao?.motivo ??
        'Não consegui abrir a tela "Localizadores do Órgão" com este perfil.',
    };
  }

  /* --- <select>: só para anexar os ids ------------------------------------ */

  const brutaSelect = coleta.fontes.catalogoSelect;
  const doSelect =
    brutaSelect?.status === 'ok'
      ? brutaSelect.fragmentos.flatMap((f) => parseSelectLocalizadores(f))
      : [];

  const semDuplicados = deduplicar(daListagem);
  const { itens, casados } = anexarIds(semDuplicados.itens, doSelect);

  fontes.localizadoresOrgao = resultadoDeFonte(brutaOrgao, itens.length);
  fontes.catalogoSelect = resultadoDeFonte(brutaSelect, doSelect.length);

  return {
    ok: true,
    catalogo: montarCatalogoUnidade({
      unidade,
      localizadores: itens,
      fontes,
      ...(agora ? { agora } : {}),
    }),
    resumo: {
      localizadores: itens.length,
      ignoradosSistema,
      comId: casados,
      duplicados: semDuplicados.duplicados,
    },
  };
}
