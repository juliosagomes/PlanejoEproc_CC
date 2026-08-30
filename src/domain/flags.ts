/**
 * Flags do localizador — a lista é do **plano**, definida pelo usuário
 * (decisoes.md#D-22).
 *
 * O que era uma tabela fixa de quatro tipos (T/E/G/F) virou marcador livre: cada
 * unidade recorta o trabalho do seu jeito — por setor ("Setor de Cálculo") ou por
 * servidor ("Joana Silva") —, e os dois são o mesmo tipo de marcador, numa lista
 * plana. Só `Espera` e `Fixo de fluxo` sobraram como valores iniciais.
 */

/**
 * Paleta fixa. O número é um índice; a cor real mora em `index.css`
 * (`.flag-cor-N`), para o tema resolver claro/escuro sem o domínio saber de CSS.
 */
export const CORES_FLAG = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export type CorFlag = (typeof CORES_FLAG)[number];

export interface DefinicaoFlag {
  /**
   * Estável e opaco — é o que o nó referencia. Renomear o rótulo ou trocar a cor
   * não desfaz nenhuma marcação.
   */
  id: string;
  /** 1–2 caracteres exibidos no chip. Não precisa ser único. */
  code: string;
  /** "Espera", "Setor de Cálculo", "Joana Silva". */
  label: string;
  cor: CorFlag;
}

/**
 * Ids fixos dos quatro nomes históricos.
 *
 * Ficam constantes porque a migração v1→v2 precisa ser determinística: um plano
 * antigo migrado em duas máquinas tem de sair com os mesmos ids, ou a mesma
 * marcação viraria dois marcadores distintos ao sincronizar.
 */
export const FLAG_ESPERA_ID = 'flag-espera';
export const FLAG_FIXO_ID = 'flag-fixo';
export const FLAG_TRABALHADO_ID = 'flag-trabalhado';
export const FLAG_GATILHO_ID = 'flag-gatilho';

/** Com o que todo plano novo nasce. */
export function flagsPadrao(): DefinicaoFlag[] {
  return [
    { id: FLAG_ESPERA_ID, code: 'E', label: 'Espera', cor: 2 },
    { id: FLAG_FIXO_ID, code: 'F', label: 'Fixo de fluxo', cor: 4 },
  ];
}

/**
 * Sigla sugerida a partir do rótulo: iniciais das duas primeiras palavras
 * ("Setor de Cálculo" → "SC"), ou as duas primeiras letras quando há só uma
 * palavra ("Espera" → "ES"). Preposições curtas não contam como palavra.
 */
export function sugerirCode(label: string): string {
  const palavras = label
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 2 || /^[A-ZÀ-Þ0-9]/.test(p));

  if (palavras.length === 0) return '';
  if (palavras.length === 1) {
    return (palavras[0] ?? '').slice(0, 2).toUpperCase();
  }
  return palavras
    .slice(0, 2)
    .map((p) => p.charAt(0))
    .join('')
    .toUpperCase();
}

/**
 * Primeira cor ainda não usada. Esgotada a paleta, recomeça do início — repetir
 * cor é melhor que recusar a criação do marcador.
 */
export function proximaCor(existentes: readonly DefinicaoFlag[]): CorFlag {
  const usadas = new Set(existentes.map((f) => f.cor));
  return CORES_FLAG.find((c) => !usadas.has(c)) ?? CORES_FLAG[0];
}
