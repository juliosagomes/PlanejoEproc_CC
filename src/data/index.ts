/**
 * Catálogos do Eproc embutidos no bundle (Caminho A — ver CLAUDE.md).
 *
 * Apenas o subset estritamente necessário para popular os selects do modal de
 * detalhamento (EdgePanel). Os demais 42 JSONs originais ficam intocados em
 * `listas_json/` na raiz, disponíveis para uso futuro mas fora do build.
 *
 * Decisão D-1 (decisoes.md): `selAssuntoMultiplo.json` (1 MB / 3260 itens)
 * fica fora — assunto é texto livre.
 */
import compSelIdEventoData from './compSelIdEvento.json';
import selClassesData from './selClassesJudiciaisMultiplo.json';
import selCompetenciaData from './selCompetencia.json';
import selStatusData from './selStatusProcessoMultiplo.json';
import selTipoAcaoProgramadaData from './selTipoAcaoProgramada.json';
import selTipoControleData from './selTipoControle.json';

export interface ItemCatalogo {
  /** Código canônico do Eproc (string sempre — alguns JSONs usam letras, outros números). */
  value: string;
  /** Rótulo legível em PT-BR. */
  label: string;
}

const cast = (data: unknown): ItemCatalogo[] => data as ItemCatalogo[];

/** Eventos disponíveis como gatilho de ATP (≈700 itens). */
export const EVENTOS = cast(compSelIdEventoData);

/** 9 tipos de controle (selTipoControle) — espelha `TIPO_CONTROLE_VALUES` do domain. */
export const TIPOS_CONTROLE = cast(selTipoControleData);

/** 23 ações programadas. */
export const TIPOS_ACAO_PROGRAMADA = cast(selTipoAcaoProgramadaData);

/** Classes judiciais (≈500 itens) — usadas em filtros do Bloco 3. */
export const CLASSES_JUDICIAIS = cast(selClassesData);

/** Competências (≈40 itens) — filtro do Bloco 3. */
export const COMPETENCIAS = cast(selCompetenciaData);

/** Situações do processo (≈200 itens) — filtro do Bloco 3. */
export const STATUS_PROCESSO = cast(selStatusData);

/** Procura o `label` de um valor num catálogo. Retorna `undefined` se não achar. */
export function buscarLabel(catalogo: ItemCatalogo[], value: string): string | undefined {
  return catalogo.find((it) => it.value === value)?.label;
}
