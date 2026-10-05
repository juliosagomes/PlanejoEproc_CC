/* ============================================================================
 * CONJUNTOS DE EVENTOS (decisoes.md#D-29)
 *
 * O catálogo de eventos do Eproc tem 1.077 itens. Uma regra de ATP do tipo
 * "qualquer evento, exceto os de mera ciência" seleciona mais de mil deles, e
 * o modal virava uma parede de chips. Conjunto é um **atalho de seleção e de
 * leitura**: o plano continua gravando a lista explícita de ids (é ela que se
 * marca no Eproc), e o conjunto só ajuda a montá-la e a descrevê-la.
 *
 * Os conjuntos padrão são **regras sobre o rótulo**, e não listas de ids: o
 * catálogo embutido muda de versão e de tribunal, e uma regra continua valendo
 * para o evento novo que siga a mesma redação. As regras foram deduzidas da
 * própria lista (TJMG, 1º grau, outubro/2026) — a redação do Eproc é muito
 * regular ("Audiência de X designada", "Juntada de Mandado - Cumprido"…), e é
 * essa regularidade que torna os conjuntos confiáveis.
 *
 * O teste em `features/eventos/conjuntos.test.ts` confere cada conjunto contra
 * o catálogo real: tamanho mínimo e exemplos que precisam (e não podem) estar.
 * ========================================================================== */

export interface RegraConjuntoEvento {
  id: string;
  rotulo: string;
  categoria: CategoriaConjunto;
  /** Uma frase para o usuário saber o critério sem abrir a lista. */
  descricao: string;
  /** Casam com o rótulo **normalizado** (`normalizarRotuloEvento`). */
  inclui: readonly RegExp[];
  exclui?: readonly RegExp[];
}

export const CATEGORIAS_CONJUNTO = [
  'Comunicação e prazos',
  'Andamento',
  'Decisões e julgamento',
  'Audiências e sessões',
  'Diligências',
  'Arquivo e suspensão',
  'Valores e bens',
  'Criminal',
] as const;

export type CategoriaConjunto = (typeof CATEGORIAS_CONJUNTO)[number];

/**
 * Sem acento e em minúsculas. A redação do catálogo é inconsistente —
 * "Decisao/Despacho", "prisao", "Concedida a substituiçao" ao lado de
 * "substituição" —, e regra com acento erraria metade dos casos.
 */
export function normalizarRotuloEvento(rotulo: string): string {
  return rotulo.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();
}

