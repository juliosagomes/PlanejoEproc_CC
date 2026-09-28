import type { Subitem } from './subitems';

/* ============================================================================
 * GATILHO DA REGRA DE ATP
 *
 * Os 9 valores espelham `selTipoControle.json` do Eproc. Ver `listas_json/`
 * para os rótulos completos. O payload de cada variante é mínimo e usa IDs
 * como `string[]` (Nível 2 de fidelidade): a estrutura espelha o Eproc, mas
 * os valores ficam livres até o catálogo ser embutido (Fase 6+).
 *
 * Mapa código -> rótulo curto (para a UI):
 *   A — Por Evento OU Tipo de Petição OU Documento
 *   E — Por Evento
 *   P — Por Tipo de Petição
 *   O — Por Documento
 *   D — Por Data ou Periodicamente
 *   L — Por Tempo no Localizador
 *   S — Por Tempo na Situação
 *   V — Verificação Processos Sem Movimentação
 *   M — Por Ação Manual
 * ========================================================================== */

export const TIPO_CONTROLE_VALUES = [
  'A',
  'E',
  'P',
  'O',
  'D',
  'L',
  'S',
  'V',
  'M',
] as const;

export type TipoControle = (typeof TIPO_CONTROLE_VALUES)[number];

export type AtpTrigger =
  | { tipo: 'A'; eventoIds?: string[]; peticaoTipoIds?: string[]; documentoTipoIds?: string[] }
  | { tipo: 'E'; eventoIds?: string[] }
  | { tipo: 'P'; peticaoTipoIds?: string[] }
  | { tipo: 'O'; documentoTipoIds?: string[] }
  | { tipo: 'D'; data?: string; periodicidadeDias?: number }
  | { tipo: 'L'; diasNoLocalizador?: number; localizadorIds?: string[] }
  | { tipo: 'S'; diasNaSituacao?: number; statusIds?: string[] }
  | { tipo: 'V'; diasSemMovimentacao?: number }
  | { tipo: 'M' };

/**
 * Filtros opcionais (Bloco 3 do Eproc).
 *
 * Ver decisoes.md#D-2: a UI expõe apenas um subset destes campos, mas o tipo
 * comporta o todo. Adicionar um filtro novo na UI **não exige refatoração de
 * tipo** — basta acrescentar o campo opcional aqui e o controle visual no
 * painel/modal.
 *
 * IDs são `string[]` por enquanto (placeholder). Quando o catálogo entrar,
 * podem virar `number[]` com tipo nominal. Ver decisoes.md#D-1.
 */
export interface AtpFiltros {
  classesJudiciaisIds?: string[];
  competenciaIds?: string[];
  statusProcessoIds?: string[];
}

/**
 * O detalhamento de uma ATP.
 *
 * **Não tem nome nem `ja_criado`**: os dois são do `Subitem` que a carrega
 * (decisoes.md#D-24). Duplicá-los daria dois campos para a mesma coisa — um na
 * linha da lista, outro no modal —, e eles divergiriam no primeiro descuido: o
 * checkbox do checklist mexe no do recurso, e só nele.
 */
export interface AtpRule {
  /** Se `true`, a regra vira item próprio na seção "Regra de ATP" do checklist. */
  implantar: boolean;
  /** Bloco 1 do Eproc — discriminado por `tipo`. Pode ficar `undefined` até o usuário escolher. */
  trigger?: AtpTrigger;
  /** Bloco 3 do Eproc. Ver decisoes.md#D-2. */
  filtros?: AtpFiltros;
  /**
   * Texto livre da modelagem hoje. Coexiste com `filtros` porque estruturar
   * condições em rule-builder está fora do escopo. Ver decisoes.md#D-3.
   */
  condicoes?: string;
  /**
   * Código do tipo de ação programada (catálogo `selTipoAcaoProgramada`).
   * É a "Ação" canônica do Eproc — ex.: 'CAR' (Citação por AR), 'CMA'
   * (Citação por Mandado). Coexiste com `acao` (descrição livre) — ver
   * decisoes.md#D-4.
   */
  acaoTipo?: string;
  /**
   * Descrição livre do efeito da regra (ex.: "lançar movimento X; intimar
   * a parte"). Suplementa `acaoTipo` com detalhes que o catálogo não cobre.
   */
  acao?: string;
  observacoes?: string;
}

export const PREF_TIPOS = ['Minuta', 'Movimentação', 'Intimação', 'Automatização'] as const;
export type PrefTipo = (typeof PREF_TIPOS)[number];

