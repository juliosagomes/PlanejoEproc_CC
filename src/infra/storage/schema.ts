import { z } from 'zod';
import {
  CATALOGO_ORGAO_VERSION,
  CATALOGO_UNIDADE_VERSION,
  PREF_TIPOS,
  SCHEMA_VERSION,
  SUBITEM_CATS,
  TIPO_CONTROLE_VALUES,
  type AcaoPreferencialUnidade,
  type CatalogoOrgao,
  type CatalogoUnidade,
  type DobraAresta,
  type Edge,
  type ItemCatalogoUnidade,
  type Localizador,
  type LocalizadorOrgao,
  type LocalizadorUnidade,
  type Plano,
  type Subitem,
  type UnidadeEproc,
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
  minutaModo: z.enum(['modelo', 'texto_padrao']).optional(),
  minutaConteudo: z.string().optional(),
});

const EdgeKindSchema = z.enum(['atp', 'pref', 'manual']);

// `.finite()` porque `z.number()` sozinho barra NaN mas deixa passar
// Infinity — que aqui viraria uma coordenada de path inválida.
const DobraArestaSchema = z.object({
  fracaoX: z.number().finite().optional(),
  desvioY: z.number().finite().optional(),
}) satisfies z.ZodType<DobraAresta>;

const EdgeDataSchema = z.object({
  kind: EdgeKindSchema,
  resumo: z.string(),
  observacao: z.string(),
  subitems: z.array(SubitemSchema),
  atp: AtpRuleSchema.optional(),
  pref: PrefRuleSchema.optional(),
  dobra: DobraArestaSchema.optional(),
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

/**
 * Bundle de exportação contendo múltiplos planos. O `kind` literal serve de
 * discriminador na hora de importar arquivo: o caller tenta `PlanoBundleSchema`
 * antes de `PlanoSchema` para diferenciar bundle de plano único. A `version`
 * aqui versiona o formato do invólucro, não os planos internos (que carregam
 * sua própria SCHEMA_VERSION).
 */
export const PLANO_BUNDLE_VERSION = 1 as const;

export const PlanoBundleSchema = z.object({
  kind: z.literal('planejoeproc-bundle'),
  version: z.literal(PLANO_BUNDLE_VERSION),
  exportedAt: z.string().optional(),
  plans: z.array(PlanoSchema),
});

export type PlanoBundle = z.infer<typeof PlanoBundleSchema>;

/**
 * Índice de planos (multi-plano). Cada entrada é leve — só metadados — e o
 * payload completo fica numa chave separada `planejoeproc:plan:{id}`.
 * `atualizadoEm` é ISO 8601; usado para ordenar a lista por uso recente na UI.
 */
export const PlanIndexEntrySchema = z.object({
  id: z.string(),
  nome: z.string(),
  atualizadoEm: z.string(),
});

export const PlansIndexSchema = z.array(PlanIndexEntrySchema);

/* ============================================================================
 * Catálogo do órgão (decisoes.md#D-7)
 *
 * Persistido global por navegador, não viaja dentro do JSON do plano. Mesmo
 * padrão dos planos: schema versionado, satisfies para garantir alinhamento
 * com o tipo do domain.
 * ========================================================================== */

const LocalizadorOrgaoSchema = z.object({
  id: z.string(),
  nome: z.string(),
  descricao: z.string().optional(),
}) satisfies z.ZodType<LocalizadorOrgao>;

export const CatalogoOrgaoSchema = z.object({
  version: z.literal(CATALOGO_ORGAO_VERSION),
  importadoEm: z.string(),
  itens: z.array(LocalizadorOrgaoSchema),
}) satisfies z.ZodType<CatalogoOrgao>;

/* ---------------------------------------------------------------------------
 * Catálogo lido direto da unidade no Eproc.
 *
 * Os três catálogos de Fase 2 (preferências, modelos, textos padrão) são
 * `.optional()` porque um catálogo gravado hoje precisa continuar validando
 * quando eles existirem — não há máquina de migração, e falhar a validação
 * significa jogar fora o catálogo do usuário (o `load` põe em quarentena).
 * Mesmo raciocínio do D-10.
 * ------------------------------------------------------------------------ */

const UnidadeEprocSchema = z.object({
  chave: z.string(),
  host: z.string(),
  login: z.string(),
  sigla: z.string(),
  nome: z.string().optional(),
}) satisfies z.ZodType<UnidadeEproc>;

const LocalizadorUnidadeSchema = z.object({
  eprocId: z.string().optional(),
  sigla: z.string(),
  nome: z.string(),
  descricao: z.string().optional(),
  sistema: z.boolean(),
  dataInclusao: z.string().optional(),
  qtdProcessos: z.number().optional(),
}) satisfies z.ZodType<LocalizadorUnidade>;

const ItemCatalogoUnidadeSchema = z.object({
  eprocId: z.string().optional(),
  nome: z.string(),
  orgao: z.string().optional(),
  detalhe: z.string().optional(),
}) satisfies z.ZodType<ItemCatalogoUnidade>;

const AcaoPreferencialUnidadeSchema = z.object({
  localizador: z.string(),
  preferencias: z.array(z.string()),
}) satisfies z.ZodType<AcaoPreferencialUnidade>;

const FonteResultadoSchema = z.object({
  status: z.enum(['ok', 'vazio', 'semPermissao', 'falhou']),
  itens: z.number().optional(),
  motivo: z.string().optional(),
});

export const CatalogoUnidadeSchema = z.object({
  version: z.literal(CATALOGO_UNIDADE_VERSION),
  unidade: UnidadeEprocSchema,
  coletadoEm: z.string(),
  localizadores: z.array(LocalizadorUnidadeSchema),
  preferencias: z.array(ItemCatalogoUnidadeSchema).optional(),
  modelos: z.array(ItemCatalogoUnidadeSchema).optional(),
  textosPadrao: z.array(ItemCatalogoUnidadeSchema).optional(),
  acoesPreferenciais: z.array(AcaoPreferencialUnidadeSchema).optional(),
  fontes: z.record(z.string(), FonteResultadoSchema),
}) satisfies z.ZodType<CatalogoUnidade>;
