import type { CampoDef, OpcaoCampo, Parametros } from './campos';

/* ============================================================================
 * BLOCO "EXECUTAR AÇÃO" DO CADASTRO DE ATP
 *
 * No Eproc a ação programada é opcional ("Programar ação após execução da
 * regra") e pode ser múltipla — cada uma com ordem, descrição, tipo, os
 * parâmetros do tipo e um localizador de erro. A ordem aqui é a do array.
 *
 * Levantado em 02/10/2026 na tela `automatizar_localizadores_novo` do
 * eproc1g/TJMG. Os códigos e os ids dos campos são os da tela.
 * ========================================================================== */

export interface AcaoProgramada {
  /** Identificador local, gerado pelo cliente. Só serve de `key` e de alvo de edição. */
  id: string;
  /** Código de `selTipoAcaoProgramada`. Ausente enquanto o usuário não escolhe. */
  tipo?: string;
  /** "Descrição" — o Eproc só pede quando há mais de uma ação. */
  descricao?: string;
  parametros?: Parametros;
  /** Para onde o processo vai se a ação falhar. Nome do localizador. */
  localizadorErro?: string;
}

/* ---- Campos compartilhados por mais de uma ação ---- */

const modelo: CampoDef = {
  chave: 'txtModeloAutomatico',
  rotulo: 'Modelo da Minuta Automatizada',
  tipo: 'texto',
  sugestao: 'modelo',
};

const evento: CampoDef = {
  chave: 'txtEventoAutomatico',
  rotulo: 'Evento Automatizado',
  tipo: 'texto',
  sugestao: 'evento',
};

const tipoComunicacao: CampoDef = {
  chave: 'TipoComunicacao',
  rotulo: 'Tipo de comunicação',
  tipo: 'select',
  opcoes: [
    { value: 'C', label: 'Citação' },
    { value: 'I', label: 'Intimação' },
  ],
};

const ABERTURA_PRAZO: readonly OpcaoCampo[] = [
  { value: 'J', label: 'Juntada' },
  { value: 'C', label: 'Intimação' },
];

const aberturaPrazo: CampoDef = {
  chave: 'AberturaPrazo',
  rotulo: 'Abertura do prazo na data da',
  tipo: 'select',
  opcoes: ABERTURA_PRAZO,
};

const prazo: CampoDef = { chave: 'Prazo', rotulo: 'Prazo', tipo: 'numero' };

const maoPropria: CampoDef = {
  chave: 'MaoPropria',
  rotulo: 'Mãos Próprias Pessoa Física',
  tipo: 'simNao',
  ajuda: "Para Pessoas Jurídicas sempre será 'Não'.",
};

const citarLitisconsorcio: CampoDef = {
  chave: 'CitarLitisconsorcio',
  rotulo: 'Incluir Litisconsórcio',
  tipo: 'simNao',
};

const citarDje: CampoDef = {
  chave: 'CitarDJE',
  rotulo: 'Citação de partes com DJE',
  tipo: 'simNao',
};

const espolio: CampoDef = {
  chave: 'CitacaoEspolioSemRepresentante',
  rotulo: 'Citação de espólio sem representante',
  tipo: 'simNao',
};

const qualificacoesEndereco: CampoDef = {
  chave: 'compSelCodTipoDevolucaoPermitemCitacao',
  rotulo:
    'Qualificações (tipos de devoluções de Carta AR) de endereços das partes que permitem a citação',
  tipo: 'multi',
  catalogo: 'devolucaoCartaAr',
};

const citacaoDuplicada: CampoDef = {
  chave: 'PermitirCitacaoDuplicada',
  rotulo: 'Citar/Intimar se já houver citação ou intimação anterior para a parte',
  tipo: 'simNao',
};

const parteComProcurador: CampoDef = {
  chave: 'PermitirCitacaoParteComProcurador',
  rotulo: 'Citar/Intimar partes com procuradores',
  tipo: 'simNao',
};

const mandadoUnico: CampoDef = {
  chave: 'MandadoUnicoParaPessoasComMesmoEndereco',
  rotulo: 'Mandado único para pessoas com mesmo endereço',
  tipo: 'simNao',
};

const cumprimentoEletronico: CampoDef = {
  chave: 'CumprimentoEletronico',
  rotulo: 'Cumprimento Eletrônico (Whatsapp)',
  tipo: 'simNao',
};

