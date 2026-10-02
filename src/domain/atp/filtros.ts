import type { CampoDef, OpcaoCampo, Parametros } from './campos';

/* ============================================================================
 * BLOCO "FILTROS OPCIONAIS" DO CADASTRO DE ATP
 *
 * Um filtro é um **grupo de campos** — "Data de Autuação" são três (modificador
 * e duas datas), "Entidade" são dois. Por isso o valor gravado é um objeto por
 * filtro, com os ids do Eproc por dentro, e não um valor solto.
 *
 * A UI começa vazia e o usuário adiciona só o que usa (decisoes.md#D-27). Os
 * grupos abaixo não existem no Eproc, que lista tudo corrido: servem só para
 * organizar o seletor "Adicionar filtro".
 *
 * Três tipos de lista ficam de fora do build e viram campo de digitação:
 *  - grandes demais (assunto, precedente, entidade, órgão de origem);
 *  - do tribunal ou da unidade (juízo, subseção, remessa, classificador);
 *  - localizadores, que são sugeridos a partir do plano e do catálogo da unidade.
 * ========================================================================== */

export const GRUPOS_FILTRO = [
  'Processo',
  'Prazo e movimentação',
  'Localizadores',
  'Eventos e documentos',
  'Partes',
  'Origem',
] as const;

export type GrupoFiltro = (typeof GRUPOS_FILTRO)[number];

export interface FiltroDef {
  /** Id do campo principal no Eproc; é a chave em `AtpFiltros`. */
  chave: string;
  rotulo: string;
  grupo: GrupoFiltro;
  ajuda?: string;
  campos: readonly CampoDef[];
}

/** Filtros adicionados à regra. A presença da chave é o que diz "adicionado". */
export type AtpFiltros = Record<string, Parametros>;

const CONECTOR: readonly OpcaoCampo[] = [
  { value: 'AND', label: 'E' },
  { value: 'OR', label: 'OU' },
];

const PREFIXO: readonly OpcaoCampo[] = [
  { value: 'IN', label: 'Que contenha' },
  { value: 'NOT IN', label: 'Que NÃO contenha' },
];

/** Filtro de um campo só, cujo rótulo é o do próprio filtro. */
function simples(
  grupo: GrupoFiltro,
  campo: CampoDef,
  ajuda?: string,
): FiltroDef {
  return {
    chave: campo.chave,
    rotulo: campo.rotulo,
    grupo,
    ...(ajuda ? { ajuda } : {}),
    campos: [campo],
  };
}

