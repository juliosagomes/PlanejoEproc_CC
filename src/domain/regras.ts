import { hasAtpDetail, type AtpRule } from './atp';
import type { Subitem } from './subitems';

// A regra de ATP cresceu até espelhar a tela de cadastro do Eproc e ganhou
// pasta própria (decisoes.md#D-27). Reexportada daqui para que os imports de
// `@/domain` não mudem.
export * from './atp';

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
 * Predicado "tem detalhamento" da preferência — par do `hasAtpDetail`, que mora
 * em `./atp`. O **nome** e o **já criado** de propósito não contam: são do
 * recurso, e um recurso batizado ou marcado ainda não é um recurso modelado.
 */
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
