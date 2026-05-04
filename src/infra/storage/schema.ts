import { z } from 'zod';
import {
  PREF_TIPOS,
  SCHEMA_VERSION,
  SUBITEM_CATS,
  TIPO_CONTROLE_VALUES,
  type Edge,
  type Localizador,
  type Plano,
  type Subitem,
} from '@/domain';

/**
 * Schemas Zod que validam dados externos contra o domain v1.
 *
 * São usados em toda fronteira que recebe dado não-confiável: leitura do
 * localStorage e importação de arquivo JSON. Em outros pontos (mutações da
 * store, props internas), confiamos no TypeScript.
 *
 * Cada schema usa `satisfies z.ZodType<DomainType>` para garantir, em tempo
 * de compilação, que o schema continua espelhando o tipo do domain. Mudou o
 * domain? O TypeScript reclama aqui.
 */

const FlagsLocalizadorSchema = z.object({
  trabalhado: z.boolean().optional(),
  espera: z.boolean().optional(),
  gatilho: z.boolean().optional(),
  fixo: z.boolean().optional(),
});

const SubitemSchema = z.object({
  id: z.string(),
  categoria: z.enum(SUBITEM_CATS),
  nome: z.string(),
  descricao: z.string().optional(),
  ja_criado: z.boolean(),
}) satisfies z.ZodType<Subitem>;

const AtpTriggerSchema = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('A'),
    eventoIds: z.array(z.string()).optional(),
    peticaoTipoIds: z.array(z.string()).optional(),
    documentoTipoIds: z.array(z.string()).optional(),
  }),
  z.object({
    tipo: z.literal('E'),
    eventoIds: z.array(z.string()).optional(),
  }),
  z.object({
    tipo: z.literal('P'),
    peticaoTipoIds: z.array(z.string()).optional(),
  }),
  z.object({
    tipo: z.literal('O'),
    documentoTipoIds: z.array(z.string()).optional(),
  }),
  z.object({
    tipo: z.literal('D'),
    data: z.string().optional(),
    periodicidadeDias: z.number().optional(),
  }),
  z.object({
    tipo: z.literal('L'),
    diasNoLocalizador: z.number().optional(),
    localizadorIds: z.array(z.string()).optional(),
  }),
  z.object({
    tipo: z.literal('S'),
    diasNaSituacao: z.number().optional(),
    statusIds: z.array(z.string()).optional(),
  }),
  z.object({
    tipo: z.literal('V'),
    diasSemMovimentacao: z.number().optional(),
  }),
  z.object({
    tipo: z.literal('M'),
  }),
]);

// Sanity check: o schema só aceita os 9 valores canônicos de TIPO_CONTROLE.
// Em build, qualquer divergência aparece como erro de TS aqui.
type _TriggerTipoCheck =
  z.infer<typeof AtpTriggerSchema>['tipo'] extends (typeof TIPO_CONTROLE_VALUES)[number]
    ? true
    : false;
const _triggerTipoOk: _TriggerTipoCheck = true;
void _triggerTipoOk;

const AtpFiltrosSchema = z.object({
  classesJudiciaisIds: z.array(z.string()).optional(),
  competenciaIds: z.array(z.string()).optional(),
  statusProcessoIds: z.array(z.string()).optional(),
});

const AtpRuleSchema = z.object({
  implantar: z.boolean(),
  ja_criado: z.boolean(),
  nome: z.string(),
  trigger: AtpTriggerSchema.optional(),
  filtros: AtpFiltrosSchema.optional(),
  condicoes: z.string().optional(),
  acaoTipo: z.string().optional(),
  acao: z.string().optional(),
  observacoes: z.string().optional(),
});

const PrefRuleSchema = z.object({
  implantar: z.boolean(),
  ja_criado: z.boolean(),
  nome: z.string(),
  tipo: z.enum(PREF_TIPOS).optional(),
  acao: z.string().optional(),
  observacoes: z.string().optional(),
});

const EdgeKindSchema = z.enum(['atp', 'pref', 'manual']);

const EdgeDataSchema = z.object({
  kind: EdgeKindSchema,
  resumo: z.string(),
  observacao: z.string(),
  subitems: z.array(SubitemSchema),
  atp: AtpRuleSchema.optional(),
  pref: PrefRuleSchema.optional(),
});

const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const LocalizadorDataSchema = z.object({
  nome: z.string(),
  descricao: z.string().optional(),
  observacao: z.string().optional(),
  ja_criado: z.boolean(),
  flags: FlagsLocalizadorSchema,
});

const LocalizadorSchema = z.object({
  id: z.string(),
  position: PositionSchema,
  data: LocalizadorDataSchema,
}) satisfies z.ZodType<Localizador>;

const EdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
  data: EdgeDataSchema,
}) satisfies z.ZodType<Edge>;

const FlowModeSchema = z.enum(['organic', 'sharp']);

export const PlanoSchema = z.object({
  version: z.literal(SCHEMA_VERSION),
  planoNome: z.string(),
  flowMode: FlowModeSchema,
  nodes: z.array(LocalizadorSchema),
  edges: z.array(EdgeSchema),
  exportedAt: z.string().optional(),
}) satisfies z.ZodType<Plano>;
