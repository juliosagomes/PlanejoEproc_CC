import { z } from 'zod';
import {
  ANOTACOES_CATALOGO_VERSION,
  CATALOGO_ORGAO_VERSION,
  CATALOGO_UNIDADE_VERSION,
  CONJUNTOS_EVENTO_VERSION,
  CORES_FLAG,
  PREF_TIPOS,
  SCHEMA_VERSION,
  SETORES_VERSION,
  SUBITEM_CATS,
  TIPO_CONTROLE_VALUES,
  type AcaoPreferencialUnidade,
  type AcaoProgramada,
  type AnotacaoRecurso,
  type AnotacoesCatalogo,
  type CatalogoOrgao,
  type CatalogoUnidade,
  type ConjuntosEventoUnidade,
  type DefinicaoFlag,
  type DobraAresta,
  type AtpRule,
  type AtpTrigger,
  type Edge,
  type EdgeData,
  type ItemCatalogoUnidade,
  type Localizador,
  type LocalizadorOrgao,
  type LocalizadorUnidade,
  type Plano,
  type PrefRule,
  type SetoresUnidade,
  type Subitem,
  type UnidadeEproc,
  type ValorCampo,
  type ValorSimples,
} from '@/domain';
import { migrarPlanoV1, migrarPlanoV2, migrarPlanoV3 } from './migracoes';

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

// `z.enum` só aceita strings e a paleta é de números, então o union é escrito à
// mão. Os dois checks abaixo garantem que ele e `CORES_FLAG` não se separem.
const CorFlagSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7),
  z.literal(8),
]);

type _CorCobreSchema =
  z.infer<typeof CorFlagSchema> extends (typeof CORES_FLAG)[number] ? true : false;
type _CorCobrePaleta =
  (typeof CORES_FLAG)[number] extends z.infer<typeof CorFlagSchema> ? true : false;
const _corOk: [_CorCobreSchema, _CorCobrePaleta] = [true, true];
void _corOk;

const DefinicaoFlagSchema = z.object({
  id: z.string(),
  code: z.string(),
  label: z.string(),
  cor: CorFlagSchema,
}) satisfies z.ZodType<DefinicaoFlag>;

/**
 * Setores da unidade (decisoes.md#D-26). Mora numa chave por escopo, fora do
 * plano; `Plano.flags` guarda um retrato da mesma forma, e por isso os dois
 * reusam o `DefinicaoFlagSchema`.
 */
export const SetoresUnidadeSchema = z.object({
  version: z.literal(SETORES_VERSION),
  itens: z.array(DefinicaoFlagSchema),
}) satisfies z.ZodType<SetoresUnidade>;

/** Conjuntos de eventos criados pelo usuário (decisoes.md#D-29). Chave por escopo, como os setores. */
export const ConjuntosEventoUnidadeSchema = z.object({
  version: z.literal(CONJUNTOS_EVENTO_VERSION),
  itens: z.array(z.object({ id: z.string(), rotulo: z.string(), ids: z.array(z.string()) })),
}) satisfies z.ZodType<ConjuntosEventoUnidade>;

/* ---------------------------------------------------------------------------
 * Regra de ATP — espelho da tela de cadastro do Eproc (decisoes.md#D-27).
 *
 * Os parâmetros das ações e os filtros são `z.record`: a lista de campos mora
 * nos descritores do domínio (`domain/atp/`), e validar chave por chave aqui
 * faria um plano gravado hoje ser reprovado — e ir para a quarentena — no dia
 * em que o Eproc renomear um campo e o descritor acompanhar. O schema garante
 * a **forma** do valor; o descritor diz o que cada chave significa.
 * ------------------------------------------------------------------------ */

const ValorSimplesSchema = z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
  z.array(z.string()),
]) satisfies z.ZodType<ValorSimples>;

const ValorCampoSchema = z.union([
  ValorSimplesSchema,
  z.array(z.record(z.string(), ValorSimplesSchema)),
]) satisfies z.ZodType<ValorCampo>;

const ParametrosSchema = z.record(z.string(), ValorCampoSchema);

