import { useMemo } from 'react';
import type { LocalizadorOrgao } from '@/domain';
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