const polos: CampoDef = {
  chave: 'compSelPolo',
  rotulo: 'Pólo',
  tipo: 'multi',
  opcoes: [
    { value: 'A', label: 'Autor' },
    { value: 'R', label: 'Réu' },
    { value: 'I', label: 'Interessado' },
  ],
};

const litisconsorcio: CampoDef = {
  chave: 'Litisconsorcio',
  rotulo: 'Litisconsórcio',
  tipo: 'simNao',
};

const partesComProcurador: CampoDef = {
  chave: 'PartesComProcurador',
  rotulo: 'Incluir também partes com Advogado/Procurador constituído',
  tipo: 'simNao',
};

const ALTERAR_SITUACAO: readonly OpcaoCampo[] = [
  { value: 'SUSP', label: 'Reativação Suspensão' },
  { value: 'BAIX', label: 'Cancelamento da Baixa' },
  { value: 'DESP', label: 'Conclusão para despacho' },
  { value: 'DECI', label: 'Conclusão para decisão' },
  { value: 'JULG', label: 'Conclusão para julgamento' },
  { value: 'RETI', label: 'Retificação de Conclusão' },
];

/** O Eproc usa um id de campo por ação para a mesma lista. */
function alterarSituacao(chave: string): CampoDef {
  return {
    chave,
    rotulo: 'Alterar Situação Automaticamente',
    tipo: 'multi',
    opcoes: ALTERAR_SITUACAO,
  };
}

function preferenciaDeUnidade(chave: string): CampoDef {
  return {
    chave,
    rotulo: 'Preferência (somente preferências de unidade)',
    tipo: 'texto',
    sugestao: 'preferencia',
  };
}

export interface AcaoProgramadaDef {
  codigo: string;
  rotulo: string;
  campos: readonly CampoDef[];
}

