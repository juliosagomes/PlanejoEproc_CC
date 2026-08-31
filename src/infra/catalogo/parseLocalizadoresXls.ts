import * as XLSX from 'xlsx';
import {
  CATALOGO_ORGAO_VERSION,
  type CatalogoOrgao,
  type LocalizadorOrgao,
} from '@/domain';
import { decodeHtmlEntities } from '@/utils/decodeHtmlEntities';
import { uid } from '@/utils/uid';

/**
 * Parser do XLS "LocalizadoresOrgao-…" exportado pelo Eproc.
 *
 * Formato esperado (verificado contra um export real de 2026):
 *  - Planilha "Localizadores" (ou primeira, se não encontrada).
 *  - Linhas iniciais com metadados (título, data de geração, total).
 *  - Uma linha de cabeçalho com colunas Localizador / Nome do Localizador /
 *    Descrição / Localizador Sistema / Data inclusão / Total.
 *  - Linhas de dado abaixo. Os emojis vêm codificados como entidades HTML
 *    numéricas (`&#128221;`), inclusive em sequências ZWJ multi-código.
 *
 * Comportamento:
 *  - Importa também os "Localizador Sistema = Sim", marcando-os com `sistema`
 *    para que a apresentação os distinga dos criados pela unidade
 *    (decisoes.md#D-23).
 *  - Decodifica entidades HTML em nome e descrição.
 *  - Deduplica por nome (case-insensitive).
 *  - Lança `XlsParseError` se o cabeçalho esperado não for encontrado ou o
 *    arquivo não puder ser interpretado pelo SheetJS.
 */
export class XlsParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'XlsParseError';
  }
}

export interface ParseStats {
  /** Linhas de dado examinadas (após o cabeçalho). */
  totalLinhas: number;
  importados: number;
  /** Quantos dos importados são localizadores de sistema. */
  sistema: number;
  ignoradosVazios: number;
  ignoradosDuplicados: number;
}

export interface ParseResult {
  catalogo: CatalogoOrgao;
  stats: ParseStats;
}

const COL_LOCALIZADOR = 0;
const COL_DESCRICAO = 2;
const COL_SISTEMA = 3;

export function parseLocalizadoresXls(
  data: ArrayBuffer | Uint8Array,
): ParseResult {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(data, { type: 'array' });
  } catch {
    throw new XlsParseError(
      'Não consegui ler o arquivo. Verifique se é um XLS válido exportado do Eproc.',
    );
  }

  const sheetName = workbook.SheetNames.includes('Localizadores')
    ? 'Localizadores'
    : workbook.SheetNames[0];
  if (!sheetName) {
    throw new XlsParseError('O arquivo não contém nenhuma planilha.');
  }
  const ws = workbook.Sheets[sheetName];
  if (!ws) {
    throw new XlsParseError(`Planilha "${sheetName}" vazia.`);
  }

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: true,
    defval: '',
  });

  // Localiza a linha de cabeçalho: a primeira que combina "Localizador" na
  // coluna 0 com algo contendo "Sistema" na coluna 3. Linhas anteriores são
  // metadados ("Localizadores do Órgão", "Data geração:", "Total Listados:").
  const headerIdx = matrix.findIndex((row) => {
    if (!row) return false;
    const c0 = String(row[COL_LOCALIZADOR] ?? '').trim().toLowerCase();
    const c3 = String(row[COL_SISTEMA] ?? '').trim().toLowerCase();
    return c0 === 'localizador' && c3.includes('sistema');
  });
  if (headerIdx === -1) {
    throw new XlsParseError(
      'Cabeçalho não encontrado. Esperado colunas "Localizador" e "Localizador Sistema".',
    );
  }

  const stats: ParseStats = {
    totalLinhas: 0,
    importados: 0,
    sistema: 0,
    ignoradosVazios: 0,
    ignoradosDuplicados: 0,
  };

  const itens: LocalizadorOrgao[] = [];
  const vistos = new Set<string>();

  for (let i = headerIdx + 1; i < matrix.length; i += 1) {
    const row = matrix[i];
    if (!row) continue;
    stats.totalLinhas += 1;

    const sistema = String(row[COL_SISTEMA] ?? '').trim().toLowerCase() === 'sim';

    const nome = decodeHtmlEntities(String(row[COL_LOCALIZADOR] ?? ''))
      .replace(/\s+/g, ' ')
      .trim();
    if (!nome) {
      stats.ignoradosVazios += 1;
      continue;
    }
    const chave = nome.toLowerCase();
    if (vistos.has(chave)) {
      stats.ignoradosDuplicados += 1;
      continue;
    }
    vistos.add(chave);

    const descricao = decodeHtmlEntities(String(row[COL_DESCRICAO] ?? '')).trim();
    if (sistema) stats.sistema += 1;
    itens.push({
      id: uid('lo'),
      nome,
      ...(descricao ? { descricao } : {}),
      ...(sistema ? { sistema: true } : {}),
    });
  }

  stats.importados = itens.length;

  return {
    catalogo: {
      version: CATALOGO_ORGAO_VERSION,
      importadoEm: new Date().toISOString(),
      itens,
    },
    stats,
  };
}
