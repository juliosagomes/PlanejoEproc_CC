import { useMemo } from 'react';
import {
  ORIGENS_FILA,
  ORIGENS_FILA_NOVA,
  localizadoresDaUnidade,
  type LocalizadorDaUnidade,
  type OrigemFila,
} from '@/domain';
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

export interface SugestaoFila extends Sugestao {
  origem: OrigemFila;
}

/**
 * Tudo o que a sincronização com a unidade trouxe e pode virar fila: as
 * consultas salvas das telas de relatório que a fila oferece (D-32) e as preferências de
 * consulta. Cada uma diz de onde vem, e escolhê-la acerta o "Onde fica" — a
 * lista não depende de o usuário ter escolhido a origem antes.
 *
 * São só sugestão: a unidade é quem diz qual fila pertence a qual setor e grupo.
 */
export function useSugestoesFila(): SugestaoFila[] {
  const catalogo = useUnidadeStore((s) => s.catalogo);
  return useMemo(() => {
    if (!catalogo) return [];
    const vistas = new Set<string>();
    const itens: SugestaoFila[] = [];
    const por = (valor: string, origem: OrigemFila) => {
      const chave = `${origem}::${valor}`;
      if (vistas.has(chave)) return;
      vistas.add(chave);
      itens.push({ valor, origem, detalhe: ORIGENS_FILA[origem] });
    };
    for (const c of catalogo.consultasSalvas ?? []) {
      if (ORIGENS_FILA_NOVA.includes(c.tela)) por(c.nome, c.tela);
    }
    for (const p of catalogo.preferencias ?? []) {
      if (p.detalhe === TIPO_PREFERENCIA_CONSULTA) por(p.nome, 'preferencia');
    }
    return itens.sort((a, b) => a.valor.localeCompare(b.valor, 'pt-BR'));
  }, [catalogo]);
}
