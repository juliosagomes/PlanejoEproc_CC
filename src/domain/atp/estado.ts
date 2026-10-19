import type { AtpRule } from '.';
import { parametrosVazios } from './campos';
import type { AtpTrigger } from './gatilho';

/* ============================================================================
 * O QUE JÁ FOI PREENCHIDO NA REGRA DE ATP (decisoes.md#D-44, D-45)
 *
 * O cartão do recurso no painel e a navegação do modal mostram o estado de
 * cada um dos três blocos da tela do Eproc, e a frase em português grifa o que
 * falta. Os três leem daqui, para que "completo" signifique a mesma coisa nos
 * três lugares.
 *
 * Só o bloco Regras tem campo obrigatório. Executar Ação e Filtros Opcionais
 * são opcionais na tela: vazios não são pendência, e só uma ação sem tipo é.
 * ========================================================================== */

export type EstadoBloco = 'completo' | 'parcial' | 'vazio';

/** Onde mora o campo que falta. O modal usa para rolar até ele. */
export type AlvoPendencia =
  | 'multiplos'
  | 'comportamento'
  | 'tipoControle'
  | 'gatilho'
  | `acao:${string}`;

export interface Pendencia {
  alvo: AlvoPendencia;
  /** O que falta, em minúsculas, para caber numa frase: "comportamento da origem". */
  texto: string;
}

export interface EstadoBlocosAtp {
  regras: EstadoBloco;
  acao: EstadoBloco;
  filtros: EstadoBloco;
  pendencias: Pendencia[];
  acoes: number;
  filtrosPreenchidos: number;
}

const vazia = (lista: readonly string[] | undefined) => !lista || lista.length === 0;
const semEntidade = (t: { restringirA?: string; entidade?: string }) =>
  t.restringirA === 'S' && !t.entidade?.trim();

/**
 * O campo principal do tipo de controle que ainda está em branco. "Por Ação
 * Manual" não tem nenhum: a descrição é opcional na tela.
 */
export function faltaNoGatilho(t: AtpTrigger): string | undefined {
  switch (t.tipo) {
    case 'A':
      if (vazia(t.eventoIds) && vazia(t.peticaoTipoIds) && vazia(t.documentos)) {
        return 'evento, tipo de petição ou documento';
      }
      return semEntidade(t) ? 'entidade' : undefined;
    case 'E':
      return vazia(t.eventoIds) ? 'evento' : undefined;
    case 'P':
      if (vazia(t.peticaoTipoIds)) return 'tipo de petição';
      return semEntidade(t) ? 'entidade' : undefined;
    case 'O':
      return t.documento?.trim() ? undefined : 'tipo de documento';
    case 'D':
      if (!t.tipoData) return 'quando a regra roda';
      if (t.tipoData === 'D' && !t.data) return 'data';
      if (t.tipoData === 'M' && t.diaMes == null) return 'dia do mês';
      if (t.tipoData === 'S' && !t.diaSemana) return 'dia da semana';
      return undefined;
    case 'L':
      return t.dias == null ? 'quantos dias no localizador' : undefined;
    case 'S':
      if (!t.statusId) return 'situação';
      return t.dias == null ? 'quantos dias na situação' : undefined;
    case 'V':
      return t.dias == null ? 'quantos dias sem movimentação' : undefined;
    case 'M':
      return undefined;
  }
}

function pendenciasRegras(r: AtpRule): Pendencia[] {
  const out: Pendencia[] = [];
  if ((r.outrasOrigens?.length ?? 0) > 0 && !r.opcaoMultiplosLocalizadores) {
    out.push({ alvo: 'multiplos', texto: 'condição "OU" ou "E" entre as origens' });
  }
  if (!r.comportamentoOrigem) out.push({ alvo: 'comportamento', texto: 'comportamento da origem' });
  if (!r.trigger) {
    out.push({ alvo: 'tipoControle', texto: 'tipo de controle' });
  } else {
    const falta = faltaNoGatilho(r.trigger);
    if (falta) out.push({ alvo: 'gatilho', texto: falta });
  }
  return out;
}

export function estadoBlocosAtp(rule: AtpRule | undefined): EstadoBlocosAtp {
  const r: AtpRule = rule ?? { implantar: false };
  const regras = pendenciasRegras(r);
  const acoes = r.acoes ?? [];
  const semTipo: Pendencia[] = acoes.flatMap((a, i) =>
    a.tipo ? [] : [{ alvo: `acao:${a.id}` as const, texto: `tipo da ${i + 1}ª ação` }],
  );
  const filtrosPreenchidos = Object.values(r.filtros ?? {}).filter((p) => !parametrosVazios(p)).length;
  const comecou = !!r.comportamentoOrigem || !!r.trigger || (r.outrasOrigens?.length ?? 0) > 0;
  return {
    regras: regras.length === 0 ? 'completo' : comecou ? 'parcial' : 'vazio',
    acao: acoes.length === 0 ? 'vazio' : semTipo.length > 0 ? 'parcial' : 'completo',
    filtros: filtrosPreenchidos > 0 ? 'completo' : 'vazio',
    pendencias: [...regras, ...semTipo],
    acoes: acoes.length,
    filtrosPreenchidos,
  };
}
