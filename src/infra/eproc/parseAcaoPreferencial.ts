import type { AcaoPreferencialUnidade } from '@/domain';
import { abrirGrade, itensDaCelula } from './infraTable';

/**
 * Parser da tela `localizador_acao_preferencial_listar` — "Ações Preferenciais
 * por Localizador do Órgão".
 *
 * Uma linha por localizador que **tem** ao menos um vínculo; os demais nem
 * aparecem. Medido numa unidade real: 96 linhas para 179 localizadores.
 *
 * Duas particularidades desta tela:
 *
 * - **Não pagina.** Devolve tudo de uma vez, sem rodapé de "N registros" e sem
 *   controles de página. Por isso um `fetch` basta, sem o iframe que as grades
 *   de modelos e textos padrão exigem (decisoes.md#D-16).
 * - **As ações vêm separadas por `<br>`, sem espaço.** Ler `textContent` direto
 *   cola os nomes ("…Emenda Inicial🔵▶️GAB - Inicial Ar…"). O `itensDaCelula`
 *   existe para isso.
 *
 * Cuidado de vocabulário: o `" - "` dentro do nome de uma ação
 * ("GAB - Determinar Emenda Inicial") **não** é o separador sigla/nome do
 * `<select>` de localizadores. Aqui não se separa nada — o nome é o texto todo.
 */
const SINONIMOS = {
  localizador: ['LOCALIZADOR'],
  descricao: ['DESCRICAO'],
  acoes: ['ACOES PREFERENCIAIS'],
} as const;

type Campo = keyof typeof SINONIMOS;

const OBRIGATORIAS: readonly Campo[] = ['localizador', 'acoes'];

export function parseAcaoPreferencial(fragmento: string): AcaoPreferencialUnidade[] {
  const grade = abrirGrade<Campo>(fragmento, SINONIMOS, OBRIGATORIAS);
  const idxAcoes = grade.colunas.acoes;
  if (idxAcoes === undefined) return [];

  const vinculos: AcaoPreferencialUnidade[] = [];
  for (const linha of grade.linhas) {
    const localizador = grade.celula(linha, 'localizador');
    if (!localizador) continue;

    const celula = linha.children[idxAcoes];
    const preferencias = celula ? itensDaCelula(celula) : [];
    // Localizador sem vínculo não acrescenta nada — a tela às vezes o lista
    // mesmo assim, e guardar a linha vazia só polui o catálogo.
    if (preferencias.length === 0) continue;

    vinculos.push({ localizador, preferencias });
  }

  return vinculos;
}
