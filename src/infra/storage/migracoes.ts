import {
  FLAG_ESPERA_ID,
  FLAG_FIXO_ID,
  FLAG_GATILHO_ID,
  FLAG_TRABALHADO_ID,
  SCHEMA_VERSION,
  flagsPadrao,
  hasPrefDetail,
  type AcaoProgramada,
  type AtpFiltros,
  type AtpRule,
  type AtpTrigger,
  type DefinicaoFlag,
  type Edge,
  type Plano,
  type Subitem,
} from '@/domain';
import { uid } from '@/utils/uid';
import type { AtpRuleV3, PlanoV1, PlanoV2, PlanoV3 } from './schema';

/**
 * Migrações entre versões do plano. Funções puras, separadas do schema, porque
 * são elas que carregam a decisão de produto — o que preservar e o que
 * descartar —, e isso precisa de teste próprio.
 *
 * Encadeáveis: o `PlanoSchema` passa um plano v1 por `migrarPlanoV1`, depois
 * por `migrarPlanoV2` e por `migrarPlanoV3`, para que cada passo continue com
 * um teste só seu.
 */

/* ===========================================================================
 * v1 → v2: as quatro flags fixas viram a lista editável do plano
 * (decisoes.md#D-22).
 * ========================================================================= */

/**
 * Ordem canônica das chaves antigas. Fixa o resultado da migração: um nó com
 * `{gatilho: true, espera: true}` sai sempre na mesma ordem, o que mantém o
 * round-trip comparável e evita diff espúrio no push para a lotação.
 */
const CHAVES_V1 = [
  { chave: 'trabalhado', id: FLAG_TRABALHADO_ID },
  { chave: 'espera', id: FLAG_ESPERA_ID },
  { chave: 'gatilho', id: FLAG_GATILHO_ID },
  { chave: 'fixo', id: FLAG_FIXO_ID },
] as const;

/**
 * `Trabalhado` e `Gatilho` saíram dos padrões — o primeiro ficou redundante com
 * a marcação de setor, o segundo já existe como conceito de ATP nas arestas.
 * Mas apagá-los de planos que os usam seria perder trabalho do usuário em
 * silêncio, então eles voltam como marcadores comuns, prontos para serem
 * removidos à mão.
 */
const EXTRAS: readonly DefinicaoFlag[] = [
  { id: FLAG_TRABALHADO_ID, code: 'T', label: 'Trabalhado', cor: 1 },
  { id: FLAG_GATILHO_ID, code: 'G', label: 'Gatilho', cor: 3 },
];

export function migrarPlanoV1(v1: PlanoV1): PlanoV2 {
  const nodes: PlanoV2['nodes'] = v1.nodes.map((n) => ({
    ...n,
    data: {
      ...n.data,
      flags: CHAVES_V1.filter(({ chave }) => n.data.flags[chave] === true).map(
        ({ id }) => id,
      ),
    },
  }));

  const emUso = new Set(nodes.flatMap((n) => n.data.flags));
  const extras = EXTRAS.filter((f) => emUso.has(f.id));

  return {
    ...v1,
    version: 2,
    flags: [...flagsPadrao(), ...extras],
    nodes,
  };
}

/* ===========================================================================
 * v2 → v3: a regra sai da aresta e vira recurso dela (decisoes.md#D-24).
 * ========================================================================= */

/**
 * A regra vira o **primeiro** recurso da aresta, antes dos que já existiam.
 * Primeiro porque era o conteúdo principal da transição — o que o botão
 * "Detalhar" abria —, e ler a lista de cima para baixo deve continuar contando
 * a mesma história.
 *
 * Regra sem detalhamento nenhum é descartada em vez de virar linha em branco:
 * toda aresta ATP/Preferência tinha um `atp`/`pref` alocado pelo default da
 * store, preenchido ou não, e materializar os vazios encheria de recursos sem
 * nome as arestas de quem nunca abriu o modal.
 */
type SubitemV3 = PlanoV3['edges'][number]['data']['subitems'][number];

