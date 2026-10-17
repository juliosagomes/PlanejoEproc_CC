/* ============================================================================
 * CONJUNTOS PADRÃO DE EVENTOS (decisoes.md#D-29)
 *
 * Deduzidos da própria lista (TJMG, 1º grau, outubro/2026) — a redação do
 * Eproc é muito regular ("Audiência de X designada", "Juntada de Mandado -
 * Cumprido"…), e é essa regularidade que torna os conjuntos confiáveis. O que
 * é comum aos três catálogos com conjunto está em `conjuntos.ts`.
 *
 * O teste em `features/conjuntos/conjuntos.test.ts` confere cada conjunto contra
 * o catálogo real: tamanho mínimo e exemplos que precisam (e não podem) estar.
 * ========================================================================== */

import type { RegraConjunto } from './conjuntos';

export const CATEGORIAS_CONJUNTO_EVENTO = [
  'Comunicação e prazos',
  'Andamento',
  'Decisões e julgamento',
  'Audiências e sessões',
  'Diligências',
  'Arquivo e suspensão',
  'Valores e bens',
  'Criminal',
] as const;

export const CONJUNTOS_EVENTO_PADRAO: readonly RegraConjunto[] = [
  /* ---------------- Comunicação e prazos ---------------- */
  {
    id: 'mera-ciencia',
    rotulo: 'Mera ciência',
    categoria: 'Comunicação e prazos',
    descricao:
      'Intimações, citações e comunicações expedidas ou confirmadas, e publicações no Diário — movimentos que só dão ciência e não pedem providência da secretaria.',
    inclui: [
      /^expedida.*(intimacao|citacao|comunicacao)/,
      /^intimacao eletronica - expedida/,
      /^confirmada a (citacao|intimacao|comunicacao)/,
      /^disponibilizado no (djen|diario)/,
      /^intimado (em|por)/,
      /^intimacao por edital/,
      /^citado em secretaria/,
    ],
  },
  {
    id: 'publicacoes',
    rotulo: 'Publicações no Diário',
    categoria: 'Comunicação e prazos',
    descricao: 'Disponibilizações no DJEN e no Diário Eletrônico.',
    inclui: [/^disponibilizado no (djen|diario)/],
  },
  {
    id: 'comunicacoes-recebidas',
    rotulo: 'Comunicações recebidas',
    categoria: 'Comunicação e prazos',
    descricao: 'Comunicações eletrônicas que chegam de outros juízos e instâncias.',
    inclui: [/^comunicacao eletronica recebida/],
  },
  {
    id: 'prazos',
    rotulo: 'Prazos encerrados',
    categoria: 'Comunicação e prazos',
    descricao: 'Decurso de prazo e certidões de prazo encerrado ou de edital finalizado.',
    inclui: [
      /^decorrido prazo/,
      /^juntada de certidao - (encerrado prazo|finalizado o prazo|decurso prazo)/,
      /^ato ordinatorio praticado - finalizado o prazo/,
    ],
  },

  /* ---------------- Andamento ---------------- */
  {
    id: 'distribuicao',
    rotulo: 'Distribuição e redistribuição',
    categoria: 'Andamento',
    descricao: 'Distribuído e redistribuído, por qualquer motivo.',
    inclui: [/^distribuido/, /^redistribui/, /^recebido pelo distribuidor/],
  },
  {
    id: 'remessas',
    rotulo: 'Remessa e retorno de autos',
    categoria: 'Andamento',
    descricao: 'Autos remetidos, recebidos ou devolvidos — entre varas, setores, centrais e instâncias.',
    inclui: [
      /^remetidos os autos/,
      /^recebidos os autos/,
      /^devolvidos os autos/,
      /^remessa interna/,
      /^recebimento/,
    ],
  },
  {
    id: 'recursos',
    rotulo: 'Recursos — subida e retorno',
    categoria: 'Andamento',
    descricao: 'Remessa em grau de recurso, retorno das instâncias superiores e atos de admissibilidade.',
    inclui: [
      /^remetidos os autos (em grau de recurso|cumpridos|cumpridos parcialmente|nao cumpridos)/,
      /^remetidos os autos por (julgamento definitivo do recurso|declinio de competencia)/,
      /^recebidos os autos (do stf|do stj|- tnu)/,
      /recurso .*admitido como representativo/,
      /^conclusos para admissibilidade/,
      /^ato ordinatorio praticado - (vista para contrarrazoes|vista para complementacao de preparo|recebida comunicacao de julgamento)/,
      /^disponibilizado no diario eletronico - admissibilidade/,
      /^(nao )?conhecid[oa]s? (o|os) (recurso|embargos)/,
      /^decisao\/despacho - conhecid/,
      /^prejudicado o recurso/,
      /efeito suspensivo a apelacao|efeito suspensivo ao recurso/,
      /juizo de retratacao|^mantido o acordao/,
    ],
  },
  {
    id: 'cadastro',
    rotulo: 'Cadastro e autuação',
    categoria: 'Andamento',
    descricao: 'Alteração de partes, classe e assunto, retificações, Juízo 100% Digital, substabelecimento e migração.',
    inclui: [
      /^alterad|^alteracao do/,
      /classe processual/,
      /^registro|^registrado/,
      /juizo 100% digital/,
      /substabelecimento/,
      /^migrada/,
      /^cancelad[ao] a movimentacao|^cancelamento de distribuicao/,
      /^desentranhado/,
    ],
  },
  {
    id: 'conclusao',
    rotulo: 'Conclusão',
    categoria: 'Andamento',
    descricao: 'Conclusos para despacho, decisão ou julgamento.',
    inclui: [/^conclusos/],
  },
  {
    id: 'atos-ordinatorios',
    rotulo: 'Atos ordinatórios',
    categoria: 'Andamento',
    descricao: 'Atos ordinatórios praticados pela secretaria.',
    inclui: [/^ato ordinatorio/, /^decisao\/despacho - ato ordinatorio/],
  },

  /* ---------------- Decisões e julgamento ---------------- */
  {
    id: 'decisoes',
    rotulo: 'Decisões e despachos',
    categoria: 'Decisões e julgamento',
    descricao: 'Todo evento "Decisão/Despacho", despachos e embargos de declaração.',
    inclui: [/^decisao\/despacho/, /^despacho/, /^embargos de declaracao/],
    exclui: [/^decisao\/despacho - ato ordinatorio/],
  },
  {
    id: 'tutelas',
    rotulo: 'Tutelas e liminares',
    categoria: 'Decisões e julgamento',
    descricao: 'Concessão, indeferimento ou revogação de tutela antecipada, provisória ou liminar.',
    // `\b` antes de "liminar": sem ele, "Audiência pre*liminar*" entrava aqui.
    inclui: [/tutela|\bliminar/],
    exclui: [/^baixa definitiva/],
  },
  {
    id: 'sentencas',
    rotulo: 'Sentenças e julgamentos',
    categoria: 'Decisões e julgamento',
    descricao:
      'Todo evento "Sentença", julgamentos de procedência ou improcedência, mandado de segurança, habeas corpus e habeas data, e anulações.',
    inclui: [
      /^sentenca/,
      /^julgado (procedente|improcedente)/,
      /^julgamento/,
      /^(concedid|denegad).*(seguranca|habeas)/,
      /^anulad/,
      /juiz leigo/,
    ],
  },
  {
    id: 'extincao',
    rotulo: 'Sentenças de extinção',
    categoria: 'Decisões e julgamento',
    descricao: 'Extinção do processo, da execução ou da punibilidade.',
    inclui: [/^sentenca - (extint|sentenca de extincao|sentenca sem resolucao)/],
  },
  {
    id: 'transito',
    rotulo: 'Trânsito em julgado',
    categoria: 'Decisões e julgamento',
    descricao: 'Trânsito em julgado, inclusive o comunicado por outro juízo.',
    inclui: [/transitado em julgado|transito em julgado/],
    exclui: [/^decisao\/despacho/],
  },
  {
    id: 'pauta',
    rotulo: 'Pauta e sessão de julgamento',
    categoria: 'Decisões e julgamento',
    descricao: 'Inclusão em pauta ou mesa, deliberações e adiamentos em sessão.',
    inclui: [
      /^inclusao em (pauta|mesa)/,
      /^incluido em mesa/,
      /^retirada de pauta/,
      /^deliberado em sessao/,
      /adiamento do julgamento/,
    ],
  },
  {
    id: 'incidentes',
    rotulo: 'Incidentes e competência',
    categoria: 'Decisões e julgamento',
    descricao: 'IRDR, IAC, conflito de competência e declarações de competência.',
    inclui: [
      /incidente|demandas repetitivas|tese juridica/,
      /conflito de competencia/,
      /^declarado competente|^decisao\/despacho - declarad[oa] (competente|incompetencia)/,
      /^atribuicao de competencia/,
    ],
    exclui: [/^arquivo/],
  },

  /* ---------------- Audiências e sessões ---------------- */
  {
    id: 'audiencias',
    rotulo: 'Audiências (todas)',
    categoria: 'Audiências e sessões',
    descricao: 'Qualquer evento de audiência, de qualquer tipo.',
    inclui: [/^audiencia/],
  },
  {
    id: 'audiencias-designadas',
    rotulo: 'Audiências designadas',
    categoria: 'Audiências e sessões',
    descricao: 'Audiência designada, redesignada ou antecipada.',
    inclui: [
      /^(audiencia|sessao do tribunal do juri) .*(designada|antecipada)/,
      /^comunicacao eletronica recebida - audiencia \(re\)designada/,
    ],
  },
  {
    id: 'audiencias-realizadas',
    rotulo: 'Audiências realizadas',
    categoria: 'Audiências e sessões',
    descricao: 'Audiência realizada, com ou sem acordo.',
    inclui: [
      /^(audiencia|sessao do tribunal do juri) .*\brealizada/,
      /^comunicacao eletronica recebida – audiencia realizada/,
    ],
    exclui: [/nao[- ]realizada/],
  },
  {
    id: 'audiencias-nao-realizadas',
    rotulo: 'Audiências não realizadas ou adiadas',
    categoria: 'Audiências e sessões',
    descricao: 'Audiência cancelada, não realizada, adiada ou convertida em diligência.',
    inclui: [
      /^(audiencia|sessao do tribunal do juri) .*(nao[- ]realizada|cancelada|adiada|convertida em diligencia)/,
    ],
  },
  {
    id: 'juri',
    rotulo: 'Sessões do Júri',
    categoria: 'Audiências e sessões',
    descricao: 'Sessão do Tribunal do Júri designada, realizada, adiada ou cancelada.',
    inclui: [/^sessao do tribunal do juri/],
  },
  {
    id: 'conciliacao',
    rotulo: 'Conciliação e acordo',
    categoria: 'Audiências e sessões',
    descricao: 'Audiências e remessas de conciliação/mediação, CEJUSC e manifestações sobre acordo.',
    inclui: [
      /concilia|mediacao|cejusc/,
      /termo de acordo|negativa de acordo|acordo homologado|homologada a transacao/,
    ],
  },
  {
    id: 'restaurativa',
    rotulo: 'Justiça restaurativa',
    categoria: 'Audiências e sessões',
    descricao: 'Sessões e procedimentos restaurativos.',
    inclui: [/^sessao restaurativa/, /procedimento restaurativo/],
  },
  {
    id: 'pericias',
    rotulo: 'Perícias e laudos',
    categoria: 'Audiências e sessões',
    descricao: 'Perícia designada, realizada ou cancelada, e intimações sobre laudo e perito.',
    inclui: [/^pericia/, /laudo/, /perito/, /para designar pericia/],
  },

  /* ---------------- Diligências ---------------- */
  {
    id: 'expedicoes',
    rotulo: 'Expedição de documentos',
    categoria: 'Diligências',
    descricao: 'Mandados, cartas, ofícios, editais, termos e alvarás expedidos.',
    inclui: [/^expedicao de/, /^expedido mandado/, /^expedida ordem de liberacao/],
  },
  {
    id: 'juntadas',
    rotulo: 'Juntadas (todas)',
    categoria: 'Diligências',
    descricao: 'Qualquer evento "Juntada de…".',
    inclui: [/^juntada|protocolada juntada/],
  },
  {
    id: 'mandados',
    rotulo: 'Mandados e oficial de justiça',
    categoria: 'Diligências',
    descricao: 'Expedição, recebimento pelo oficial e devolução de mandados.',
    inclui: [/mandado|oficial de justica/],
    exclui: [/mandado de seguranca/],
  },
  {
    id: 'cumprido',
    rotulo: 'Mandados e cartas cumpridos',
    categoria: 'Diligências',
    descricao: 'Mandado, carta ou ofício devolvido cumprido, total ou parcialmente.',
    inclui: [
      /^juntada de (mandado|carta|oficio).*cumprid/,
      /comprovante de entrega/,
      /^comunicacao eletronica recebida - juntada carta .*cumprida/,
      /^remetidos os autos cumpridos/,
    ],
    exclui: [/nao cumprid|negativo|sem cumprimento/],
  },
  {
    id: 'nao-cumprido',
    rotulo: 'Mandados e cartas não cumpridos',
    categoria: 'Diligências',
    descricao: 'Mandado, carta ou ofício não cumprido, negativo ou devolvido sem cumprimento.',
    inclui: [/nao cumprid|cumprido negativo|sem cumprimento|ar\/mandado negativo/],
  },

  /* ---------------- Arquivo e suspensão ---------------- */
  {
    id: 'arquivo',
    rotulo: 'Arquivamento e baixa',
    categoria: 'Arquivo e suspensão',
    descricao: 'Arquivo provisório, guarda intermediária ou permanente, e baixa definitiva.',
    inclui: [
      /^arquiv/,
      /^baixa definitiva/,
      /^gestao documental|^autos eliminados|^entrega definitiva dos autos/,
    ],
  },
  {
    id: 'arquivo-provisorio',
    rotulo: 'Arquivamento provisório',
    categoria: 'Arquivo e suspensão',
    descricao: 'Arquivado provisoriamente (art. 40 da LEF, art. 921 do CPC, débito inferior).',
    inclui: [/^arquivado provisoriamente/],
  },
  {
    id: 'suspensao',
    rotulo: 'Suspensão e sobrestamento',
    categoria: 'Arquivo e suspensão',
    descricao: 'Processo suspenso ou sobrestado, por qualquer motivo.',
    inclui: [
      /^processo suspenso/,
      /^suspensao/,
      /^suspenso o processo|^determinacao de suspensao|^cumprimento de suspensao/,
    ],
  },
  {
    id: 'reativacao',
    rotulo: 'Fim de suspensão e reativação',
    categoria: 'Arquivo e suspensão',
    descricao: 'Levantada a suspensão ou o sobrestamento, e processo reativado.',
    inclui: [/^levantada a (causa suspensiva|suspensao)/, /^processo reativado/],
  },

  /* ---------------- Valores e bens ---------------- */
  {
    id: 'requisicoes',
    rotulo: 'Requisições de pagamento',
    categoria: 'Valores e bens',
    descricao: 'RPV e precatório: preparo, envio, pagamento, bloqueio e cancelamento.',
    inclui: [/requisicao de pagamento/, /^requisicao/, /requisitorio/, /- requisicao$/],
  },
  {
    id: 'pagamentos',
    rotulo: 'Pagamentos, depósitos e custas',
    categoria: 'Valores e bens',
    descricao: 'Atos cumpridos pela parte, depósitos judiciais, guias e custas pagas.',
    inclui: [
      /^ato cumprido pela parte/,
      /deposito judicial/,
      /(guia|gru).* paga/,
      /custas pagas|pagamento de custas/,
    ],
  },
  {
    id: 'calculos',
    rotulo: 'Cálculos e contadoria',
    categoria: 'Valores e bens',
    descricao: 'Cálculos realizados, conta atualizada e remessas à contadoria.',
    inclui: [/calculo|contadoria|^conta atualizada/],
  },
  {
    id: 'alvaras',
    rotulo: 'Alvarás',
    categoria: 'Valores e bens',
    descricao: 'Expedição, entrega e pagamento de alvarás.',
    inclui: [/alvara/],
    exclui: [/soltura|salvo-conduto/],
  },
  {
    id: 'constricao',
    rotulo: 'Penhora e bloqueio de bens',
    categoria: 'Valores e bens',
    descricao: 'Penhora, SISBAJUD/BACENJUD, RENAJUD, INFOJUD, indisponibilidade e restrições cadastrais.',
    inclui: [/penhora|bloqueio de valores|sisbajud|bacenjud|renajud|infojud|indisponibilidade|serasajud|\bspc\b/],
  },
  {
    id: 'leilao',
    rotulo: 'Leilão e expropriação',
    categoria: 'Valores e bens',
    descricao: 'Leilão, adjudicação, arrematação e alienação.',
    inclui: [/leilao|adjudicacao|arrematacao|alienacao/],
  },

  /* ---------------- Criminal ---------------- */
  {
    id: 'prisao-liberdade',
    rotulo: 'Prisão e liberdade',
    categoria: 'Criminal',
    descricao: 'Prisão, liberdade provisória, soltura, internação e medidas cautelares pessoais.',
    inclui: [/prisao|soltura|liberdade provisoria|salvo-conduto|internacao|flagrante|ordem de liberacao/],
  },
  {
    id: 'acao-penal',
    rotulo: 'Denúncia e ação penal',
    categoria: 'Criminal',
    descricao: 'Denúncia recebida ou rejeitada, acordo de não persecução e tramitação direta com a polícia.',
    inclui: [/denuncia|queixa|nao persecucao|tramitacao direta/],
  },
  {
    id: 'execucao-penal',
    rotulo: 'Execução penal',
    categoria: 'Criminal',
    descricao: 'Progressão, livramento, indulto, saídas, unificação de penas e extinção da punibilidade.',
    inclui: [
      /progressao de regime|livramento condicional|indulto|saida temporaria|permissao de saida|trabalho externo|execucao da pena|estabelecimento penal|suspensao condicional da pena|unificadas e somadas|titulo executivo penal|rol de culpados|punibilidade|cumprimento de pena|\bpec\b/,
    ],
  },
];