export const FILTROS_DEF: readonly FiltroDef[] = [
  /* ---------------- Processo ---------------- */
  simples('Processo', {
    chave: 'compSelVarJuizo',
    rotulo: 'Juízo do Processo',
    tipo: 'multi',
    livre: true,
  }),
  simples('Processo', {
    chave: 'selClassesJudiciaisMultiplo',
    rotulo: 'Classe',
    tipo: 'multi',
    catalogo: 'classes',
  }),
  simples('Processo', {
    chave: 'selCompetencia',
    rotulo: 'Competência',
    tipo: 'multi',
    catalogo: 'competencias',
  }),
  simples('Processo', {
    chave: 'selRitoProcesso',
    rotulo: 'Rito',
    tipo: 'select',
    catalogo: 'rito',
  }),
  simples('Processo', {
    chave: 'selAssuntoMultiplo',
    rotulo: 'Assunto',
    tipo: 'multi',
    livre: true,
  }),
  simples('Processo', {
    chave: 'compSelIdDadoComplementarProcesso',
    rotulo: 'Dado Complementar do Processo',
    tipo: 'multi',
    catalogo: 'dadoComplementarProcesso',
  }),
  simples('Processo', {
    chave: 'selStatusProcessoMultiplo',
    rotulo: 'Por Situação do Processo',
    tipo: 'multi',
    catalogo: 'statusProcesso',
  }),
  simples('Processo', {
    chave: 'compSelNivelSigilo',
    rotulo: 'Nível de Sigilo',
    tipo: 'multi',
    catalogo: 'nivelSigilo',
  }),
  {
    chave: 'critDataModificador',
    rotulo: 'Data de Autuação',
    grupo: 'Processo',
    campos: [
      {
        chave: 'critDataModificador',
        rotulo: 'Condição',
        tipo: 'select',
        catalogo: 'modificadorData',
      },
      { chave: 'critDataAutuacao1', rotulo: 'Data', tipo: 'data' },
      {
        chave: 'critDataAutuacao2',
        rotulo: 'Data final',
        tipo: 'data',
        quando: { chave: 'critDataModificador', em: ['ENTRE'] },
      },
    ],
  },
  {
    chave: 'critValorModificador',
    rotulo: 'Valor da Causa',
    grupo: 'Processo',
    campos: [
      {
        chave: 'critValorModificador',
        rotulo: 'Condição',
        tipo: 'select',
        catalogo: 'modificadorValor',
      },
      { chave: 'critValorCausa1', rotulo: 'Valor', tipo: 'texto' },
      {
        chave: 'critValorCausa2',
        rotulo: 'Valor final',
        tipo: 'texto',
        quando: { chave: 'critValorModificador', em: ['ENTRE'] },
      },
    ],
  },
  simples('Processo', {
    chave: 'compSelDadoTipoInquerito',
    rotulo: 'Tipo de Inquérito',
    tipo: 'multi',
    catalogo: 'tipoInquerito',
  }),
  simples('Processo', {
    chave: 'compSelTipoProcessoRelacionado',
    rotulo: 'Tipo de Processo Relacionado',
    tipo: 'multi',
    catalogo: 'tipoProcessoRelacionado',
  }),
  simples('Processo', {
    chave: 'chkNumDistribuicao',
    rotulo: 'Dígito de Distribuição do Processo',
    ajuda: 'Ex.: 5012345-67.2017.4.04.7100.',
    tipo: 'multi',
    opcoes: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => ({
      value: d,
      label: d,
    })),
  }),
  {
    chave: 'selParadigmaJudicialMultiplo',
    rotulo: 'Precedente qualificado',
    grupo: 'Processo',
    campos: [
      {
        chave: 'selParadigmaJudicialMultiplo',
        rotulo: 'Precedente',
        tipo: 'multi',
        livre: true,
      },
      {
        chave: 'selTipoFiltroTemasRepetitivos',
        rotulo: 'Tipo de filtro',
        tipo: 'multi',
        opcoes: [
          { value: 'C', label: 'Precedentes Vinculados' },
          { value: 'S', label: 'Precedentes por IA' },
          { value: 'I', label: 'Precedentes pelo Peticionante' },
        ],
      },
    ],
  },
  {
    chave: 'selClassificadorConteudo',
    rotulo: 'Classificador por Conteúdo',
    grupo: 'Processo',
    campos: [
      { chave: 'selClassificadorConteudo', rotulo: 'Classificador', tipo: 'texto' },
      {
        chave: 'rdTipoClassificacao',
        rotulo: 'O que classificar',
        tipo: 'select',
        opcoes: [
          {
            value: 'G',
            label: 'Os documentos do gatilho da regra (evento ou tipo de petição)',
          },
          { value: 'F', label: 'Os documentos selecionados no filtro de evento/petição' },
        ],
      },
    ],
  },

  /* ---------------- Prazo e movimentação ---------------- */
  simples(
    'Prazo e movimentação',
    { chave: 'selPrazoMultiplo', rotulo: 'Prazo', tipo: 'multi', catalogo: 'prazo' },
    'Conector "E": o processo deve satisfazer todas as condições de prazo selecionadas.',
  ),
  simples('Prazo e movimentação', {
    chave: 'selUltimaMovimentacao',
    rotulo: 'Última Movimentação',
    tipo: 'select',
    catalogo: 'ultimaMovimentacao',
  }),
  simples('Prazo e movimentação', {
    chave: 'compSelPendenciasCumprimento',
    rotulo: 'Pendência de Cumprimento',
    tipo: 'multi',
    catalogo: 'pendenciaCumprimento',
  }),

  /* ---------------- Localizadores ---------------- */
  simples('Localizadores', {
    chave: 'compSelIdLocalizadorContemTodos',
    rotulo: 'Localizador (Que Contenha Todos)',
    tipo: 'multi',
    sugestao: 'localizador',
    livre: true,
  }),
  simples('Localizadores', {
    chave: 'compSelIdLocalizadorContem',
    rotulo: 'Localizador (Que Contenha ao Menos Um)',
    tipo: 'multi',
    sugestao: 'localizador',
    livre: true,
  }),
  simples('Localizadores', {
    chave: 'compSelIdLocalizadorNaoContem',
    rotulo: 'Localizador (Que NÃO Contenha Nenhum)',
    tipo: 'multi',
    sugestao: 'localizador',
    livre: true,
  }),

  /* ---------------- Eventos e documentos ---------------- */
  simples('Eventos e documentos', {
    chave: 'compSelIdEvento',
    rotulo: 'Último Evento',
    tipo: 'multi',
    catalogo: 'eventos',
  }),
  simples('Eventos e documentos', {
    chave: 'critComplementoUltimoEvento',
    rotulo: 'Complemento do último evento',
    tipo: 'texto',
  }),
  {
    chave: 'selectTipoControle',
    rotulo: 'Evento/Tipo de Petição',
    grupo: 'Eventos e documentos',
    ajuda:
      'Processos que contenham (ou não) determinados eventos, tipos de petição, grupos ou complemento.',
    campos: [
      {
        chave: 'condicoes',
        rotulo: 'Condições',
        tipo: 'lista',
        rotuloItem: 'Incluir condição',
        subcampos: [
          {
            chave: 'selectConector',
            rotulo: 'Conector',
            ajuda: 'Da segunda condição em diante.',
            tipo: 'select',
            opcoes: CONECTOR,
          },
          { chave: 'selectTipoPrefixo', rotulo: 'Contenha', tipo: 'select', opcoes: PREFIXO },
          {
            chave: 'selectTipoControle',
            rotulo: 'O quê',
            tipo: 'select',
            opcoes: [
              { value: 'E', label: 'o(s) evento(s)' },
              { value: 'P', label: 'o(s) tipo(s) de petição' },
              { value: 'G', label: 'o(s) grupo(s) de evento ou petição' },
              { value: 'C', label: 'o complemento' },
            ],
          },
          {
            chave: 'selEventoFiltroMultiplo',
            rotulo: 'Eventos',
            tipo: 'multi',
            catalogo: 'eventos',
            quando: { chave: 'selectTipoControle', em: ['E'] },
          },
          {
            chave: 'selTipoPeticaoFiltroMultiplo',
            rotulo: 'Tipos de petição',
            tipo: 'multi',
            catalogo: 'tiposPeticao',
            quando: { chave: 'selectTipoControle', em: ['P'] },
          },
          {
            chave: 'selectGrupoEventoTipoPeticaoFiltro',
            rotulo: 'Grupo',
            tipo: 'select',
            catalogo: 'grupoEventoPeticao',
            quando: { chave: 'selectTipoControle', em: ['G'] },
          },
          {
            chave: 'txtComplementoEventoFiltro',
            rotulo: 'Complemento',
            tipo: 'texto',
            quando: { chave: 'selectTipoControle', em: ['C'] },
          },
          {
            chave: 'selSinPoloFiltroContenhaEvento',
            rotulo: 'Referentes a',
            tipo: 'select',
            catalogo: 'poloPeticao',
            quando: { chave: 'selectTipoControle', em: ['E', 'P', 'G'] },
          },
          {
            chave: 'txtNomeEntidadeFiltroContenhaEvento',
            rotulo: 'Entidade',
            tipo: 'texto',
            // 'S' = "ENTIDADE ESPECÍFICA".
            quando: { chave: 'selSinPoloFiltroContenhaEvento', em: ['S'] },
          },
        ],
      },
      {
        chave: 'txtConsiderarUltimosEventosFiltro',
        rotulo: 'Considerar apenas os últimos eventos (quantidade)',
        tipo: 'numero',
      },
      {
        chave: 'txtConsiderarUltimosDiasFiltro',
        rotulo: 'OU eventos dos últimos dias (quantidade)',
        tipo: 'numero',
      },
    ],
  },
  simples('Eventos e documentos', {
    chave: 'compSelNumQuantidadeDocEvento',
    rotulo: 'Documentos Evento/Petição',
    tipo: 'multi',
    catalogo: 'quantidadeDocEvento',
  }),
  simples(
    'Eventos e documentos',
    {
      chave: 'txtSiglaUsuarioDocumento',
      rotulo: 'Usuário Criador de Documento (nome ou login)',
      tipo: 'texto',
    },
    'Identifica o usuário que criou a minuta ou o documento associado ao evento de gatilho da regra.',
  ),
  simples('Eventos e documentos', {
    chave: 'compSelCodTipoDevolucaoCartaAr',
    rotulo: 'Motivo da Devolução do eCarta',
    tipo: 'multi',
    catalogo: 'devolucaoCartaAr',
  }),
  simples('Eventos e documentos', {
    chave: 'compSelSigTipoClassificacaoLaudoPericial',
    rotulo: 'Resultado do Último Laudo Médico de Incapacidade',
    tipo: 'multi',
    catalogo: 'laudoPericial',
  }),
  simples('Eventos e documentos', {
    chave: 'compSelTipoOrdemConsultaRestricao',
    rotulo: 'Resultado de Ordem de Consulta/Restrição',
    tipo: 'multi',
    catalogo: 'ordemConsultaRestricao',
  }),

  /* ---------------- Partes ---------------- */
  simples('Partes', {
    chave: 'compSelDadoTipoParte',
    rotulo: 'Tipo de Parte',
    tipo: 'multi',
    catalogo: 'tipoParte',
  }),
  simples('Partes', {
    chave: 'compSelIdDadoComplementarValor',
    rotulo: 'Dado Complementar da Parte',
    tipo: 'multi',
    catalogo: 'dadoComplementarParte',
  }),
  simples('Partes', {
    chave: 'compSelTipoLitisconsorcio',
    rotulo: 'Litisconsórcio',
    tipo: 'multi',
    catalogo: 'litisconsorcio',
  }),
  simples('Partes', {
    chave: 'compSelTipoRepresentacaoProcessual',
    rotulo: 'Representação Processual das Partes',
    tipo: 'multi',
    catalogo: 'representacaoProcessual',
  }),
  simples('Partes', {
    chave: 'compSelDadoTipoPessoa',
    rotulo: 'Tipo de Pessoa',
    tipo: 'multi',
    catalogo: 'tipoPessoa',
  }),
  simples('Partes', {
    chave: 'compSelDadoQualificacaoParte',
    rotulo: 'Qualificação das Partes',
    tipo: 'multi',
    catalogo: 'qualificacaoParte',
  }),
  {
    chave: 'selEntidadeMultiplo',
    rotulo: 'Entidade',
    grupo: 'Partes',
    campos: [
      { chave: 'selEntidadeMultiplo', rotulo: 'Entidade', tipo: 'multi', livre: true },
      {
        chave: 'selSinPolo',
        rotulo: 'Tipo Parte Entidade',
        tipo: 'select',
        catalogo: 'poloEntidade',
      },
    ],
  },
  {
    chave: 'txtParteRepresentante',
    rotulo: 'Advogado/Procurador',
    grupo: 'Partes',
    campos: [
      {
        chave: 'representantes',
        rotulo: 'Advogados/Procuradores',
        tipo: 'lista',
        rotuloItem: 'Incluir advogado/procurador',
        subcampos: [
          {
            chave: 'txtParteRepresentante',
            rotulo: 'Nome ou Login do Advogado/Procurador',
            tipo: 'texto',
          },
          {
            chave: 'selSinPoloParteRepresentante',
            rotulo: 'Tipo Parte Representada',
            tipo: 'select',
            catalogo: 'poloRepresentante',
          },
        ],
      },
    ],
  },
  {
    chave: 'txtNomeCNPJParteFiltroPessoa',
    rotulo: 'Pessoa',
    grupo: 'Partes',
    campos: [
      {
        chave: 'pessoas',
        rotulo: 'Pessoas',
        tipo: 'lista',
        rotuloItem: 'Incluir pessoa',
        subcampos: [
          {
            chave: 'selConectorFiltroPessoa',
            rotulo: 'Conector',
            ajuda: 'Da segunda pessoa em diante.',
            tipo: 'select',
            opcoes: CONECTOR,
          },
          {
            chave: 'selTipoPrefixoFiltroPessoa',
            rotulo: 'Contenha',
            tipo: 'select',
            opcoes: PREFIXO,
          },
          {
            chave: 'txtNomeCNPJParteFiltroPessoa',
            rotulo: 'Nome ou CNPJ da Pessoa',
            tipo: 'texto',
          },
          {
            chave: 'selSinPoloParteFiltroPessoa',
            rotulo: 'Tipo Parte Pessoa',
            tipo: 'select',
            opcoes: [
              { value: 'A', label: 'AUTOR' },
              { value: 'R', label: 'RÉU' },
              { value: 'I', label: 'INTERESSADO' },
              { value: 'Q', label: 'QUALQUER' },
              { value: 'N', label: 'NEUTRO' },
            ],
          },
        ],
      },
    ],
  },

  /* ---------------- Origem ---------------- */
  simples('Origem', {
    chave: 'compSelIdentificadorTipoOrgaoOrigem',
    rotulo: 'Origem da Remessa ou Redistribuição',
    tipo: 'multi',
    livre: true,
  }),
  simples('Origem', {
    chave: 'compSelIdLocalidadeJudicial',
    rotulo: 'Subseção de Origem da Regionalização',
    tipo: 'multi',
    livre: true,
  }),
  simples('Origem', {
    chave: 'compSelRemessaAtivaOrgao',
    rotulo: 'Remessa Ativa Órgãos',
    tipo: 'multi',
    livre: true,
  }),
];

const POR_CHAVE: ReadonlyMap<string, FiltroDef> = new Map(
  FILTROS_DEF.map((f) => [f.chave, f]),
);

export function filtroDef(chave: string): FiltroDef | undefined {
  return POR_CHAVE.get(chave);
}