const AtpTriggerSchema = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('A'),
    eventoIds: z.array(z.string()).optional(),
    peticaoTipoIds: z.array(z.string()).optional(),
    documentos: z.array(z.string()).optional(),
    restringirA: z.string().optional(),
    entidade: z.string().optional(),
  }),
  z.object({
    tipo: z.literal('E'),
    eventoIds: z.array(z.string()).optional(),
  }),
  z.object({
    tipo: z.literal('P'),
    peticaoTipoIds: z.array(z.string()).optional(),
    restringirA: z.string().optional(),
    entidade: z.string().optional(),
  }),
  z.object({
    tipo: z.literal('O'),
    documento: z.string().optional(),
  }),
  z.object({
    tipo: z.literal('D'),
    tipoData: z.enum(['T', 'D', 'M', 'S']).optional(),
    data: z.string().optional(),
    diaMes: z.number().optional(),
    diaSemana: z.string().optional(),
  }),
  z.object({
    tipo: z.literal('L'),
    dias: z.number().optional(),
    diasUteis: z.boolean().optional(),
  }),
  z.object({
    tipo: z.literal('S'),
    statusId: z.string().optional(),
    dias: z.number().optional(),
    diasUteis: z.boolean().optional(),
  }),
  z.object({
    tipo: z.literal('V'),
    dias: z.number().optional(),
  }),
  z.object({
    tipo: z.literal('M'),
    descricao: z.string().optional(),
    acaoPreferencialNaCapa: z.boolean().optional(),
    umClique: z.boolean().optional(),
  }),
]) satisfies z.ZodType<AtpTrigger>;

// Sanity check: o schema só aceita os 9 valores canônicos de TIPO_CONTROLE.
// Em build, qualquer divergência aparece como erro de TS aqui.
type _TriggerTipoCheck =
  z.infer<typeof AtpTriggerSchema>['tipo'] extends (typeof TIPO_CONTROLE_VALUES)[number]
    ? true
    : false;
const _triggerTipoOk: _TriggerTipoCheck = true;
void _triggerTipoOk;

const AcaoProgramadaSchema = z.object({
  id: z.string(),
  tipo: z.string().optional(),
  descricao: z.string().optional(),
  parametros: ParametrosSchema.optional(),
  localizadorErro: z.string().optional(),
}) satisfies z.ZodType<AcaoProgramada>;

const AtpRuleSchema = z.object({
  implantar: z.boolean(),
  comportamentoOrigem: z.enum(['0', '4', '1', '2', '3']).optional(),
  trigger: AtpTriggerSchema.optional(),
  acoes: z.array(AcaoProgramadaSchema).optional(),
  filtros: z.record(z.string(), ParametrosSchema).optional(),
  observacoes: z.string().optional(),
}) satisfies z.ZodType<AtpRule>;

const PrefRuleSchema = z.object({
  implantar: z.boolean(),
  tipo: z.enum(PREF_TIPOS).optional(),
  acao: z.string().optional(),
  observacoes: z.string().optional(),
  minutaModo: z.enum(['modelo', 'texto_padrao']).optional(),
  minutaConteudo: z.string().optional(),
}) satisfies z.ZodType<PrefRule>;

/**
 * O detalhamento da regra viaja dentro do recurso (decisoes.md#D-24), por isso
 * este schema vem depois de `AtpRuleSchema`/`PrefRuleSchema`.
 */
const SubitemSchema = z.object({
  id: z.string(),
  categoria: z.enum(SUBITEM_CATS),
  nome: z.string(),
  descricao: z.string().optional(),
  ja_criado: z.boolean(),
  atp: AtpRuleSchema.optional(),
  pref: PrefRuleSchema.optional(),
}) satisfies z.ZodType<Subitem>;

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
  dobra: DobraArestaSchema.optional(),
}) satisfies z.ZodType<EdgeData>;

