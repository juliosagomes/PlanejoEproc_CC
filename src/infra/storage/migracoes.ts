import {
  FLAG_ESPERA_ID,
  FLAG_FIXO_ID,
  FLAG_GATILHO_ID,
  FLAG_TRABALHADO_ID,
  SCHEMA_VERSION,
  flagsPadrao,
  type DefinicaoFlag,
  type Localizador,
  type Plano,
} from '@/domain';
import type { PlanoV1 } from './schema';

/**
 * Migração v1 → v2: as quatro flags fixas viram a lista editável do plano
 * (decisoes.md#D-22).
 *
 * Função pura, separada do schema, porque é ela que carrega a decisão de
 * produto — o que preservar e o que descartar — e isso precisa de teste próprio.
 */

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

export function migrarPlanoV1(v1: PlanoV1): Plano {
  const nodes: Localizador[] = v1.nodes.map((n) => ({
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
    version: SCHEMA_VERSION,
    flags: [...flagsPadrao(), ...extras],
    nodes,
  };
}