export const CONJUNTOS_EVENTO_PADRAO: readonly RegraConjuntoEvento[] = [
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

/** Conjunto já resolvido contra um catálogo — padrão ou criado pelo usuário. */
export interface ConjuntoEvento {
  id: string;
  rotulo: string;
  categoria?: CategoriaConjunto;
  descricao?: string;
  ids: readonly string[];
  personalizado: boolean;
}

interface EventoCatalogo {
  value: string;
  label: string;
}

export function resolverConjuntosPadrao(
  eventos: readonly EventoCatalogo[],
  regras: readonly RegraConjuntoEvento[] = CONJUNTOS_EVENTO_PADRAO,
): ConjuntoEvento[] {
  const normalizados = eventos.map((e) => ({ id: e.value, rotulo: normalizarRotuloEvento(e.label) }));
  return regras.map((r) => ({
    id: r.id,
    rotulo: r.rotulo,
    categoria: r.categoria,
    descricao: r.descricao,
    personalizado: false,
    ids: normalizados
      .filter(
        (e) =>
          r.inclui.some((re) => re.test(e.rotulo)) && !(r.exclui ?? []).some((re) => re.test(e.rotulo)),
      )
      .map((e) => e.id),
  }));
}

/* ============================================================================
 * RESUMO DE UMA SELEÇÃO
 * ========================================================================== */

export type ResumoSelecaoEventos =
  | { modo: 'vazio' }
  | { modo: 'todos'; total: number }
  /** A seleção é a união de `conjuntos` mais os `avulsos`. */
  | { modo: 'inclusao'; conjuntos: ConjuntoEvento[]; avulsos: string[]; total: number }
  /** A seleção é tudo, menos os `conjuntos` e menos os `avulsos`. */
  | { modo: 'exclusao'; conjuntos: ConjuntoEvento[]; avulsos: string[]; total: number };

/**
 * Cobre `alvo` com conjuntos inteiramente contidos nele, maiores primeiro; o
 * que sobra vira avulso. Guloso, e não ótimo — mas a pergunta aqui é "como
 * dizer isto em poucas palavras", não um problema de cobertura exata.
 */
function cobrir(alvo: ReadonlySet<string>, conjuntos: readonly ConjuntoEvento[]) {
  const candidatos = conjuntos
    .filter((c) => c.ids.length > 0 && c.ids.every((id) => alvo.has(id)))
    .sort((a, b) => b.ids.length - a.ids.length);
  const coberto = new Set<string>();
  const escolhidos: ConjuntoEvento[] = [];
  for (const c of candidatos) {
    if (c.ids.every((id) => coberto.has(id))) continue;
    escolhidos.push(c);
    for (const id of c.ids) coberto.add(id);
  }
  const avulsos = [...alvo].filter((id) => !coberto.has(id));
  return { escolhidos, avulsos };
}

/**
 * Descreve a seleção pelo caminho mais curto: "estes conjuntos e mais estes
 * eventos", ou "tudo, exceto estes conjuntos e estes eventos". A exclusão só é
 * considerada quando mais da metade do catálogo está marcada.
 *
 * Ids fora do `universo` (evento que saiu do catálogo) entram como avulsos da
 * inclusão: sumir com eles esconderia algo gravado no plano.
 */
export function resumirSelecaoEventos(
  selecionados: readonly string[],
  universo: readonly string[],
  conjuntos: readonly ConjuntoEvento[],
): ResumoSelecaoEventos {
  const sel = new Set(selecionados);
  if (sel.size === 0) return { modo: 'vazio' };
  const todos = new Set(universo);
  const foraDoUniverso = [...sel].filter((id) => !todos.has(id));
  if (foraDoUniverso.length === 0 && universo.every((id) => sel.has(id))) {
    return { modo: 'todos', total: sel.size };
  }

  const inc = cobrir(sel, conjuntos);
  const custoInc = inc.escolhidos.length + inc.avulsos.length;
  const resumoInc = {
    modo: 'inclusao' as const,
    conjuntos: inc.escolhidos,
    avulsos: inc.avulsos,
    total: sel.size,
  };
  if (foraDoUniverso.length > 0 || sel.size * 2 <= universo.length) return resumoInc;

  const complemento = new Set(universo.filter((id) => !sel.has(id)));
  const exc = cobrir(complemento, conjuntos);
  const custoExc = exc.escolhidos.length + exc.avulsos.length;
  if (custoExc < custoInc) {
    return { modo: 'exclusao', conjuntos: exc.escolhidos, avulsos: exc.avulsos, total: sel.size };
  }
  return resumoInc;
}

/* ============================================================================
 * CONJUNTOS PERSONALIZADOS (da unidade)
 * ========================================================================== */

export const CONJUNTOS_EVENTO_VERSION = 1 as const;

export interface ConjuntoEventoPersonalizado {
  id: string;
  rotulo: string;
  ids: string[];
}

/**
 * A lista é da **unidade** — uma chave por silo, como os setores (D-26) —, e
 * não do plano: o plano já grava os ids explícitos, então o conjunto é só um
 * atalho de quem monta a regra, e não precisa viajar com ele.
 */
export interface ConjuntosEventoUnidade {
  version: typeof CONJUNTOS_EVENTO_VERSION;
  itens: ConjuntoEventoPersonalizado[];
}
