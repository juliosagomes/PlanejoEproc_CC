import type {
  CatalogoUnidade,
  FonteId,
  FonteResultado,
  ItemCatalogoUnidade,
  LocalizadorUnidade,
} from '@/domain';
import { montarUnidade } from './escopoUnidade';
import { anexarIds, deduplicar, montarCatalogoUnidade } from './montarCatalogo';
import { parseModeloPadrao, parseTextoPadrao } from './parseListasSimples';
import { parseLocalizadorOrgao } from './parseLocalizadorOrgao';
import { montarPreferencias, parsePreferenciasXml } from './parsePreferencias';
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
  modelos: number;
  textosPadrao: number;
  preferencias: number;
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

  /* --- listas acessórias: falham sem derrubar a coleta -------------------- */

  const modelos = parseAcessoria(coleta, 'modelos', parseModeloPadrao, fontes);
  const textosPadrao = parseAcessoria(coleta, 'textosPadrao', parseTextoPadrao, fontes);
  const preferencias = aplicarPreferencias(coleta, fontes);

  return {
    ok: true,
    catalogo: montarCatalogoUnidade({
      unidade,
      localizadores: itens,
      fontes,
      ...(modelos.length > 0 ? { modelos } : {}),
      ...(textosPadrao.length > 0 ? { textosPadrao } : {}),
      ...(preferencias.length > 0 ? { preferencias } : {}),
      ...(agora ? { agora } : {}),
    }),
    resumo: {
      localizadores: itens.length,
      ignoradosSistema,
      comId: casados,
      duplicados: semDuplicados.duplicados,
      modelos: modelos.length,
      textosPadrao: textosPadrao.length,
      preferencias: preferencias.length,
    },
  };
}

/**
 * Preferências têm caminho próprio porque o **tipo** de cada fragmento não está
 * dentro do XML — vem em `rotulos`, paralelo a `fragmentos`. Sem esse
 * pareamento, as 150 preferências viriam sem distinguir Minuta de Intimação.
 */
function aplicarPreferencias(
  coleta: ColetaUnidade,
  fontes: Partial<Record<FonteId, FonteResultado>>,
): ItemCatalogoUnidade[] {
  const bruta = coleta.fontes.preferencias;
  if (!bruta || bruta.status !== 'ok') {
    if (bruta) fontes.preferencias = resultadoDeFonte(bruta, 0);
    return [];
  }

  try {
    const porTipo = bruta.fragmentos.map((xml, i) =>
      parsePreferenciasXml(xml, bruta.rotulos?.[i] ?? 'Preferência'),
    );
    const itens = montarPreferencias(porTipo);
    fontes.preferencias = resultadoDeFonte(bruta, itens.length);
    return itens;
  } catch (err) {
    fontes.preferencias = {
      status: 'falhou',
      itens: 0,
      motivo: err instanceof Error ? err.message : String(err),
    };
    return [];
  }
}

/**
 * Lista acessória: um formato inesperado vira status de fonte, não exceção.
 *
 * A assimetria com a listagem do órgão é deliberada. Sem localizadores o
 * catálogo não tem razão de existir, então ali a falha é fatal; sem modelos ele
 * continua útil, e derrubar a coleta inteira porque um tribunal mudou uma coluna
 * da tela de modelos seria desproporcional.
 */
function parseAcessoria(
  coleta: ColetaUnidade,
  fonte: 'modelos' | 'textosPadrao',
  parser: (fragmento: string) => ItemCatalogoUnidade[],
  fontes: Partial<Record<FonteId, FonteResultado>>,
): ItemCatalogoUnidade[] {
  const bruta = coleta.fontes[fonte];
  if (!bruta || bruta.status !== 'ok') {
    if (bruta) fontes[fonte] = resultadoDeFonte(bruta, 0);
    return [];
  }

  try {
    const vistos = new Set<string>();
    const itens: ItemCatalogoUnidade[] = [];
    for (const fragmento of bruta.fragmentos) {
      for (const item of parser(fragmento)) {
        // Preferências não têm código do Eproc; o nome normalizado é a
        // identidade possível. Modelos e textos usam o código, que é estável.
        const chave = item.eprocId ?? item.nome.replace(/\s+/g, ' ').trim().toUpperCase();
        if (vistos.has(chave)) continue;
        vistos.add(chave);
        itens.push(item);
      }
    }
    fontes[fonte] = resultadoDeFonte(bruta, itens.length);
    return itens;
  } catch (err) {
    fontes[fonte] = {
      status: 'falhou',
      itens: 0,
      motivo: err instanceof Error ? err.message : String(err),
    };
    return [];
  }
}
