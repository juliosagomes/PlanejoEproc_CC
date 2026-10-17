import type { AcaoProgramada } from './acoes';
import { parametrosVazios } from './campos';
import type { AtpFiltros } from './filtros';
import type { AtpTrigger, ComportamentoOrigem, OpcaoMultiplosLocalizadores } from './gatilho';

export * from './campos';
export * from './gatilho';
export * from './acoes';
export * from './filtros';
export * from './conjuntos';
export * from './conjuntosEvento';
export * from './conjuntosPeticao';
export * from './conjuntosDocumento';

/**
 * O detalhamento de uma ATP, nos três blocos da tela de cadastro do Eproc:
 * Regras, Executar Ação e Filtros Opcionais (decisoes.md#D-27).
 *
 * **Não tem nome nem `ja_criado`**: os dois são do `Subitem` que a carrega
 * (decisoes.md#D-24). Os localizadores de origem e destino principais também
 * não estão aqui — são as pontas da aresta. Aqui ficam só os **outros**, que o
 * Eproc aceita na mesma regra e que não viram seta (decisoes.md#D-42).
 */
export interface AtpRule {
  /** Se `true`, a regra vira item próprio na seção "Regra de ATP" do checklist. */
  implantar: boolean;
  /** "Comportamento do Localizador ORIGEM". */
  comportamentoOrigem?: ComportamentoOrigem;
  /** Localizadores de origem além da ponta da aresta, por nome. */
  outrasOrigens?: string[];
  /** Condição "OU"/"E" entre as origens. Só vale com duas ou mais. */
  opcaoMultiplosLocalizadores?: OpcaoMultiplosLocalizadores;
  /** Localizadores de destino além da ponta da aresta, por nome. */
  outrosDestinos?: string[];
  /** Tipo de controle e seus campos. `undefined` até o usuário escolher. */
  trigger?: AtpTrigger;
  /** "Programar ação após execução da regra". Vazio ou ausente = não programa. */
  acoes?: AcaoProgramada[];
  filtros?: AtpFiltros;
  /** O único campo livre: o que não couber nos blocos acima. */
  observacoes?: string;
}

/**
 * Predicado "tem detalhamento", usado pela UI para destacar o botão "Detalhar"
 * e pela migração para não materializar regra em branco.
 *
 * O **nome** e o **já criado** de propósito não contam: são do recurso, e um
 * recurso batizado ou marcado ainda não é um recurso modelado. Filtro
 * adicionado e deixado vazio também não conta.
 */
export function hasAtpDetail(rule: AtpRule | undefined): boolean {
  if (!rule) return false;
  if (rule.implantar) return true;
  if (rule.comportamentoOrigem) return true;
  if ((rule.outrasOrigens?.length ?? 0) > 0) return true;
  if ((rule.outrosDestinos?.length ?? 0) > 0) return true;
  if (rule.trigger) return true;
  if ((rule.acoes?.length ?? 0) > 0) return true;
  if (rule.observacoes?.trim()) return true;
  if (rule.filtros && Object.values(rule.filtros).some((p) => !parametrosVazios(p))) {
    return true;
  }
  return false;
}