/**
 * "Tem detalhamento" na forma que a regra de ATP tinha até a v3. Cópia
 * congelada do predicado da época: o `hasAtpDetail` corrente olha os campos da
 * v4 e responderia errado aqui.
 */
function temDetalheAtpV3(rule: AtpRuleV3): boolean {
  if (rule.implantar) return true;
  if (rule.trigger) return true;
  if (rule.acaoTipo) return true;
  if (rule.acao?.trim()) return true;
  if (rule.condicoes?.trim()) return true;
  if (rule.observacoes?.trim()) return true;
  const f = rule.filtros;
  if (f) {
    if ((f.classesJudiciaisIds?.length ?? 0) > 0) return true;
    if ((f.competenciaIds?.length ?? 0) > 0) return true;
    if ((f.statusProcessoIds?.length ?? 0) > 0) return true;
  }
  return false;
}

function subitensDaAresta(data: PlanoV2['edges'][number]['data']): SubitemV3[] {
  const regras: SubitemV3[] = [];

  // `nome` e `ja_criado` saem da regra e passam a ser do recurso. Os dois
  // também contam como "tem detalhamento" aqui — o predicado já não os
  // considera, e sem isto uma regra batizada ou marcada seria descartada com
  // eles.
  if (data.atp && (temDetalheAtpV3(data.atp) || data.atp.nome.trim() || data.atp.ja_criado)) {
    const { nome, ja_criado, ...atp } = data.atp;
    regras.push({ id: uid('si'), categoria: 'Regra de ATP', nome, ja_criado, atp });
  }
  if (data.pref && (hasPrefDetail(data.pref) || data.pref.nome.trim() || data.pref.ja_criado)) {
    const { nome, ja_criado, ...pref } = data.pref;
    regras.push({ id: uid('si'), categoria: 'Preferência', nome, ja_criado, pref });
  }

  return [...regras, ...data.subitems];
}

export function migrarPlanoV2(v2: PlanoV2): PlanoV3 {
  const edges: PlanoV3['edges'] = v2.edges.map((e) => {
    // Desestruturar é o que efetivamente apaga `atp`/`pref` do dado gravado;
    // um spread simples os carregaria adiante, fora do schema da v3.
    const { atp: _atp, pref: _pref, ...resto } = e.data;
    return {
      ...e,
      data: { ...resto, subitems: subitensDaAresta(e.data) },
    };
  });

  return { ...v2, version: 3, edges };
}

/* ===========================================================================
 * v3 → v4: a regra de ATP passa a espelhar a tela de cadastro do Eproc
 * (decisoes.md#D-27).
 *
 * O que tinha lugar na forma nova vai para ele. O que não tinha — os dois
 * textos livres, a periodicidade em dias, listas que encolheram para um valor
 * só — vai para Observações com rótulo. Nada é descartado: o usuário reescreve
 * no campo certo quando abrir a regra, com o texto antigo à vista.
 * ========================================================================= */

type GatilhoV3 = NonNullable<AtpRuleV3['trigger']>;

function listaNaoVazia(xs: string[] | undefined): xs is string[] {
  return (xs?.length ?? 0) > 0;
}

