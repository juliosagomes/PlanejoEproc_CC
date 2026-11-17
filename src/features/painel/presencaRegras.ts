import {
  ehDestinoDescarte,
  nomeDaPonta,
  nomeEfetivo,
  regrasCitadas,
  type Plano,
  type RegraAtpUnidade,
  type Subitem,
} from '@/domain';
import { semDecoracao } from '@/infra/eproc/nomeLocalizador';

/* ============================================================================
 * PRESENÇA DAS REGRAS DE ATP NOS PLANOS DO SILO (decisoes.md#D-46)
 *
 * Para cada regra da unidade, onde os planos a citam e se a citação bate com o
 * Eproc. "Citar" é ter um recurso com o nº vinculado (`Subitem.eprocAtp`) ou,
 * na falta dele, o nº escrito no nome ou na descrição do recurso, numa regra
 * pendurada ou numa nota ("Regra 54 e 55").
 *
 * A conferência aqui é só a da lista: origem e destino, por nome, e se a regra
 * está ativa. Campo a campo é com o detalhe, no modal da regra.
 * ========================================================================== */

export type EstadoPresenca = 'emPlano' | 'divergente' | 'ausente';

export interface CitacaoRegra {
  planoId: string;
  planoNome: string;
  /** Onde no plano: "A → B", "pendurada em A" ou "nota". */
  onde: string;
  divergencias: string[];
}

export interface PresencaRegra {
  estado: EstadoPresenca;
  citacoes: CitacaoRegra[];
}

export interface PlanoDoSilo {
  id: string;
  nome: string;
  plano: Pick<Plano, 'nodes' | 'edges' | 'grupos' | 'notas' | 'entradas'>;
}

export interface PresencaDasRegras {
  porNumero: Map<number, PresencaRegra>;
  /** Nºs citados nos planos que a unidade não tem mais. */
  citadasInexistentes: { numero: number; citacoes: CitacaoRegra[] }[];
}

/** Régua de "mesmo localizador": sem emoji, acento, pontuação e caixa. O invisível fica. */
export function chaveNome(nome: string): string {
  return semDecoracao(nome) || nome.trim();
}

function numerosDoRecurso(s: Pick<Subitem, 'eprocAtp' | 'nome' | 'descricao'>): number[] {
  if (s.eprocAtp) return [s.eprocAtp];
  return regrasCitadas(`${s.nome} ${s.descricao ?? ''}`);
}

interface Ocorrencia {
  numero: number;
  planoId: string;
  planoNome: string;
  onde: string;
  /** Ausente nas notas: elas citam, não desenham. */
  origens?: string[];
  destinos?: string[];
}

function ocorrencias(planos: readonly PlanoDoSilo[]): Ocorrencia[] {
  const saida: Ocorrencia[] = [];
  for (const { id, nome, plano } of planos) {
    const grupos = plano.grupos ?? [];
    const entradas = plano.entradas ?? [];
    for (const e of plano.edges) {
      const origem = nomeDaPonta(plano.nodes, grupos, e.source, entradas);
      const destino = nomeDaPonta(plano.nodes, grupos, e.target, entradas);
      for (const s of e.data.subitems) {
        if (s.categoria !== 'Regra de ATP') continue;
        for (const numero of numerosDoRecurso(s)) {
          saida.push({
            numero,
            planoId: id,
            planoNome: nome,
            onde: `${origem || '?'} → ${destino || '?'}`,
            origens: [origem, ...(s.atp?.outrasOrigens ?? [])],
            destinos: [destino, ...(s.atp?.outrosDestinos ?? [])],
          });
        }
      }
    }
    for (const n of plano.nodes) {
      for (const r of n.data.regrasSemMover ?? []) {
        const origem = nomeEfetivo(plano.nodes, n.id);
        for (const numero of numerosDoRecurso(r)) {
          saida.push({
            numero,
            planoId: id,
            planoNome: nome,
            onde: `pendurada em ${origem || '?'}`,
            origens: [origem],
          });
        }
      }
    }
    for (const nota of plano.notas ?? []) {
      for (const numero of regrasCitadas(nota.texto)) {
        saida.push({ numero, planoId: id, planoNome: nome, onde: 'nota' });
      }
    }
  }
  return saida;
}

/** O que a lista do Eproc diz das pontas, contra o que o plano desenhou. */
function divergenciasDe(o: Ocorrencia, regra: RegraAtpUnidade, descarte: readonly string[]): string[] {
  const d: string[] = [];
  if (!regra.ativa) d.push('Desativada no Eproc.');
  if (!o.origens) return d;

  const doEproc =
    regra.tipoOrigem === 'localizadores' ? regra.origens : (regra.filtroContem ?? []);
  if (regra.tipoOrigem !== 'todos' && doEproc.length > 0) {
    const chaves = new Set(doEproc.map(chaveNome));
    // Origem "Nenhum" desenhada como entrada por evento também confere.
    const confere =
      o.origens.some((n) => chaves.has(chaveNome(n))) ||
      (regra.tipoOrigem === 'nenhum' && o.origens[0]?.startsWith('Entrada por evento'));
    if (!confere) d.push(`Origem no Eproc: ${doEproc.join(regra.opcaoOrigens === 'AND' ? ' E ' : ' OU ')}.`);
  }

  if (o.destinos) {
    const chaves = new Set(regra.destinos.map(chaveNome));
    const confere =
      regra.destinos.length === 0 || o.destinos.some((n) => n && chaves.has(chaveNome(n)));
    if (!confere) d.push(`Destino no Eproc: ${regra.destinos.join(' E ')}.`);
  } else if (regra.destinos.length && !regra.destinos.every((n) => ehDestinoDescarte(n, descarte))) {
    // Pendurada é regra que não move: no Eproc, o destino deveria ser descarte.
    d.push(`No Eproc ela move para ${regra.destinos.join(' E ')}.`);
  }
  return d;
}

/**
 * A presença de cada regra da unidade, pelo nº, e os nºs citados nos planos
 * que não existem mais no Eproc.
 */
export function presencaDasRegras(
  planos: readonly PlanoDoSilo[],
  regras: readonly RegraAtpUnidade[],
  descarte: readonly string[] = [],
): PresencaDasRegras {
  const todas = ocorrencias(planos);
  const porNumero = new Map<number, PresencaRegra>();
  const existentes = new Set(regras.map((r) => r.numero));

  for (const regra of regras) {
    const citacoes = todas
      .filter((o) => o.numero === regra.numero)
      .map((o) => ({
        planoId: o.planoId,
        planoNome: o.planoNome,
        onde: o.onde,
        divergencias: divergenciasDe(o, regra, descarte),
      }));
    const estado: EstadoPresenca =
      citacoes.length === 0
        ? 'ausente'
        : citacoes.some((c) => c.divergencias.length > 0)
          ? 'divergente'
          : 'emPlano';
    porNumero.set(regra.numero, { estado, citacoes });
  }

  const orfas = new Map<number, CitacaoRegra[]>();
  for (const o of todas) {
    if (existentes.has(o.numero)) continue;
    const lista = orfas.get(o.numero) ?? [];
    lista.push({ planoId: o.planoId, planoNome: o.planoNome, onde: o.onde, divergencias: [] });
    orfas.set(o.numero, lista);
  }
  return {
    porNumero,
    citadasInexistentes: [...orfas.entries()]
      .sort(([a], [b]) => a - b)
      .map(([numero, citacoes]) => ({ numero, citacoes })),
  };
}
