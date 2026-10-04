import type { EdgeData } from './edges';
import type { AcaoPreferencialPlanejada } from './plano';

/* ============================================================================
 * AÇÕES PREFERENCIAIS DE UM LOCALIZADOR — TRÊS ORIGENS
 *
 * O painel do localizador junta numa lista só (decisoes.md#D-28):
 *
 *  - **Eproc**: o que a sincronização diz que já atua ali. Fato, só leitura.
 *  - **Planejada**: o que o usuário quer que atue ali. Plano, com ✓ de feito.
 *  - **ATP manual**: regras de ATP com gatilho "Por Ação Manual" nas arestas
 *    que **saem** do localizador. No Eproc elas aparecem como um botão para o
 *    servidor acionar estando no localizador de origem — o próprio cadastro
 *    tem a opção "ação preferencial na capa" —, então para quem trabalha a
 *    fila elas se comportam como ação preferencial. São derivadas, nunca
 *    gravadas: a fonte é a aresta.
 * ========================================================================== */

/** Régua de "mesma preferência": caixa e espaço, só — a mesma de `chaveAnotacao` (D-25). */
export function canonPreferencia(nome: string): string {
  return nome.replace(/\s+/g, ' ').trim().toLocaleUpperCase('pt-BR');
}

export interface AtpManualDoLocalizador {
  edgeId: string;
  subitemId: string;
  /** Nome do recurso; sem ele, a "Descrição da Regra" do gatilho. */
  nome: string;
  destinoId: string;
  ja_criado: boolean;
}

type ArestaLike = { id: string; source: string; target: string; data?: EdgeData };

export function atpsManuaisSaindo(
  nodeId: string,
  edges: readonly ArestaLike[],
): AtpManualDoLocalizador[] {
  const out: AtpManualDoLocalizador[] = [];
  for (const e of edges) {
    if (e.source !== nodeId || !e.data) continue;
    for (const s of e.data.subitems) {
      if (s.categoria !== 'Regra de ATP') continue;
      const trigger = s.atp?.trigger;
      if (trigger?.tipo !== 'M') continue;
      out.push({
        edgeId: e.id,
        subitemId: s.id,
        nome: s.nome.trim() || trigger.descricao?.trim() || '',
        destinoId: e.target,
        ja_criado: s.ja_criado,
      });
    }
  }
  return out;
}

export type LinhaAcaoPreferencial =
  | { origem: 'eproc'; nome: string }
  /** `tambemNoEproc`: o nome bate com um vínculo que a sincronização trouxe. */
  | { origem: 'planejada'; acao: AcaoPreferencialPlanejada; tambemNoEproc: boolean }
  | { origem: 'atp'; atp: AtpManualDoLocalizador };

/**
 * Junta as três origens. Uma planejada que bate com uma do Eproc aparece uma
 * vez só, como planejada marcada "também no Eproc" — duas linhas para o mesmo
 * vínculo fariam o usuário achar que há duas preferências.
 */
export function linhasAcoesPreferenciais(
  doEproc: readonly string[],
  planejadas: readonly AcaoPreferencialPlanejada[],
  atps: readonly AtpManualDoLocalizador[],
): LinhaAcaoPreferencial[] {
  const noEproc = new Set(doEproc.map(canonPreferencia));
  const planejadasCanon = new Set(planejadas.map((a) => canonPreferencia(a.nome)));
  return [
    ...doEproc
      .filter((nome) => !planejadasCanon.has(canonPreferencia(nome)))
      .map((nome): LinhaAcaoPreferencial => ({ origem: 'eproc', nome })),
    ...planejadas.map(
      (acao): LinhaAcaoPreferencial => ({
        origem: 'planejada',
        acao,
        tambemNoEproc: noEproc.has(canonPreferencia(acao.nome)),
      }),
    ),
    ...atps.map((atp): LinhaAcaoPreferencial => ({ origem: 'atp', atp })),
  ];
}
