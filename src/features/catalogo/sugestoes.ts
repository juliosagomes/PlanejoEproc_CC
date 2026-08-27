import { useMemo } from 'react';
import type {
  ItemCatalogoUnidade,
  LocalizadorOrgao,
  SubitemCategoria,
} from '@/domain';
import { semDecoracao } from '@/infra/eproc/nomeLocalizador';
import { selectItens, useCatalogoStore } from './store';
import { selectLocalizadoresUnidade, useUnidadeStore } from './storeUnidade';

/**
 * Sugestões de nome de localizador: a união dos dois catálogos.
 *
 * Existem dois porque um não substitui o outro. O da unidade é automático e
 * completo, mas exige extensão instalada, Eproc aberto e sessão viva; o do XLS
 * é manual, porém funciona offline e em qualquer máquina. Manter os dois é o que
 * preserva a promessa de que o app roda offline (CLAUDE.md).
 *
 * Em colisão, a **unidade vence**: ela veio do sistema agora, enquanto o XLS
 * pode ser um export de meses atrás.
 *
 * O rótulo exibido é a **sigla**, e não o nome por extenso, por dois motivos:
 * é o que o Eproc mostra nas telas onde o usuário escolhe localizador, e é o que
 * o parser do XLS já vinha gravando em `nome` (coluna "Localizador"). Trocar
 * agora mudaria em silêncio o texto dos planos existentes.
 */
export function useSugestoesLocalizador(): LocalizadorOrgao[] {
  const doXls = useCatalogoStore(selectItens);
  const daUnidade = useUnidadeStore(selectLocalizadoresUnidade);

  return useMemo(() => {
    const saida: LocalizadorOrgao[] = daUnidade.map((l) => ({
      id: l.eprocId ?? `un-${l.sigla}`,
      nome: l.sigla,
      ...(l.descricao ? { descricao: l.descricao } : {}),
    }));

    const vistos = new Set(saida.map((i) => semDecoracao(i.nome)));
    for (const item of doXls) {
      const chave = semDecoracao(item.nome);
      if (chave && vistos.has(chave)) continue;
      if (chave) vistos.add(chave);
      saida.push(item);
    }

    return saida.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [doXls, daUnidade]);
}

export interface SugestaoSubitem {
  nome: string;
  /** Tipo de documento (modelos) ou sigla auto-texto (textos padrão). */
  detalhe?: string;
  /** Preenchido só quando o item pertence a outra unidade. */
  outroOrgao?: string;
}

/**
 * Sugestões para o campo "nome" de um subitem, conforme a categoria.
 *
 * Só as categorias que têm catálogo coletado respondem. `Preferência` e
 * `Regra de ATP` devolvem lista vazia por enquanto — a tela de preferências
 * ainda não foi mapeada, e as ATPs estão fora de escopo.
 *
 * Itens de **outras unidades** aparecem, mas depois dos da unidade do usuário e
 * marcados com a sigla do órgão dono. As telas do Eproc listam os dois, e um
 * modelo público de outra vara pode ser utilizável — escondê-los seria decidir
 * pelo usuário; misturá-los sem marca seria pior.
 */
export function useSugestoesSubitem(categoria: SubitemCategoria): SugestaoSubitem[] {
  const catalogo = useUnidadeStore((s) => s.catalogo);

  return useMemo(() => {
    if (!catalogo) return [];
    const fonte: ItemCatalogoUnidade[] | undefined =
      categoria === 'Modelo'
        ? catalogo.modelos
        : categoria === 'Texto padrão'
          ? catalogo.textosPadrao
          : categoria === 'Preferência'
            ? catalogo.preferencias
            : undefined;
    if (!fonte) return [];

    const daUnidade = catalogo.unidade.sigla;
    return fonte
      .map<SugestaoSubitem>((item) => ({
        nome: item.nome,
        ...(item.detalhe ? { detalhe: item.detalhe } : {}),
        ...(item.orgao && item.orgao !== daUnidade ? { outroOrgao: item.orgao } : {}),
      }))
      .sort((a, b) => {
        const proprio = Number(!!a.outroOrgao) - Number(!!b.outroOrgao);
        return proprio !== 0 ? proprio : a.nome.localeCompare(b.nome, 'pt-BR');
      });
  }, [catalogo, categoria]);
}
