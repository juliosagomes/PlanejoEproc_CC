import type { Position } from './plano';

/* ============================================================================
 * PEÇAS DO QUADRO QUE NÃO SÃO LOCALIZADORES (decisoes.md#D-38)
 *
 * Duas formas de regra não cabiam na seta localizador → localizador, e os
 * planos as imitavam com nós sem nome ou de nome invisível:
 *
 *  - **Nota**: texto livre no quadro, que cita regras pelo número. Não vai ao
 *    Eproc nem ao checklist — é o "nó sem nome usado como anotação", agora sem
 *    contar como localizador a criar.
 *  - **Entrada por evento**: a regra de origem "Nenhum", que o Eproc dispara
 *    pelo evento venha o processo de onde vier. A peça é só o rótulo; a regra
 *    mora na seta que sai dela, como qualquer outra (D-24), e por isso o
 *    painel da aresta, o detalhe da ATP e o checklist servem sem mudança.
 *
 * As duas ficam fora de `Plano.nodes`, como as molduras do D-31: o resto do
 * app lê `nodes` como "os localizadores".
 * ========================================================================== */

export interface NotaQuadro {
  id: string;
  /** Canto superior esquerdo, em coordenadas do canvas. */
  position: Position;
  texto: string;
}

export interface EntradaEvento {
  id: string;
  position: Position;
  /** O evento que dispara, como o usuário quer ler no quadro. */
  rotulo: string;
}

/**
 * Números de regra citados num texto: "Regra 54", "Regras 147 e 148",
 * "Regra 92, 93 e 94". A citação é só leitura — o plano não sabe o número das
 * regras no Eproc —, mas vira chip na nota para o olho achar rápido.
 */
export function regrasCitadas(texto: string): number[] {
  const out: number[] = [];
  const trecho = /\bregras?\s*(?:n[º°o.]*\s*)?(\d+(?:\s*(?:,|e|\/)\s*\d+)*)/gi;
  for (const m of texto.matchAll(trecho)) {
    for (const n of (m[1] ?? '').match(/\d+/g) ?? []) {
      const v = Number(n);
      if (!out.includes(v)) out.push(v);
    }
  }
  return out;
}

/** Nome de uma entrada por evento como ponta de aresta (checklist, painel). */
export function nomeEntrada(rotulo: string): string {
  return `Entrada por evento "${rotulo.trim() || 'sem evento'}"`;
}