/**
 * Quando `tipo === 'Minuta'`, a preferência pode usar **um** Modelo ou **um**
 * Texto padrão como conteúdo (mutuamente exclusivos — ver glossário em
 * CLAUDE.md). Para os demais tipos esses campos são ignorados na UI; o dado
 * permanece em memória/storage para que o usuário não perca o que digitou ao
 * alternar `tipo` por engano.
 */
export type PrefMinutaModo = 'modelo' | 'texto_padrao';

/** Detalhamento de uma preferência. Sem nome e sem `ja_criado`, como `AtpRule`. */
export interface PrefRule {
  implantar: boolean;
  tipo?: PrefTipo;
  /** Efeito da preferência (texto livre). */
  acao?: string;
  observacoes?: string;
  /** Só relevante quando `tipo === 'Minuta'`. */
  minutaModo?: PrefMinutaModo;
  /** Conteúdo do Modelo ou Texto padrão (livre). */
  minutaConteudo?: string;
}

/**
 * Predicados "tem detalhamento" usados pela UI pra destacar o botão "Detalhar"
 * quando o usuário já preencheu algo. Conta qualquer campo significativo:
 * texto não-vazio (após `trim`), `tipo`/`trigger` escolhidos, listas de
 * filtros não-vazias, ou a flag `implantar` ativada.
 *
 * O **nome** e o **já criado** de propósito não contam: são do recurso, e um
 * recurso batizado ou marcado ainda não é um recurso modelado.
 */
export function hasAtpDetail(rule: AtpRule | undefined): boolean {
  if (!rule) return false;
  if (rule.implantar) return true;
  if (rule.trigger) return true;
  if (rule.acaoTipo) return true;
  if (rule.acao?.trim()) return true;
  if (rule.condicoes?.trim()) return true;
  if (rule.observacoes?.trim()) return true;
  const f = rule.filtros;
  if (f) {
    if ((f.classesJudiciaisIds?.length ?? 0) > 0) return true;
    if ((f.competenciaIds?.length ?? 0) > 0) return true;
    if ((f.statusProcessoIds?.length ?? 0) > 0) return true;
  }
  return false;
}

export function hasPrefDetail(rule: PrefRule | undefined): boolean {
  if (!rule) return false;
  if (rule.implantar) return true;
  if (rule.tipo) return true;
  if (rule.acao?.trim()) return true;
  if (rule.observacoes?.trim()) return true;
  if (rule.minutaModo) return true;
  if (rule.minutaConteudo?.trim()) return true;
  return false;
}

/**
 * União das regras possíveis. É o que `regraDoSubitem` devolve, e o que a UI
 * consome quando trata ATP e Preferência de modo polimórfico.
 */
export type EdgeRule =
  | { kind: 'atp'; rule: AtpRule }
  | { kind: 'pref'; rule: PrefRule };

/* ============================================================================
 * A regra como recurso da aresta (decisoes.md#D-24)
 *
 * Uma transição comporta mais de uma automação — duas ATPs, ou uma ATP e uma
 * preferência —, então a regra mora no `Subitem`, discriminada pela
 * `categoria` que já existia. Os três helpers abaixo são a única forma
 * autorizada de perguntar "este recurso é uma regra?", para que a
 * correspondência categoria ↔ campo não se espalhe pela UI.
 * ========================================================================== */

/** `true` quando a categoria do recurso comporta detalhamento de regra. */
export function ehRecursoRegra(s: Subitem): boolean {
  return s.categoria === 'Regra de ATP' || s.categoria === 'Preferência';
}

/**
 * A regra guardada no recurso, junto do `kind` que diz qual é. `undefined`
 * para recurso de categoria comum (Modelo, Texto padrão, Outro), e também
 * para um recurso-regra ainda sem detalhamento nenhum.
 */
export function regraDoSubitem(s: Subitem): EdgeRule | undefined {
  if (s.categoria === 'Regra de ATP') {
    return s.atp ? { kind: 'atp', rule: s.atp } : undefined;
  }
  if (s.categoria === 'Preferência') {
    return s.pref ? { kind: 'pref', rule: s.pref } : undefined;
  }
  return undefined;
}

/** Espelha `hasAtpDetail`/`hasPrefDetail` para um recurso qualquer. */
export function hasDetalheSubitem(s: Subitem): boolean {
  if (s.categoria === 'Regra de ATP') return hasAtpDetail(s.atp);
  if (s.categoria === 'Preferência') return hasPrefDetail(s.pref);
  return false;
}
