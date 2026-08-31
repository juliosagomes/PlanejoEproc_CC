import type { DefinicaoFlag } from './flags';
import type { EdgeData } from './edges';

/**
 * Versão do schema do plano. Toda persistência (localStorage, JSON exportado)
 * carrega esse número.
 *
 * v2 trouxe as flags customizáveis (decisoes.md#D-22). A migração v1→v2 mora em
 * `infra/storage/migracoes.ts` e é aplicada dentro do próprio `PlanoSchema`,
 * para que todo call site a herde — inclusive o `loadPlano`, que manda para a
 * quarentena tudo que não valida.
 */
export const SCHEMA_VERSION = 2 as const;

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
  /**
   * `true` quando o nome veio do catálogo e é um localizador **padrão do
   * Eproc**. Diferente de `ja_criado`, não é escolha do usuário: é fato sobre o
   * catálogo, e some quando o nome é editado à mão (decisoes.md#D-23).
   *
   * Opcional, e por isso aditivo — planos v2 sem o campo seguem validando, sem
   * migração.
   */
  sistema?: boolean;
  /**
   * Ids das flags do plano que valem neste localizador. Id sem definição
   * correspondente é ignorado na renderização, não é erro: outra aba pode ter
   * apagado a definição entre um render e outro.
   */
  flags: string[];
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
  /**
   * Definições das flags deste plano. Moram aqui, e não numa chave global do
   * navegador, porque o plano é a unidade de compartilhamento: exportado ou
   * sincronizado por lotação, ele chega no colega com os mesmos chips
   * (decisoes.md#D-22).
   */
  flags: DefinicaoFlag[];
  nodes: Localizador[];
  edges: Edge[];
  exportedAt?: string;
}
