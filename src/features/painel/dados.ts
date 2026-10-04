import { useMemo } from 'react';
import {
  ORIGENS_FILA,
  ehTelaFila,
  localizadoresDaUnidade,
  type LocalizadorDaUnidade,
  type TelaFila,
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

export interface SugestaoFila extends Sugestao {
  origem: TelaFila;
  /** Grupo de preferências da consulta no Eproc, quando a sincronização o trouxe. */
  grupo?: string;
}

/**
 * As consultas salvas que a sincronização trouxe das três telas de fila
 * (D-32/D-37). Cada uma diz de onde vem, e escolhê-la acerta o "Onde fica" e o
 * grupo — a lista não depende de o usuário ter escolhido a origem antes.
 *
 * São só sugestão: a unidade é quem diz qual fila pertence a qual setor e grupo.
 */
export function useSugestoesFila(): SugestaoFila[] {
  const catalogo = useUnidadeStore((s) => s.catalogo);
  return useMemo(() => {
    if (!catalogo) return [];
    const vistas = new Set<string>();
    const itens: SugestaoFila[] = [];
    for (const c of catalogo.consultasSalvas ?? []) {
      if (!ehTelaFila(c.tela)) continue;
      const chave = `${c.tela}::${c.nome}`;
      if (vistas.has(chave)) continue;
      vistas.add(chave);
      itens.push({
        valor: c.nome,
        origem: c.tela,
        detalhe: c.grupo ? `${ORIGENS_FILA[c.tela]} · ${c.grupo}` : ORIGENS_FILA[c.tela],
        ...(c.grupo ? { grupo: c.grupo } : {}),
      });
    }
    return itens.sort((a, b) => a.valor.localeCompare(b.valor, 'pt-BR'));
  }, [catalogo]);
}

/**
 * Os nomes de grupo de preferências que a sincronização viu, nas consultas e
 * nas preferências. Viram opção nos seletores de grupo do painel (D-37).
 */
export function useGruposDoEproc(): string[] {
  const catalogo = useUnidadeStore((s) => s.catalogo);
  return useMemo(() => {
    if (!catalogo) return [];
    const nomes = new Set<string>();
    for (const c of catalogo.consultasSalvas ?? []) if (c.grupo) nomes.add(c.grupo);
    for (const p of catalogo.preferencias ?? []) if (p.grupo) nomes.add(p.grupo);
    return [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [catalogo]);
}