const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const LocalizadorDataSchema = z.object({
  nome: z.string(),
  descricao: z.string().optional(),
  observacao: z.string().optional(),
  ja_criado: z.boolean(),
  sistema: z.boolean().optional(),
  flags: z.array(z.string()),
  acoesPreferenciais: z
    .array(z.object({ id: z.string(), nome: z.string(), ja_criado: z.boolean() }))
    .optional(),
  atalhoPara: z.string().optional(),
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

const PlanoV4Schema = z.object({
  version: z.literal(SCHEMA_VERSION),
  planoNome: z.string(),
  flowMode: FlowModeSchema,
  flags: z.array(DefinicaoFlagSchema),
  nodes: z.array(LocalizadorSchema),
  edges: z.array(EdgeSchema),
  exportedAt: z.string().optional(),
}) satisfies z.ZodType<Plano>;

/* ---------------------------------------------------------------------------
 * Regra de ATP e plano v3 — congelados.
 *
 * Até a v3 a regra de ATP tinha um gatilho mais pobre, três filtros fixos e a
 * ação como código + dois textos livres (`acao`, `condicoes`). A v4 passou a
 * espelhar a tela do Eproc (decisoes.md#D-27). Cópia literal, pelo mesmo motivo
 * das arestas v1/v2 logo abaixo: schema antigo que reusa o corrente muda junto
 * com ele, e plano real deixa de validar.
 * ------------------------------------------------------------------------ */

const AtpTriggerSchemaV3 = z.discriminatedUnion('tipo', [
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

const AtpRuleSchemaV3 = z.object({
  implantar: z.boolean(),
  trigger: AtpTriggerSchemaV3.optional(),
  filtros: z
    .object({
      classesJudiciaisIds: z.array(z.string()).optional(),
      competenciaIds: z.array(z.string()).optional(),
      statusProcessoIds: z.array(z.string()).optional(),
    })
    .optional(),
  condicoes: z.string().optional(),
  acaoTipo: z.string().optional(),
  acao: z.string().optional(),
  observacoes: z.string().optional(),
});

export type AtpRuleV3 = z.infer<typeof AtpRuleSchemaV3>;

const SubitemSchemaV3 = z.object({
  id: z.string(),
  categoria: z.enum(SUBITEM_CATS),
  nome: z.string(),
  descricao: z.string().optional(),
  ja_criado: z.boolean(),
  atp: AtpRuleSchemaV3.optional(),
  pref: PrefRuleSchema.optional(),
});

const EdgeSchemaV3 = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
  data: z.object({
    kind: EdgeKindSchema,
    resumo: z.string(),
    observacao: z.string(),
    subitems: z.array(SubitemSchemaV3),
    dobra: DobraArestaSchema.optional(),
  }),
});

export const PlanoV3Schema = z.object({
  version: z.literal(3),
  planoNome: z.string(),
  flowMode: FlowModeSchema,
  flags: z.array(DefinicaoFlagSchema),
  nodes: z.array(LocalizadorSchema),
  edges: z.array(EdgeSchemaV3),
  exportedAt: z.string().optional(),
});

export type PlanoV3 = z.infer<typeof PlanoV3Schema>;

/* ---------------------------------------------------------------------------
 * Arestas v1/v2 — congeladas.
 *
 * Até a v2 a aresta guardava **uma** regra, em `data.atp`/`data.pref`; na v3
 * cada regra é um recurso da própria aresta (decisoes.md#D-24). Estas cópias
 * existem para que as migrações continuem lendo o que está gravado em disco.
 *
 * Congelar é o ponto: enquanto a v1 reusou o `EdgeSchema` corrente, qualquer
 * mudança na aresta silenciosamente mudava também o formato antigo — e um
 * plano v1 real passaria a ser reprovado, ou seja, mandado para a quarentena.
 * ------------------------------------------------------------------------ */

// Até a v2, nome e "já criado" moravam na regra; na v3 são do recurso.
const AtpRuleSchemaV2 = AtpRuleSchemaV3.extend({
  nome: z.string(),
  ja_criado: z.boolean(),
});
const PrefRuleSchemaV2 = PrefRuleSchema.extend({
  nome: z.string(),
  ja_criado: z.boolean(),
});

const SubitemSchemaV2 = z.object({
  id: z.string(),
  categoria: z.enum(SUBITEM_CATS),
  nome: z.string(),
  descricao: z.string().optional(),
  ja_criado: z.boolean(),
});

const EdgeDataSchemaV2 = z.object({
  kind: EdgeKindSchema,
  resumo: z.string(),
  observacao: z.string(),
  subitems: z.array(SubitemSchemaV2),
  atp: AtpRuleSchemaV2.optional(),
  pref: PrefRuleSchemaV2.optional(),
  dobra: DobraArestaSchema.optional(),
});

const EdgeSchemaV2 = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
  data: EdgeDataSchemaV2,
});

