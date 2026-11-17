import type { AtpRule, RegraAtpUnidade } from '@/domain';
import { detalhesAtp } from '@/features/checklist/detalhesAtp';
import { chaveNome } from '@/features/painel/presencaRegras';

/* ============================================================================
 * CONFERIR O RECURSO COM A REGRA DO EPROC (decisoes.md#D-46)
 *
 * O recurso guarda o nº da regra (`Subitem.eprocAtp`). Com a regra no
 * catálogo da unidade, dá para preencher o detalhe a partir do Eproc ou
 * apontar o que difere. A régua campo a campo é a do checklist
 * (`detalhesAtp`): o que ele mostra igual, está igual.
 *
 * As pontas da aresta nunca mudam por aqui. Se a origem ou o destino do Eproc
 * é outro, a conferência só avisa: mover seta é decisão do usuário.
 * ========================================================================== */

/** Os outros localizadores, tirando o que já é a ponta da aresta (D-42). */
function outros(doEproc: readonly string[], ponta: string): string[] {
  const chave = chaveNome(ponta);
  const sem = doEproc.filter((n) => chaveNome(n) !== chave);
  // A ponta não está entre eles: o primeiro do Eproc faz as vezes de ponta.
  return sem.length === doEproc.length ? sem.slice(1) : sem;
}

/**
 * A regra do Eproc no formato do recurso desta aresta. `implantar` e
 * `observacoes` são do plano e ficam como estão.
 */
export function regraDoEproc(
  regra: RegraAtpUnidade,
  atual: AtpRule | undefined,
  pontas: { origem: string; destino: string; pendurada?: boolean },
): AtpRule {
  const base: AtpRule = regra.detalhe ?? { implantar: false };
  const outrasOrigens = regra.tipoOrigem === 'localizadores' ? outros(regra.origens, pontas.origem) : [];
  const outrosDestinos = pontas.pendurada ? [] : outros(regra.destinos, pontas.destino);
  const opcao = base.opcaoMultiplosLocalizadores ?? regra.opcaoOrigens;
  const { outrasOrigens: _o, outrosDestinos: _d, opcaoMultiplosLocalizadores: _m, ...resto } = base;
  return {
    ...resto,
    implantar: atual?.implantar ?? false,
    ...(outrasOrigens.length ? { outrasOrigens } : {}),
    ...(outrasOrigens.length && opcao ? { opcaoMultiplosLocalizadores: opcao } : {}),
    ...(outrosDestinos.length ? { outrosDestinos } : {}),
    ...(atual?.observacoes ? { observacoes: atual.observacoes } : {}),
  };
}

export interface DiferencaCampo {
  label: string;
  plano?: string;
  eproc?: string;
}

export interface Conferencia {
  /** Origem e destino que não batem, em frase. Só aviso. */
  pontas: string[];
  /** Campos que diferem; vazio quando o detalhe confere ou não veio. */
  campos: DiferencaCampo[];
  /** O Eproc já trouxe o detalhe? Sem ele só as pontas são conferidas. */
  comDetalhe: boolean;
}

export function conferirRegra(
  regra: RegraAtpUnidade,
  atual: AtpRule | undefined,
  pontas: { origem: string; destino: string; pendurada?: boolean },
): Conferencia {
  const avisos: string[] = [];
  if (!regra.ativa) avisos.push('A regra está desativada no Eproc.');

  const origensEproc = regra.tipoOrigem === 'localizadores' ? regra.origens : (regra.filtroContem ?? []);
  if (
    regra.tipoOrigem !== 'todos' &&
    origensEproc.length > 0 &&
    !origensEproc.some((n) => chaveNome(n) === chaveNome(pontas.origem)) &&
    !(regra.tipoOrigem === 'nenhum' && pontas.origem.startsWith('Entrada por evento'))
  ) {
    avisos.push(`No Eproc a origem é ${origensEproc.join(regra.opcaoOrigens === 'AND' ? ' E ' : ' OU ')}.`);
  }
  if (
    !pontas.pendurada &&
    regra.destinos.length > 0 &&
    !regra.destinos.some((n) => chaveNome(n) === chaveNome(pontas.destino))
  ) {
    avisos.push(`No Eproc o destino é ${regra.destinos.join(' E ')}.`);
  }

  if (!regra.detalhe) return { pontas: avisos, campos: [], comDetalhe: false };

  const doPlano = new Map(detalhesAtp(atual ?? { implantar: false }).map((d) => [d.label, d.valor]));
  const doEproc = new Map(detalhesAtp(regraDoEproc(regra, atual, pontas)).map((d) => [d.label, d.valor]));
  const campos: DiferencaCampo[] = [];
  for (const label of new Set([...doEproc.keys(), ...doPlano.keys()])) {
    if (label === 'Observações') continue;
    const p = doPlano.get(label);
    const e = doEproc.get(label);
    if (p !== e) campos.push({ label, ...(p !== undefined ? { plano: p } : {}), ...(e !== undefined ? { eproc: e } : {}) });
  }
  return { pontas: avisos, campos, comDetalhe: true };
}
