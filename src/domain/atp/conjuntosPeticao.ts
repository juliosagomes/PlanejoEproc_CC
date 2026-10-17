/* ============================================================================
 * CONJUNTOS PADRÃO DE TIPOS DE PETIÇÃO (decisoes.md#D-41)
 *
 * Deduzidos de `selTipoPeticaoFiltroMultiplo` (TJMG, outubro/2026, 128 tipos).
 * Lista plana, sem categorias: são poucos conjuntos, e categoria para dois ou
 * três itens só acrescentaria cabeçalho. A redação mistura caixa alta e baixa,
 * e às vezes perde o acento ("NAO-PERSECUÇAO") — por isso as regras casam com
 * o rótulo normalizado.
 * ========================================================================== */

import type { RegraConjunto } from './conjuntos';

export const CONJUNTOS_PETICAO_PADRAO: readonly RegraConjunto[] = [
  {
    id: 'recursos',
    rotulo: 'Recursos e agravos',
    descricao: 'Apelação, agravos, embargos de declaração e infringentes, recursos aos tribunais superiores e contrarrazões.',
    inclui: [
      /^agravo/,
      /^apelacao/,
      /^razoes de/,
      /^recurso/,
      /^embargos (de declaracao|infringentes)/,
      /^contrarrazoes/,
      /^incidente de uniformizacao/,
    ],
  },
  {
    id: 'defesa',
    rotulo: 'Contestação, réplica e impugnações',
    descricao: 'Contestação, defesa prévia, resposta, reconvenção, réplica, impugnações e reconhecimento do pedido.',
    inclui: [
      /^contestacao/,
      /^defesa previa/,
      /^resposta$/,
      /^reconvencao/,
      /^replica/,
      /^impugnacao/,
      /pre-executividade/,
      /^embargos a acao monitoria/,
      /reconhecimento (parcial|total) do pedido/,
    ],
  },
  {
    id: 'alegacoes',
    rotulo: 'Alegações finais e memoriais',
    descricao: 'Alegações finais, memoriais e a manifestação do art. 402 do CPP.',
    inclui: [/^alegacoes finais/, /^memoriais/, /art\. 402 cpp/],
  },
  {
    id: 'conciliacao',
    rotulo: 'Conciliação e acordo',
    descricao: 'Fórum de conciliação, propostas, termo de acordo e (des)interesse na autocomposição.',
    inclui: [/concilia/, /autocomposicao/, /acordo/, /forum/],
    exclui: [/persecucao/],
  },
  {
    id: 'prazo',
    rotulo: 'Prazo: dilação, renúncia e ciência',
    descricao: 'Pedidos de dilação de prazo, renúncia ao prazo e ciência.',
    inclui: [/dilacao de prazo/, /renuncia ao prazo/, /ciencia/],
  },
  {
    id: 'representacao',
    rotulo: 'Procuração e substabelecimento',
    descricao: 'Procuração, constituição de procurador, substabelecimento e renúncia de mandato.',
    inclui: [/procura(cao|dor)/, /substabelecimento/, /renuncia de mandato/],
  },
  {
    id: 'execucao',
    rotulo: 'Execução e cumprimento de sentença',
    descricao: 'Pedido de cumprimento, impugnação, exceção de pré-executividade, cálculos e garantia.',
    inclui: [/cumprimento de sentenca/, /pre-executividade/, /impugnacao aos calculos/, /apresentacao garantia/],
  },
  {
    id: 'restricoes',
    rotulo: 'Restrições online (SISBAJUD, RENAJUD, SERASAJUD, SPC)',
    descricao: 'Solicitações ao SISBAJUD e ao RENAJUD, e inclusão ou retirada de restrição no SERASAJUD e no SPC.',
    inclui: [/sisbajud|renajud|serajud|serasajud|\bspc\b/],
  },
  {
    id: 'pagamentos',
    rotulo: 'Pagamentos, guias e alvarás',
    descricao: 'Guias, depósitos e custas, pagamento e parcelamento, apropriação e pedidos de alvará.',
    inclui: [/guias de recolhimento/, /pagamento/, /alvara/, /apropriacao efetivada/],
  },
  {
    id: 'suspensao',
    rotulo: 'Suspensão, arquivamento e desistência',
    descricao: 'Suspensão (art. 40 da LEF, por parcelamento), pedido de arquivamento e desistência da ação.',
    inclui: [/suspensao/, /arquivamento/, /art\. 40 lef/, /desistencia/],
    exclui: [/condicional do processo/],
  },
  {
    id: 'urgencia',
    rotulo: 'Tutela, liminar e urgência',
    descricao: 'Pedido de liminar ou tutela, reconsideração, prioridade de tramitação e recusa de urgência.',
    inclui: [/liminar|tutela|prioridade|urgencia|reconsideracao/],
  },
  {
    id: 'pericia',
    rotulo: 'Perícia e laudos',
    descricao: 'Laudos, quesitos e não comparecimento do periciado.',
    inclui: [/laudo|quesitos|periciado/],
  },
  {
    id: 'acao-penal',
    rotulo: 'Denúncia e ação penal',
    descricao: 'Denúncia e aditamento, acordo de não persecução, transação penal, suspensão condicional, réu preso e razões criminais.',
    inclui: [
      /denuncia|persecucao|transacao penal|suspensao condicional do processo|reu preso/,
      /razoes de (apelacao criminal|recurso em sentido estrito)/,
    ],
  },
  {
    id: 'mp-policia',
    rotulo: 'Ministério Público e polícia',
    descricao: 'Apreciações e manifestações do MP e da polícia, diligências policiais, relatório final de IPL e encerramento de TC.',
    inclui: [/\bmp\b|policia|\bipl\b|requisicao de diligencia/, /^encerramento de (tc|representacao)/],
  },
  {
    id: 'saude',
    rotulo: 'Saúde: medicamento e internação',
    descricao: 'Medicamento ou internação disponibilizados.',
    inclui: [/medicamento|internacao/],
  },
  {
    id: 'genericas',
    rotulo: 'Petição genérica, juntada e emenda',
    descricao: 'Petição sem tipo específico, juntada de documento e emenda à inicial.',
    inclui: [/^peticao$/, /juntada de documento/, /emenda a inicial/],
  },
];
