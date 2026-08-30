import { describe, expect, it } from 'vitest';
import {
  FLAG_ESPERA_ID,
  FLAG_FIXO_ID,
  FLAG_GATILHO_ID,
  FLAG_TRABALHADO_ID,
  SCHEMA_VERSION,
} from '@/domain';
import { migrarPlanoV1 } from './migracoes';
import { PlanoSchema, PlanoV1Schema } from './schema';

/* ============================================================================
 * Regressão da migração v1 → v2 (decisoes.md#D-22).
 *
 * O critério é o do CLAUDE.md: importar um plano da versão anterior e conferir
 * que nada se perdeu. Vale o dobro aqui porque `loadPlano` manda para a
 * quarentena tudo que não valida — uma migração quebrada não daria erro, daria
 * o plano do usuário sumindo da tela.
 * ========================================================================== */

/** Plano v1 cru, como saía do `JSON.stringify` antes desta mudança. */
function planoV1Cru(): unknown {
  return {
    version: 1,
    planoNome: 'Fluxo de Família',
    flowMode: 'sharp',
    nodes: [
      {
        id: 'n-1',
        position: { x: 10, y: 20 },
        data: {
          nome: 'Aguardando perícia',
          descricao: 'fila de espera do INSS',
          ja_criado: true,
          flags: { espera: true, trabalhado: true },
        },
      },
      {
        id: 'n-2',
        position: { x: 200, y: 20 },
        data: {
          nome: 'Minutar sentença',
          ja_criado: false,
          flags: { gatilho: true, fixo: true },
        },
      },
      {
        id: 'n-3',
        position: { x: 400, y: 20 },
        data: { nome: 'Sem marcação', ja_criado: false, flags: {} },
      },
    ],
    edges: [
      {
        id: 'e-1',
        source: 'n-1',
        target: 'n-2',
        sourceHandle: null,
        targetHandle: null,
        data: {
          kind: 'atp',
          resumo: 'autoavanço',
          observacao: 'nota livre',
          subitems: [
            {
              id: 's-1',
              categoria: 'Modelo',
              nome: 'Sentença padrão',
              ja_criado: false,
            },
          ],
          atp: {
            implantar: true,
            ja_criado: false,
            nome: 'Avança após perícia',
            trigger: { tipo: 'E', eventoIds: ['123'] },
          },
        },
      },
    ],
  };
}

function migrar(cru: unknown) {
  const v1 = PlanoV1Schema.parse(cru);
  return migrarPlanoV1(v1);
}

describe('migrarPlanoV1', () => {
  it('converte as quatro chaves antigas em ids, sem perder marcação', () => {
    const plano = migrar(planoV1Cru());

    expect(plano.version).toBe(SCHEMA_VERSION);
    // Ordem canônica das chaves v1, não a ordem em que apareciam no objeto.
    expect(plano.nodes[0]?.data.flags).toEqual([FLAG_TRABALHADO_ID, FLAG_ESPERA_ID]);
    expect(plano.nodes[1]?.data.flags).toEqual([FLAG_GATILHO_ID, FLAG_FIXO_ID]);
    expect(plano.nodes[2]?.data.flags).toEqual([]);
  });

  it('define Espera e Fixo, e traz Trabalhado/Gatilho só porque estão em uso', () => {
    const plano = migrar(planoV1Cru());

    expect(plano.flags.map((f) => f.id)).toEqual([
      FLAG_ESPERA_ID,
      FLAG_FIXO_ID,
      FLAG_TRABALHADO_ID,
      FLAG_GATILHO_ID,
    ]);
    expect(plano.flags.map((f) => f.label)).toEqual([
      'Espera',
      'Fixo de fluxo',
      'Trabalhado',
      'Gatilho',
    ]);
  });

  it('plano que não usava Trabalhado nem Gatilho nasce só com os dois padrões', () => {
    const cru = planoV1Cru() as { nodes: { data: { flags: object } }[] };
    cru.nodes[0]!.data.flags = { espera: true };
    cru.nodes[1]!.data.flags = { fixo: true };

    const plano = migrar(cru);
    expect(plano.flags.map((f) => f.id)).toEqual([FLAG_ESPERA_ID, FLAG_FIXO_ID]);
  });

  it('todo id marcado num nó tem definição correspondente no plano', () => {
    const plano = migrar(planoV1Cru());
    const definidos = new Set(plano.flags.map((f) => f.id));
    for (const n of plano.nodes) {
      for (const id of n.data.flags) expect(definidos.has(id)).toBe(true);
    }
  });

  it('preserva intactos os campos que não têm nada com flags', () => {
    const plano = migrar(planoV1Cru());

    expect(plano.planoNome).toBe('Fluxo de Família');
    expect(plano.flowMode).toBe('sharp');
    expect(plano.nodes[0]?.position).toEqual({ x: 10, y: 20 });
    expect(plano.nodes[0]?.data.descricao).toBe('fila de espera do INSS');
    expect(plano.nodes[0]?.data.ja_criado).toBe(true);
    expect(plano.edges).toEqual((planoV1Cru() as { edges: unknown }).edges);
  });
});

describe('PlanoSchema aceita as duas versões', () => {
  it('migra o v1 na própria validação — é o que salva o loadPlano', () => {
    const r = PlanoSchema.safeParse(planoV1Cru());
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.version).toBe(SCHEMA_VERSION);
    expect(r.data.flags.length).toBe(4);
  });

  it('o resultado da migração revalida como v2', () => {
    const migrado = migrar(planoV1Cru());
    const r = PlanoSchema.safeParse(JSON.parse(JSON.stringify(migrado)));
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual(migrado);
  });

  it('rejeita plano de versão desconhecida em vez de adivinhar', () => {
    const futuro = { ...(planoV1Cru() as object), version: 99 };
    expect(PlanoSchema.safeParse(futuro).success).toBe(false);
  });
});
