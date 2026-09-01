import {
  FLAG_ESPERA_ID,
  FLAG_FIXO_ID,
  FLAG_GATILHO_ID,
  FLAG_TRABALHADO_ID,
  SCHEMA_VERSION,
  flagsPadrao,
  hasAtpDetail,
  hasPrefDetail,
  type DefinicaoFlag,
  type Edge,
  type Plano,
  type Subitem,
} from '@/domain';
import { uid } from '@/utils/uid';
import type { PlanoV1, PlanoV2 } from './schema';

/**
 * Migrações entre versões do plano. Funções puras, separadas do schema, porque
 * são elas que carregam a decisão de produto — o que preservar e o que
 * descartar —, e isso precisa de teste próprio.
 *
 * Encadeáveis: o `PlanoSchema` passa um plano v1 por `migrarPlanoV1` e depois
 * por `migrarPlanoV2`, para que cada passo continue com um teste só seu.
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
function subitensDaAresta(data: PlanoV2['edges'][number]['data']): Subitem[] {
  const regras: Subitem[] = [];

  // `nome` sai da regra e vira o nome do recurso, então também conta como
  // "tem detalhamento" aqui — `hasAtpDetail` já não o considera, e sem este
  // `||` uma regra que só tinha nome seria descartada com ele.
  if (data.atp && (hasAtpDetail(data.atp) || data.atp.nome.trim())) {
    const { nome, ...rule } = data.atp;
    regras.push({
      id: uid('si'),
      categoria: 'Regra de ATP',
      nome,
      ja_criado: rule.ja_criado,
      atp: rule,
    });
  }
  if (data.pref && (hasPrefDetail(data.pref) || data.pref.nome.trim())) {
    const { nome, ...rule } = data.pref;
    regras.push({
      id: uid('si'),
      categoria: 'Preferência',
      nome,
      ja_criado: rule.ja_criado,
      pref: rule,
    });
  }

  return [...regras, ...data.subitems];
}

export function migrarPlanoV2(v2: PlanoV2): Plano {
  const edges: Edge[] = v2.edges.map((e) => {
    // Desestruturar é o que efetivamente apaga `atp`/`pref` do dado gravado;
    // um spread simples os carregaria adiante, fora do schema da v3.
    const { atp: _atp, pref: _pref, ...resto } = e.data;
    return {
      ...e,
      data: { ...resto, subitems: subitensDaAresta(e.data) },
    };
  });

  return { ...v2, version: SCHEMA_VERSION, edges };
}
