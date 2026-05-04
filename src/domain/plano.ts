import type { FlagsLocalizador } from './flags';
import type { EdgeData } from './edges';

/**
 * Versão do schema do plano. Toda persistência (localStorage, JSON exportado)
 * carrega esse número. Migrações são escritas só quando v2 sair, com teste
 * de regressão (importar arquivo da versão anterior, conferir que dado não
 * foi perdido).
 */
export const SCHEMA_VERSION = 1 as const;

export type SchemaVersion = typeof SCHEMA_VERSION;

export interface Position {
  x: number;
  y: number;
}

export interface LocalizadorData {
  nome: string;
  descricao?: string;
  observacao?: string;
  /** Marcado quando o localizador já existe no Eproc. */
  ja_criado: boolean;
  flags: FlagsLocalizador;
}

export interface Localizador {
  id: string;
  position: Position;
  data: LocalizadorData;
}

/**
 * Aresta entre dois localizadores. Os campos `sourceHandle`/`targetHandle`
 * existem porque ReactFlow os usa para determinar de qual alça (handle) a
 * conexão sai/entra; o domain os preserva como strings opacas, sem importar
 * tipos de ReactFlow.
 */
export interface Edge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  data: EdgeData;
}

/** Modo visual do canvas: `organic` = curvas Bézier; `sharp` = step ortogonal. */
export type FlowMode = 'organic' | 'sharp';

/**
 * Plano completo — unidade de persistência. É o que vai pro localStorage e
 * pro JSON exportado.
 *
 * `exportedAt` é metadado opcional preenchido só na exportação para arquivo.
 */
export interface Plano {
  version: SchemaVersion;
  planoNome: string;
  flowMode: FlowMode;
  nodes: Localizador[];
  edges: Edge[];
  exportedAt?: string;
}