export const PlanoV2Schema = z.object({
  version: z.literal(2),
  planoNome: z.string(),
  flowMode: FlowModeSchema,
  flags: z.array(DefinicaoFlagSchema),
  nodes: z.array(LocalizadorSchema),
  edges: z.array(EdgeSchemaV2),
  exportedAt: z.string().optional(),
});

export type PlanoV2 = z.infer<typeof PlanoV2Schema>;

/* ---------------------------------------------------------------------------
 * Plano v1 — congelado.
 *
 * Só existe para alimentar a migração; nada além dela deve importá-lo. As
 * flags do nó eram um mapa esparso de quatro chaves booleanas, e `z.object`
 * descarta chave desconhecida em silêncio: era exatamente isso que impedia
 * qualquer flag customizada de sobreviver a um reload antes da v2.
 * ------------------------------------------------------------------------ */

const FlagsLocalizadorV1Schema = z.object({
  trabalhado: z.boolean().optional(),
  espera: z.boolean().optional(),
  gatilho: z.boolean().optional(),
  fixo: z.boolean().optional(),
});

export const PlanoV1Schema = z.object({
  version: z.literal(1),
  planoNome: z.string(),
  flowMode: FlowModeSchema,
  nodes: z.array(
    z.object({
      id: z.string(),
      position: PositionSchema,
      data: z.object({
        nome: z.string(),
        descricao: z.string().optional(),
        observacao: z.string().optional(),
        ja_criado: z.boolean(),
        flags: FlagsLocalizadorV1Schema,
      }),
    }),
  ),
  edges: z.array(EdgeSchemaV2),
  exportedAt: z.string().optional(),
});

export type PlanoV1 = z.infer<typeof PlanoV1Schema>;

/**
 * O schema público sempre **devolve a versão corrente**, migrando o que chegar
 * mais velho. As migrações se encadeiam: a v1 passa pela v2 e pela v3 antes de
 * chegar na v4, para que cada passo continue tendo um teste só seu.
 *
 * A migração mora aqui, e não em cada chamador, porque `safeParse` é chamado em
 * sete pontos (storage, import de arquivo, pull da lotação) e um deles —
 * `loadPlano` — manda para a quarentena tudo que não valida. Um schema que
 * apenas rejeitasse o formato antigo faria todo plano já salvo sumir da tela.
 */
export const PlanoSchema = z.union([
  PlanoV4Schema,
  PlanoV3Schema.transform(migrarPlanoV3),
  PlanoV2Schema.transform((v2) => migrarPlanoV3(migrarPlanoV2(v2))),
  PlanoV1Schema.transform((v1) => migrarPlanoV3(migrarPlanoV2(migrarPlanoV1(v1)))),
]) satisfies z.ZodType<Plano, z.ZodTypeDef, unknown>;

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
  // `.optional()` porque catálogos gravados antes do D-23 não têm o campo, e
  // reprová-los aqui equivaleria a apagar o catálogo do usuário.
  sistema: z.boolean().optional(),
}) satisfies z.ZodType<LocalizadorOrgao>;

export const CatalogoOrgaoSchema = z.object({
  version: z.literal(CATALOGO_ORGAO_VERSION),
  importadoEm: z.string(),
  itens: z.array(LocalizadorOrgaoSchema),
}) satisfies z.ZodType<CatalogoOrgao>;

/* ---------------------------------------------------------------------------
 * Anotações do catálogo (decisoes.md#D-25)
 *
 * `z.record` e não um array: a chave é o que casa a anotação com o recurso, e
 * um array exigiria varrer a lista a cada linha renderizada do catálogo.
 * ------------------------------------------------------------------------ */

const AnotacaoRecursoSchema = z.object({
  descricao: z.string().optional(),
  orientacoes: z.string().optional(),
  atualizadoEm: z.string(),
}) satisfies z.ZodType<AnotacaoRecurso>;

export const AnotacoesCatalogoSchema = z.object({
  version: z.literal(ANOTACOES_CATALOGO_VERSION),
  itens: z.record(z.string(), AnotacaoRecursoSchema),
}) satisfies z.ZodType<AnotacoesCatalogo>;

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