/** `sobras` recebe, em texto, o que a forma nova do gatilho não comporta. */
function migrarGatilhoV3(t: GatilhoV3, sobras: string[]): AtpTrigger {
  switch (t.tipo) {
    case 'A':
      // O id de tipo de documento nunca teve catálogo nem campo no modal; se
      // houver algum, não há rótulo para traduzi-lo.
      if (listaNaoVazia(t.documentoTipoIds)) {
        sobras.push(`Tipos de documento (códigos): ${t.documentoTipoIds.join(', ')}`);
      }
      return {
        tipo: 'A',
        ...(t.eventoIds ? { eventoIds: t.eventoIds } : {}),
        ...(t.peticaoTipoIds ? { peticaoTipoIds: t.peticaoTipoIds } : {}),
      };
    case 'E':
      return { tipo: 'E', ...(t.eventoIds ? { eventoIds: t.eventoIds } : {}) };
    case 'P':
      return { tipo: 'P', ...(t.peticaoTipoIds ? { peticaoTipoIds: t.peticaoTipoIds } : {}) };
    case 'O':
      if (listaNaoVazia(t.documentoTipoIds)) {
        sobras.push(`Tipos de documento (códigos): ${t.documentoTipoIds.join(', ')}`);
      }
      return { tipo: 'O' };
    case 'D': {
      if (t.data) {
        if (t.periodicidadeDias != null) {
          sobras.push(`Periodicidade: ${t.periodicidadeDias} dia(s)`);
        }
        return { tipo: 'D', tipoData: 'D', data: t.data };
      }
      // "A cada 1 dia" é exatamente o "Todos os dias" do Eproc. Qualquer outro
      // intervalo não existe lá, e fica anotado.
      if (t.periodicidadeDias === 1) return { tipo: 'D', tipoData: 'T' };
      if (t.periodicidadeDias != null) {
        sobras.push(`Periodicidade: ${t.periodicidadeDias} dia(s)`);
      }
      return { tipo: 'D' };
    }
    case 'L':
      if (listaNaoVazia(t.localizadorIds)) {
        sobras.push(`Localizadores do gatilho: ${t.localizadorIds.join(', ')}`);
      }
      return { tipo: 'L', ...(t.diasNoLocalizador != null ? { dias: t.diasNoLocalizador } : {}) };
    case 'S': {
      const [statusId, ...resto] = t.statusIds ?? [];
      if (resto.length > 0) sobras.push(`Outras situações do gatilho: ${resto.join(', ')}`);
      return {
        tipo: 'S',
        ...(statusId ? { statusId } : {}),
        ...(t.diasNaSituacao != null ? { dias: t.diasNaSituacao } : {}),
      };
    }
    case 'V':
      return {
        tipo: 'V',
        ...(t.diasSemMovimentacao != null ? { dias: t.diasSemMovimentacao } : {}),
      };
    case 'M':
      return { tipo: 'M' };
  }
}

/** Os três filtros da v3 passam a ser indexados pelo id do campo no Eproc. */
function migrarFiltrosV3(f: NonNullable<AtpRuleV3['filtros']>): AtpFiltros {
  const saida: AtpFiltros = {};
  const levar = (chave: string, ids: string[] | undefined) => {
    if (listaNaoVazia(ids)) saida[chave] = { [chave]: ids };
  };
  levar('selClassesJudiciaisMultiplo', f.classesJudiciaisIds);
  levar('selCompetencia', f.competenciaIds);
  levar('selStatusProcessoMultiplo', f.statusProcessoIds);
  return saida;
}

export function migrarRegraAtpV3(r: AtpRuleV3): AtpRule {
  const sobras: string[] = [];
  const trigger = r.trigger ? migrarGatilhoV3(r.trigger, sobras) : undefined;

  const acoes: AcaoProgramada[] = r.acaoTipo ? [{ id: uid('ac'), tipo: r.acaoTipo }] : [];
  if (r.acao?.trim()) sobras.push(`Detalhes da ação: ${r.acao.trim()}`);
  if (r.condicoes?.trim()) sobras.push(`Condições: ${r.condicoes.trim()}`);

  const filtros = r.filtros ? migrarFiltrosV3(r.filtros) : {};
  const observacoes = [r.observacoes?.trim() ?? '', ...sobras].filter(Boolean).join('\n\n');

  return {
    implantar: r.implantar,
    ...(trigger ? { trigger } : {}),
    ...(acoes.length > 0 ? { acoes } : {}),
    ...(Object.keys(filtros).length > 0 ? { filtros } : {}),
    ...(observacoes ? { observacoes } : {}),
  };
}

export function migrarPlanoV3(v3: PlanoV3): Plano {
  const edges: Edge[] = v3.edges.map((e) => ({
    ...e,
    data: {
      ...e.data,
      subitems: e.data.subitems.map((s): Subitem => {
        const { atp, ...resto } = s;
        return atp ? { ...resto, atp: migrarRegraAtpV3(atp) } : resto;
      }),
    },
  }));

  return { ...v3, version: SCHEMA_VERSION, edges };
}
