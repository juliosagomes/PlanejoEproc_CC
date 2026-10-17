/* ============================================================================
 * CONJUNTOS PADRÃO DE TIPOS DE DOCUMENTO (decisoes.md#D-41)
 *
 * Deduzidos de `selControleDocumentoMultiplo` (TJMG, outubro/2026, 760 tipos).
 * Os rótulos do Eproc vêm truncados em 50 caracteres ("Edital de Decretação
 * de Falência e Relação de Cred"), então nenhuma regra depende do fim de um
 * rótulo longo.
 * ========================================================================== */

import type { RegraConjunto } from './conjuntos';

export const CATEGORIAS_CONJUNTO_DOCUMENTO = [
  'Peças das partes',
  'Atos do juízo',
  'Secretaria e comunicação',
  'Valores e constrição',
  'Criminal, infância e MP',
] as const;

export const CONJUNTOS_DOCUMENTO_PADRAO: readonly RegraConjunto[] = [
  /* ---------------- Peças das partes ---------------- */
  {
    id: 'iniciais',
    rotulo: 'Petições iniciais',
    categoria: 'Peças das partes',
    descricao: 'Petição inicial, inicial da execução e emenda à inicial.',
    inclui: [/peticao inicial/, /^inicial da execucao/, /^emenda a inicial/],
  },
  {
    id: 'pecas-partes',
    rotulo: 'Petições e manifestações das partes',
    categoria: 'Peças das partes',
    descricao: 'Petições, pedidos, manifestações, contestação, réplica, impugnações, exceções e memoriais.',
    inclui: [
      /^peticao/,
      /^contestacao/,
      /^replica/,
      /^impugnacao/,
      /^reconvencao/,
      /^manifestacao/,
      /^pedido/,
      /^requerimento/,
      /^resposta/,
      /^memoriais/,
      /^alegacoes/,
      /^excecao/,
      /^habilitacao/,
      /^oposicao/,
      /^embargos (de terceiro|em acao)/,
      /^rol de testemunhas/,
      /^primeiras declaracoes/,
      /^proposta de acordo/,
    ],
    exclui: [/contadoria|ministerio publico|defensoria|assistentes sociais|comissariado|peticao inicial/],
  },
  {
    id: 'recursos',
    rotulo: 'Recursos e contrarrazões',
    categoria: 'Peças das partes',
    descricao: 'Apelação, agravos, embargos de declaração e infringentes, recursos aos tribunais superiores, razões e contrarrazões.',
    inclui: [
      /^recurso/,
      /^agravo/,
      /^apelacao/,
      /^adesivo/,
      /^contrarrazoes/,
      /^contraminuta/,
      /^embargos (de declaracao|infringentes|\(outros\))/,
      /^razoes/,
      /^reclamacao/,
      /^incidente de uniformizacao/,
    ],
  },
  {
    id: 'representacao',
    rotulo: 'Procuração e substabelecimento',
    categoria: 'Peças das partes',
    descricao: 'Procuração, substabelecimento, renúncia de mandato, contrato de honorários e carta de preposto.',
    inclui: [/procuracao|substabelecimento|renuncia de mandato|contrato de honorarios|carta de preposto/],
  },
  {
    id: 'pessoais',
    rotulo: 'Documentos pessoais e comprovantes',
    categoria: 'Peças das partes',
    descricao: 'Identidade, CPF, comprovante de endereço, certidões de registro civil, contracheque e hipossuficiência.',
    inclui: [
      /cedula de identidade|cpf\/cnpj|comprovante de endereco|carteira de habilitacao|titulo de eleitor/,
      /certidao de (nascimento|casamento|obito)|documento pessoal|contracheque|hipossuficiencia/,
      /ficha financeira|atestado de saude|^extrato$|perfil profissiografico/,
    ],
  },

  /* ---------------- Atos do juízo ---------------- */
  {
    id: 'despachos',
    rotulo: 'Despachos e atos ordinatórios',
    categoria: 'Atos do juízo',
    descricao: 'Despachos, despacho de mero expediente, conversão em diligência e atos ordinatórios.',
    inclui: [/^despacho/, /^ato ordinatorio/, /^conversao \(despacho\)/, /^conversao em diligencia/],
  },
  {
    id: 'decisoes',
    rotulo: 'Decisões',
    categoria: 'Atos do juízo',
    descricao: 'Decisões e interlocutórias, liminares e tutelas, juízo de admissibilidade e de retratação, pronúncia e conversões.',
    inclui: [
      /^decisao/,
      /^interlocutoria/,
      /^conversao/,
      /\bliminar/,
      /^deferimento|^indeferimento/,
      /^juizo de (admissibilidade|retratacao)/,
      /^pronuncia/,
      /^ordem de habeas/,
      /^recebimento da denuncia/,
      /^tutela antecipada/,
      /^declinatoria/,
      /^reexame/,
    ],
    exclui: [/^conversao \(despacho\)/, /^conversao em diligencia/, /^pedido/],
  },
  {
    id: 'sentencas',
    rotulo: 'Sentenças, acórdãos e votos',
    categoria: 'Atos do juízo',
    descricao: 'Sentenças, projetos de sentença, acórdãos, votos, súmulas e decisão monocrática terminativa.',
    inclui: [
      /^sentenca/,
      /^acordao/,
      /^voto/,
      /projeto de sentenca/,
      /^sumula/,
      /^extincao de processo/,
      /decisao monocratica terminativa/,
    ],
  },
  {
    id: 'atas',
    rotulo: 'Atas e termos de audiência',
    categoria: 'Atos do juízo',
    descricao: 'Atas de audiência e de sessão, termos de audiência e de depoimento, oitivas e interrogatórios.',
    inclui: [
      /^ata\b/,
      /^termo de audiencia/,
      /^audiencia$/,
      /^link para acesso a sala/,
      /^extrato da ata/,
      /^termo de declaracao/,
      /^termo de transcricao/,
      /^oitiva/,
      /^interrogatorio/,
    ],
  },

  /* ---------------- Secretaria e comunicação ---------------- */
  {
    id: 'certidoes',
    rotulo: 'Certidões da secretaria',
    categoria: 'Secretaria e comunicação',
    descricao: 'Certidões lavradas no processo: decurso de prazo, trânsito, intimação, juntada, baixa, devolução de AR…',
    inclui: [/^certidao/, /^certificacao/],
    exclui: [/nascimento|casamento|obito|registro imobiliario|antecedentes|divida ativa|\bcndt\b|militancia|consulta/],
  },
  {
    id: 'intimacoes',
    rotulo: 'Citações, intimações e AR',
    categoria: 'Secretaria e comunicação',
    descricao: 'Citações, intimações, notificações, ciência, avisos de recebimento e e-Carta.',
    inclui: [
      /^intimacao/,
      /^citacao/,
      /^notificacao/,
      /aviso de recebimento/,
      /ecarta/,
      /carta ar -/,
      /^ciencia/,
      /termo de ciencia/,
      /devolucao de ar/,
    ],
  },
  {
    id: 'mandados',
    rotulo: 'Mandados',
    categoria: 'Secretaria e comunicação',
    descricao: 'Todo mandado, de qualquer tipo, e sua averbação, devolução e recebimento.',
    inclui: [/^mandado/, /contramandado/, /averbacao ao mandado/, /devolucao de mandado/, /recebimento de mandado/],
  },
  {
    id: 'cartas',
    rotulo: 'Cartas (precatória, rogatória, de ordem…)',
    categoria: 'Secretaria e comunicação',
    descricao: 'Cartas precatórias, rogatórias, de ordem, de sentença, de adjudicação e de arrematação.',
    inclui: [/^carta/],
    exclui: [/^carta ar -/],
  },
  {
    id: 'editais',
    rotulo: 'Editais',
    categoria: 'Secretaria e comunicação',
    descricao: 'Editais de citação, intimação, notificação, leilão e outros.',
    inclui: [/^edital/],
  },
  {
    id: 'oficios',
    rotulo: 'Ofícios, memorandos e comunicações',
    categoria: 'Secretaria e comunicação',
    descricao: 'Ofícios (exceto requisitórios), memorandos, e-mails, malote digital e comunicações.',
    inclui: [
      /^oficio(?! requisitorio)/,
      /^memorando/,
      /malote digital/,
      /^e-mail/,
      /^comunicacao$/,
      /^despacho\/oficio/,
      /(recebimento|devolucao) de oficio/,
    ],
  },
  {
    id: 'informacoes',
    rotulo: 'Informações',
    categoria: 'Secretaria e comunicação',
    descricao: 'Informações processuais, da corregedoria, de revogação e em habeas corpus.',
    inclui: [/^informac/],
  },

  /* ---------------- Valores e constrição ---------------- */
  {
    id: 'alvaras',
    rotulo: 'Alvarás',
    categoria: 'Valores e constrição',
    descricao: 'Todo alvará: levantamento, pagamento, transferência, soltura, viagem…',
    inclui: [/^alvara/],
  },
  {
    id: 'calculos',
    rotulo: 'Cálculos, guias, custas e pagamentos',
    categoria: 'Valores e constrição',
    descricao: 'Cálculos e planilhas, guias e custas, DARF e GRU, comprovantes de pagamento e requisitórios.',
    inclui: [
      /calculo|planilha|demonstrativo|^guia|custas|darf|\bgru\b/,
      /comprovante de pagamento|requisitorio|manifestacao da contadoria/,
    ],
    exclui: [/acolhimento|internacao|execucao penal|transferencia/],
  },
  {
    id: 'constricao',
    rotulo: 'Penhora, avaliação e expropriação',
    categoria: 'Valores e constrição',
    descricao: 'Penhora, arresto, avaliação, sequestro, depósito, leilão, adjudicação e arrematação.',
    inclui: [
      /penhora|arresto|avaliacao|sequestro|adjudicacao|arrematacao|leilao|hasta/,
      /termo de deposito|fiel depositario|alienacao de ativos/,
    ],
  },
  {
    id: 'consultas',
    rotulo: 'Consultas online (SISBAJUD, RENAJUD, SERASAJUD, INFOJUD)',
    categoria: 'Valores e constrição',
    descricao: 'Detalhamentos, protocolos e certidões de consulta aos sistemas conveniados, e SPC.',
    inclui: [/sisbajud|renajud|serasajud|infojud|\bspc\b|certidao de consulta/],
  },
  {
    id: 'pericias',
    rotulo: 'Perícias e laudos',
    categoria: 'Valores e constrição',
    descricao: 'Laudos, perícia, quesitos, documentos e honorários de perito, exame médico.',
    inclui: [/laudo|pericia|perito|quesitos|exame medico|parecer tecnico/],
  },

  /* ---------------- Criminal, infância e MP ---------------- */
  {
    id: 'prisao',
    rotulo: 'Prisão e liberdade',
    categoria: 'Criminal, infância e MP',
    descricao: 'Mandados de prisão, alvarás de soltura, flagrante, nota de culpa, monitoramento, fuga e saída temporária.',
    inclui: [
      /prisao|soltura|nota de culpa|liberdade provisoria|salvo-conduto|flagrante|recambiamento/,
      /monitora|regime prisional|unidade prisional|evasao|fuga|saida temporaria/,
    ],
  },
  {
    id: 'investigacao',
    rotulo: 'Inquérito e investigação',
    categoria: 'Criminal, infância e MP',
    descricao: 'Inquérito, boletim e registro de ocorrência, TC, interceptações, autos policiais e denúncia.',
    inclui: [
      /inquerito|boletim de ocorrencia|termo circunstanciado|interceptacao|registro de ocorrencia/,
      /relatorio de investigacoes|relatorio final|peca de informacao|denuncia|representacao - ato infracional/,
      /auto de (apreensao|qualificacao|reconhecimento|acareacao|colheita|busca)/,
    ],
    exclui: [/^recebimento da denuncia/],
  },
  {
    id: 'infancia',
    rotulo: 'Infância e Juventude',
    categoria: 'Criminal, infância e MP',
    descricao: 'Acolhimento, guias, relatórios psicossociais, PIA e demais documentos da Infância e Juventude.',
    inclui: [
      /infancia e juventude|acolhimento|crianca|plano individual de atendimento|\(eca\)/,
      /relatorio (psico|social)|estudo social|assistentes sociais|comissariado/,
    ],
  },
  {
    id: 'mp-defensoria',
    rotulo: 'Ministério Público e Defensoria',
    categoria: 'Criminal, infância e MP',
    descricao: 'Manifestações do Ministério Público e da Defensoria, parecer e promoção do MP.',
    inclui: [/ministerio publico|defensoria|promocao mp|^parecer$/],
  },
];