/** As 24 ações de `selTipoAcaoProgramada`, na ordem da tela. */
export const ACOES_PROGRAMADAS: readonly AcaoProgramadaDef[] = [
  {
    codigo: 'AJG',
    rotulo: 'Alterar Situação da Justiça Gratuita da Parte',
    campos: [
      {
        chave: 'SituacaoJusticaGratuita',
        rotulo: 'Situação Justiça Gratuita',
        tipo: 'select',
        opcoes: [
          { value: '1', label: 'Deferida' },
          { value: '2', label: 'Indeferida' },
          { value: '3', label: 'Não requerida' },
          { value: '4', label: 'Parcialmente Deferida' },
          { value: '6', label: 'Requerida' },
          { value: '7', label: 'Requerida em Recurso' },
          { value: '5', label: 'Revogada' },
        ],
      },
      {
        chave: 'Polo',
        rotulo: 'Pólo',
        tipo: 'select',
        opcoes: [
          { value: 'A', label: 'Autor' },
          { value: 'R', label: 'Réu' },
        ],
      },
    ],
  },
  { codigo: 'ACP', rotulo: 'Atualizar Situação Citação Parte Sem Procurador', campos: [] },
  {
    codigo: 'CAR',
    rotulo: 'Citação/Intimação por AR',
    campos: [
      modelo,
      tipoComunicacao,
      prazo,
      aberturaPrazo,
      maoPropria,
      espolio,
      citarLitisconsorcio,
      citarDje,
      qualificacoesEndereco,
      citacaoDuplicada,
      parteComProcurador,
    ],
  },
  {
    codigo: 'CPE',
    rotulo: 'Citação/Intimação por Edital',
    campos: [
      modelo,
      tipoComunicacao,
      { chave: 'PrazoEdital', rotulo: 'Prazo para o edital', tipo: 'numero' },
      { chave: 'PrazoCitacao', rotulo: 'Prazo para a citação', tipo: 'numero' },
      citarLitisconsorcio,
      citarDje,
      citacaoDuplicada,
      parteComProcurador,
    ],
  },
  {
    codigo: 'CMA',
    rotulo: 'Citação/Intimação por Mandado',
    campos: [
      modelo,
      tipoComunicacao,
      {
        chave: 'AberturaPrazoCMA',
        rotulo: 'Abertura do prazo na data da',
        tipo: 'select',
        opcoes: ABERTURA_PRAZO,
      },
      { chave: 'PrazoCMA', rotulo: 'Prazo', tipo: 'numero' },
      citarLitisconsorcio,
      mandadoUnico,
      cumprimentoEletronico,
      espolio,
      citarDje,
      qualificacoesEndereco,
      citacaoDuplicada,
      parteComProcurador,
    ],
  },
  {
    codigo: 'DLB',
    rotulo: 'Desativar Lembrete',
    campos: [
      { chave: 'LembreteCriterio', rotulo: 'Critérios para Desativar', tipo: 'textarea' },
      { chave: 'DiasInclusao', rotulo: 'Incluídos há mais de (dias)', tipo: 'numero' },
      {
        chave: 'CriadosPorUsuarioSistema',
        rotulo: 'Somente lembretes incluídos por usuários de Sistema (SECJE e SECAUTOLOC)',
        tipo: 'simNao',
      },
    ],
  },
  {
    codigo: 'DPL',
    rotulo: 'Distribuir Processos entre Localizadores',
    campos: [
      {
        chave: 'compSelLocalizadorSorteio',
        rotulo: 'Localizadores para sorteio',
        tipo: 'multi',
        sugestao: 'localizador',
        livre: true,
      },
    ],
  },
  {
    codigo: 'EOM',
    rotulo: 'Expedição de Mandado',
    campos: [
      modelo,
      {
        chave: 'Ato',
        rotulo: 'Ato',
        tipo: 'select',
        opcoes: [{ value: '1', label: 'CITAR/NOTIF/INTIMAR/PENH/AVALIAR/PRISÃO' }],
      },
      prazo,
      polos,
      aberturaPrazo,
      litisconsorcio,
      partesComProcurador,
      mandadoUnico,
      cumprimentoEletronico,
    ],
  },
  {
    codigo: 'EOC',
    rotulo: 'Expedição de Ofício por Carta AR',
    campos: [
      modelo,
      prazo,
      aberturaPrazo,
      maoPropria,
      polos,
      litisconsorcio,
      partesComProcurador,
    ],
  },
  { codigo: 'E', rotulo: 'Lançar evento automatizado', campos: [evento] },
  {
    codigo: 'CAE',
    rotulo: 'Seleção de Endereço para Citação/Intimação',
    campos: [
      {
        chave: 'TipoPrioridadeSelecaoEndereco',
        rotulo: 'Critério para selecionar o endereço',
        tipo: 'select',
        opcoes: [
          { value: '1', label: 'Mais recente da RF' },
          {
            value: '2',
            label: 'Mais recente com qualificação positiva (carta ou mandado)',
          },
          { value: '3', label: 'Mais recente' },
        ],
      },
      { chave: 'ManterPrincipal', rotulo: 'Manter principal já selecionado', tipo: 'simNao' },
      { chave: 'CorrigirEndereco', rotulo: 'Corrigir endereço', tipo: 'simNao' },
      { chave: 'UsarEnderecoUnico', rotulo: 'Usar endereço único', tipo: 'simNao' },
      { chave: 'UsarEnderecoInativado', rotulo: 'Usar endereço inativado', tipo: 'simNao' },
      {
        chave: 'SelecionarEnderecoParteComProcurador',
        rotulo: 'Selecionar endereço para partes com procuradores',
        tipo: 'simNao',
      },
      {
        chave: 'InformarErroEnderecoNaoSelecionado',
        rotulo: 'Informar erro quando não for possível selecionar endereço principal',
        tipo: 'simNao',
      },
    ],
  },
  {
    codigo: 'VRA',
    rotulo: 'Verificação de Dados Processuais',
    campos: [
      {
        chave: 'compSelValidacoesDoReu',
        rotulo: 'Validações do Réu',
        ajuda: 'Todas se nenhuma selecionada.',
        tipo: 'multi',
        opcoes: [
          { value: '1', label: 'Se pessoa está viva' },
          { value: '2', label: 'Se maior de 18 Anos' },
          { value: '3', label: 'Se nome da pessoa similar ao da RFB' },
          { value: '4', label: 'Se CPF ou CNPJ cadastrado e válido' },
          { value: '5', label: 'Se endereço para citação selecionado e válido' },
          {
            value: '6',
            label: 'Se documento da CDA consta na petição inicial - execução fiscal apenas',
          },
          {
            value: '7',
            label:
              'Se CDA prescrita: mais de 5 anos entre data de origem e autuação - execução fiscal apenas',
          },
          { value: '10', label: 'Se CDA cadastrada - execução fiscal apenas' },
          { value: '8', label: 'Se citado sem procurador - não cadastrado' },
          { value: '9', label: 'Se apenas um réu com ou sem representantes' },
        ],
      },
      {
        chave: 'ValorMinimo',
        rotulo: 'Valor Mínimo da Causa',
        ajuda: 'Se zero, não valida.',
        tipo: 'texto',
      },
    ],
  },
  {
    codigo: 'A',
    rotulo: 'Preparar minuta para assinatura e agendar evento',
    campos: [
      modelo,
      evento,
      {
        chave: 'PrepMinutaStatusMinuta',
        rotulo: 'Status Destino da Minuta',
        tipo: 'select',
        opcoes: [
          { value: '27', label: 'Anotação concluída' },
          { value: '3', label: 'Conferida' },
          { value: '4', label: 'Para assinar' },
          { value: '2', label: 'Para conferir' },
          { value: '1', label: 'Rascunho' },
        ],
      },
      alterarSituacao('compSelAlterarSituacaoMinuta'),
      {
        // No Eproc é um select com os usuários da unidade. Nome de gente não é
        // catálogo para embutir no build, então aqui é texto.
        chave: 'AssinanteIndicadoMinuta',
        rotulo: 'Assinante Indicado',
        tipo: 'texto',
        opcoes: [{ value: 'Magistrado atuante no juízo', label: 'Magistrado atuante no juízo' }],
      },
    ],
  },
  {
    codigo: 'PMP',
    rotulo: 'Preparar minuta baseada em preferência de unidade',
    campos: [
      preferenciaDeUnidade('PrepMinutaPreferencia'),
      alterarSituacao('compSelAlterarSituacaoMinutaPMP'),
    ],
  },
  {
    codigo: 'EDP',
    rotulo: 'Lançar Evento e Documento baseado em preferência de unidade',
    campos: [preferenciaDeUnidade('PrepMinutaPreferenciaEDP')],
  },
  { codigo: 'P', rotulo: 'Executar prevenção', campos: [] },
  { codigo: 'D', rotulo: 'Verificar Dados Previdenciários', campos: [] },
  {
    codigo: 'R',
    rotulo: 'Retificar Autuação',
    campos: [
      {
        chave: 'RetificarClasseJudicial',
        rotulo: 'Retificar Classe',
        tipo: 'select',
        catalogo: 'classes',
      },
    ],
  },
  { codigo: 'O', rotulo: 'Gerar Ofício Requisitório', campos: [] },
  { codigo: 'C', rotulo: 'Redistribuir Central de Controle', campos: [] },
  {
    codigo: 'B',
    rotulo: 'Retornar da Central de Controle para Vara de Origem',
    campos: [],
  },
  {
    codigo: 'IDC',
    rotulo: 'Inserir dado complementar no processo',
    campos: [
      {
        chave: 'DadoComplementarProcesso',
        rotulo: 'Dado Complementar e Valor',
        tipo: 'select',
        catalogo: 'dadoComplementarProcesso',
      },
    ],
  },
  {
    codigo: 'AST',
    rotulo: 'Alterar Situação Automaticamente',
    campos: [alterarSituacao('compSelAlterarSituacao')],
  },
  {
    codigo: 'LBT',
    rotulo: 'Incluir Lembrete',
    campos: [
      { chave: 'LembreteTexto', rotulo: 'Lembrete', tipo: 'textarea' },
      {
        chave: 'Validade',
        rotulo: 'Dias Validade',
        ajuda: 'Se zero, sem validade.',
        tipo: 'numero',
      },
      {
        // As três opções gerais vêm do Eproc; as demais são órgãos da comarca
        // do usuário, por isso o campo aceita texto.
        chave: 'OrgaoDestinoLembrete',
        rotulo: 'Órgão Destino',
        tipo: 'texto',
        opcoes: [
          { value: 'Todos os órgãos', label: 'Todos os órgãos' },
          { value: 'Órgão julgador do processo', label: 'Órgão julgador do processo' },
          { value: 'Órgão da regra', label: 'Órgão da regra' },
        ],
      },
      {
        chave: 'ExibirLembreteMovProcessual',
        rotulo: 'Exibir Lembrete na Movimentação do Processo',
        tipo: 'simNao',
      },
    ],
  },
];

const POR_CODIGO: ReadonlyMap<string, AcaoProgramadaDef> = new Map(
  ACOES_PROGRAMADAS.map((a) => [a.codigo, a]),
);

/** `undefined` para código que o app não conhece — plano feito em versão mais nova. */
export function acaoProgramadaDef(codigo: string | undefined): AcaoProgramadaDef | undefined {
  return codigo ? POR_CODIGO.get(codigo) : undefined;
}
