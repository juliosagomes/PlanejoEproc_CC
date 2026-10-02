import type { OpcaoCampo } from './campos';

/* ============================================================================
 * BLOCO "REGRAS" DO CADASTRO DE ATP
 *
 * Os 9 tipos de controle espelham `selTipoControle` do Eproc:
 *   A — Por Evento OU Tipo de Petição OU Documento
 *   E — Por Evento
 *   P — Por Tipo de Petição
 *   O — Por Documento
 *   D — Por Data ou Periodicamente
 *   L — Por Tempo no Localizador
 *   S — Por Tempo na Situação
 *   V — Verificação Processos Sem Movimentação
 *   M — Por Ação Manual
 *
 * Os campos de cada variante são os que a tela mostra ao escolher o tipo
 * (decisoes.md#D-27). Os localizadores de origem e destino não aparecem aqui:
 * são as pontas da própria aresta.
 * ========================================================================== */

export const TIPO_CONTROLE_VALUES = ['A', 'E', 'P', 'O', 'D', 'L', 'S', 'V', 'M'] as const;

export type TipoControle = (typeof TIPO_CONTROLE_VALUES)[number];

/** `selTipoDataControle` — os quatro modos do gatilho "Por Data ou Periodicamente". */
export const TIPOS_DATA_CONTROLE = [
  { value: 'T', label: 'Todos os dias' },
  { value: 'D', label: 'Em data específica' },
  { value: 'M', label: 'Em um dia específico do mês' },
  { value: 'S', label: 'Em um dia específico da semana' },
] as const satisfies readonly OpcaoCampo[];

export type TipoDataControle = (typeof TIPOS_DATA_CONTROLE)[number]['value'];

/**
 * Os rótulos são os de `selDiaSemanaDataControle`; os códigos são **nossos**
 * (0 = domingo) — os do Eproc não foram levantados, e aqui só precisam ser
 * estáveis dentro do plano.
 */
export const DIAS_SEMANA = [
  { value: '0', label: 'Domingo' },
  { value: '1', label: 'Segunda-feira' },
  { value: '2', label: 'Terça-feira' },
  { value: '3', label: 'Quarta-feira' },
  { value: '4', label: 'Quinta-feira' },
  { value: '5', label: 'Sexta-feira' },
  { value: '6', label: 'Sábado' },
] as const satisfies readonly OpcaoCampo[];

/**
 * `selOpcaoLocalizadorDesativacao` — o que a regra faz com o localizador de
 * origem ao mover o processo. Os códigos são os do Eproc, na ordem da tela.
 */
export const COMPORTAMENTOS_ORIGEM = [
  { value: '0', label: 'Remover o processo do(s) localizador(es) informado(s)' },
  {
    value: '4',
    label: 'Remover o processo do(s) localizador(es) informado(s), APENAS os de sistema',
  },
  { value: '1', label: 'Remover o processo de TODOS localizadores' },
  {
    value: '2',
    label: 'Remover o processo de TODOS localizadores, EXCETO os de sistema e os fixos',
  },
  {
    value: '3',
    label: 'NÃO remover o processo de localizador algum (apenas acrescentar o indicado)',
  },
] as const satisfies readonly OpcaoCampo[];

export type ComportamentoOrigem = (typeof COMPORTAMENTOS_ORIGEM)[number]['value'];

export type AtpTrigger =
  | {
      tipo: 'A';
      eventoIds?: string[];
      peticaoTipoIds?: string[];
      /** Tipos de documento, por nome — o catálogo (760 itens) não é embutido. */
      documentos?: string[];
      /** "Restringir petições ou documentos de" — código de `selSinPoloPeticao`. */
      restringirA?: string;
      /** Só faz sentido com `restringirA === 'S'` (entidade específica). */
      entidade?: string;
    }
  | { tipo: 'E'; eventoIds?: string[] }
  | { tipo: 'P'; peticaoTipoIds?: string[]; restringirA?: string; entidade?: string }
  | { tipo: 'O'; documento?: string }
  | {
      tipo: 'D';
      tipoData?: TipoDataControle;
      /** ISO `aaaa-mm-dd`, quando `tipoData === 'D'`. */
      data?: string;
      /** 1 a 31, quando `tipoData === 'M'`. */
      diaMes?: number;
      /** Código de `DIAS_SEMANA`, quando `tipoData === 'S'`. */
      diaSemana?: string;
    }
  | { tipo: 'L'; dias?: number; diasUteis?: boolean }
  | { tipo: 'S'; statusId?: string; dias?: number; diasUteis?: boolean }
  | { tipo: 'V'; dias?: number }
  | {
      tipo: 'M';
      /** "Descrição da Regra" — o único tipo em que o Eproc dá nome à regra. */
      descricao?: string;
      acaoPreferencialNaCapa?: boolean;
      umClique?: boolean;
    };
