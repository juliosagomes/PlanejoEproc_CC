import { useMemo } from 'react';
import { localizadoresDaUnidade, type LocalizadorDaUnidade, type OrigemFila } from '@/domain';
import type { Sugestao } from '@/components/SugestoesInput';
import { useCanvasStore } from '@/features/canvas/store';
import { useUnidadeStore } from '@/features/catalogo/storeUnidade';
import { getAtivoId, listPlanos, loadPlano } from '@/infra/storage';

/**
 * Os localizadores de todos os planos do silo, com o ativo trocado pela versão
 * viva da store — o mesmo cuidado do `SetoresModal`: o gravado pode estar até
 * 300 ms atrás e não conhecer a marcação que o usuário acabou de fazer.
 */
export function useLocalizadoresDaUnidade(): LocalizadorDaUnidade[] {
  const nodes = useCanvasStore((s) => s.nodes);
  return useMemo(() => {
    const ativoId = getAtivoId();
    const planos = listPlanos().map((e) =>
      e.id === ativoId ? useCanvasStore.getState().getPlano() : loadPlano(e.id),
    );
    if (ativoId === null) planos.push(useCanvasStore.getState().getPlano());
    return localizadoresDaUnidade(planos);
    // `nodes` não é lido aqui, mas é o que muda quando uma marcação muda.
  }, [nodes]);
}

/**
 * O autocompletar do Eproc chama a tela de consulta de processos de
 * `processo_movimento_consultar`, e o coletor rotula esse tipo assim (D-16).
 */
const TIPO_PREFERENCIA_CONSULTA = 'Movimentação';

/**
 * Nomes que a sincronização com a unidade trouxe, para a origem escolhida. São
 * só sugestão: a unidade é quem diz qual fila pertence a qual setor e grupo.
 */
export function useSugestoesFila(origem: OrigemFila): Sugestao[] {
  const catalogo = useUnidadeStore((s) => s.catalogo);
  return useMemo(() => {
    if (!catalogo) return [];
    const nomes =
      origem === 'preferencia'
        ? (catalogo.preferencias ?? [])
            .filter((p) => p.detalhe === TIPO_PREFERENCIA_CONSULTA)
            .map((p) => p.nome)
        : (catalogo.consultasSalvas ?? []).filter((c) => c.tela === origem).map((c) => c.nome);
    return [...new Set(nomes)]
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .map((valor) => ({ valor }));
  }, [catalogo, origem]);
}
