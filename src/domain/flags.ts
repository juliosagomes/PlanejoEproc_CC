/**
 * Flags de tipo do localizador.
 *
 * Hardcoded por enquanto — quatro flags fixas (T, E, G, F). Lista editável pelo
 * usuário é decisão futura, não pertence ao escopo da migração.
 */

export interface TipoFlag {
  /** Letra exibida no chip (1 caractere). */
  readonly code: 'T' | 'E' | 'G' | 'F';
  /** Chave usada nas estruturas `FlagsLocalizador`. */
  readonly key: 'trabalhado' | 'espera' | 'gatilho' | 'fixo';
  /** Rótulo legível para a UI. */
  readonly label: string;
}

export const TIPO_FLAGS = [
  { code: 'T', key: 'trabalhado', label: 'Trabalhado' },
  { code: 'E', key: 'espera', label: 'Espera' },
  { code: 'G', key: 'gatilho', label: 'Gatilho' },
  { code: 'F', key: 'fixo', label: 'Fixo de fluxo' },
] as const satisfies readonly TipoFlag[];

export type FlagKey = (typeof TIPO_FLAGS)[number]['key'];

/**
 * Mapa esparso de flags de um localizador. Ausência ou `false` significam o
 * mesmo: a flag não está ativa.
 */
export type FlagsLocalizador = Partial<Record<FlagKey, boolean>>;
