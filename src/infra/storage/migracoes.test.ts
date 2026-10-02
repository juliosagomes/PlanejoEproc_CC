import { describe, expect, it } from 'vitest';
import {
  FLAG_ESPERA_ID,
  FLAG_FIXO_ID,
  FLAG_GATILHO_ID,
  FLAG_TRABALHADO_ID,
  SCHEMA_VERSION,
} from '@/domain';
import { migrarPlanoV1, migrarPlanoV2, migrarPlanoV3, migrarRegraAtpV3 } from './migracoes';
import { PlanoSchema, PlanoV1Schema, PlanoV2Schema, PlanoV3Schema } from './schema';

/* ============================================================================
 * Regressão das migrações v1 → v2 (decisoes.md#D-22), v2 → v3
 * (decisoes.md#D-24) e v3 → v4 (decisoes.md#D-27).
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

    // Para na v2: quem leva daí para a frente é `migrarPlanoV2`.
    expect(plano.version).toBe(2);
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

  it('o resultado das migrações encadeadas revalida na versão corrente', () => {
    const migrado = migrarPlanoV3(migrarPlanoV2(migrar(planoV1Cru())));
    const r = PlanoSchema.safeParse(JSON.parse(JSON.stringify(migrado)));
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual(migrado);
  });

  it('rejeita plano de versão desconhecida em vez de adivinhar', () => {
    const futuro = { ...(planoV1Cru() as object), version: 99 };
    expect(PlanoSchema.safeParse(futuro).success).toBe(false);
  });
});

/* ============================================================================
 * v2 → v3: a regra sai da aresta e vira recurso dela (decisoes.md#D-24).
 * ========================================================================== */

/** Plano v2 cru, com a regra ainda dentro da aresta. */
function planoV2Cru(): unknown {
  return {
    version: 2,
    planoNome: 'Fluxo de Execução',
    flowMode: 'organic',
    flags: [{ id: 'flag-espera', code: 'E', label: 'Espera', cor: 2 }],
    nodes: [
      {
        id: 'n-1',
        position: { x: 0, y: 0 },
        data: { nome: 'Aguardando', ja_criado: false, flags: [] },
      },
    ],
    edges: [
      {
        id: 'e-1',
        source: 'n-1',
        target: 'n-1',
        sourceHandle: null,
        targetHandle: null,
        data: {
          kind: 'atp',
          resumo: 'autoavanço',
          observacao: 'nota',
          subitems: [
            { id: 's-1', categoria: 'Modelo', nome: 'Sentença', ja_criado: true },
            { id: 's-2', categoria: 'Texto padrão', nome: 'TP', ja_criado: false },
          ],
          atp: {
            implantar: true,
            ja_criado: true,
            nome: 'Avança após perícia',
            trigger: { tipo: 'E', eventoIds: ['123'] },
            observacoes: 'obs da regra',
          },
          dobra: { fracaoX: 0.25 },
        },
      },
    ],
  };
}

function migrar2(cru: unknown) {
  return migrarPlanoV2(PlanoV2Schema.parse(cru));
}

describe('migrarPlanoV2', () => {
  it('a regra vira o primeiro recurso da aresta, com o detalhamento intacto', () => {
    const plano = migrar2(planoV2Cru());

    // Para na v3: quem leva daí para a frente é `migrarPlanoV3`.
    expect(plano.version).toBe(3);
    const subs = plano.edges[0]?.data.subitems ?? [];
    expect(subs).toHaveLength(3);

    const regra = subs[0];
    expect(regra?.categoria).toBe('Regra de ATP');
    // O nome sai da regra e passa a ser o do recurso.
    expect(regra?.nome).toBe('Avança após perícia');
    expect(regra?.ja_criado).toBe(true);
    // Nome e "já criado" ficaram no recurso; a regra guarda só a modelagem.
    expect(regra?.atp).toEqual({
      implantar: true,
      trigger: { tipo: 'E', eventoIds: ['123'] },
      observacoes: 'obs da regra',
    });
    expect('nome' in (regra?.atp ?? {})).toBe(false);
    expect('ja_criado' in (regra?.atp ?? {})).toBe(false);

    // Os recursos que já existiam continuam depois, na ordem original.
    expect(subs.slice(1).map((s) => s.nome)).toEqual(['Sentença', 'TP']);
  });

  it('preserva o resto da aresta e apaga os campos antigos', () => {
    const plano = migrar2(planoV2Cru());
    const data = plano.edges[0]?.data;

    expect(data?.kind).toBe('atp');
    expect(data?.resumo).toBe('autoavanço');
    expect(data?.observacao).toBe('nota');
    expect(data?.dobra).toEqual({ fracaoX: 0.25 });
    expect('atp' in (data ?? {})).toBe(false);
    expect('pref' in (data ?? {})).toBe(false);
  });

  it('regra sem detalhamento nenhum não vira recurso em branco', () => {
    const cru = planoV2Cru() as {
      edges: { data: { atp: unknown; subitems: unknown[] } }[];
    };
    cru.edges[0]!.data.atp = { implantar: false, ja_criado: false, nome: '' };

    const subs = migrar2(cru).edges[0]?.data.subitems ?? [];
    expect(subs).toHaveLength(2);
    expect(subs.map((s) => s.categoria)).toEqual(['Modelo', 'Texto padrão']);
  });

  it('regra que só estava marcada como criada sobrevive', () => {
    const cru = planoV2Cru() as { edges: { data: { atp: unknown } }[] };
    cru.edges[0]!.data.atp = { implantar: false, ja_criado: true, nome: '' };

    const subs = migrar2(cru).edges[0]?.data.subitems ?? [];
    expect(subs[0]).toMatchObject({ categoria: 'Regra de ATP', ja_criado: true });
  });

  it('regra que só tinha nome sobrevive — o nome é o detalhamento dela', () => {
    const cru = planoV2Cru() as { edges: { data: { atp: unknown } }[] };
    cru.edges[0]!.data.atp = { implantar: false, ja_criado: false, nome: 'Só o nome' };

    const subs = migrar2(cru).edges[0]?.data.subitems ?? [];
    expect(subs[0]).toMatchObject({ categoria: 'Regra de ATP', nome: 'Só o nome' });
  });

  it('ATP e Preferência na mesma aresta viram dois recursos, ATP primeiro', () => {
    const cru = planoV2Cru() as { edges: { data: { pref: unknown } }[] };
    cru.edges[0]!.data.pref = {
      implantar: true,
      ja_criado: false,
      nome: 'Minuta de despacho',
      tipo: 'Minuta',
    };

    const subs = migrar2(cru).edges[0]?.data.subitems ?? [];
    expect(subs.map((s) => s.categoria)).toEqual([
      'Regra de ATP',
      'Preferência',
      'Modelo',
      'Texto padrão',
    ]);
  });

  it('aresta manual atravessa sem ganhar recurso nenhum', () => {
    const cru = planoV2Cru() as {
      edges: { data: { kind: string; atp?: unknown; subitems: unknown[] } }[];
    };
    cru.edges[0]!.data.kind = 'manual';
    delete cru.edges[0]!.data.atp;
    cru.edges[0]!.data.subitems = [];

    expect(migrar2(cru).edges[0]?.data.subitems).toEqual([]);
  });

  it('PlanoSchema migra um v2 na própria validação', () => {
    const r = PlanoSchema.safeParse(planoV2Cru());
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.version).toBe(SCHEMA_VERSION);
    expect(r.data.edges[0]?.data.subitems[0]?.categoria).toBe('Regra de ATP');
  });
});

/* ============================================================================
 * v3 → v4: a regra de ATP passa a espelhar a tela do Eproc (decisoes.md#D-27).
 * ========================================================================== */

/** Plano v3 cru, com a regra de ATP na forma antiga. */
function planoV3Cru(): unknown {
  return {
    version: 3,
    planoNome: 'Fluxo de Família',
    flowMode: 'organic',
    flags: [{ id: 'flag-espera', code: 'E', label: 'Espera', cor: 2 }],
    nodes: [
      {
        id: 'n-1',
        position: { x: 0, y: 0 },
        data: { nome: 'Aguardando', ja_criado: false, flags: ['flag-espera'] },
      },
    ],
    edges: [
      {
        id: 'e-1',
        source: 'n-1',
        target: 'n-1',
        sourceHandle: null,
        targetHandle: null,
        data: {
          kind: 'atp',
          resumo: 'autoavanço',
          observacao: 'nota',
          subitems: [
            {
              id: 's-1',
              categoria: 'Regra de ATP',
              nome: 'Vista ao MP',
              ja_criado: true,
              atp: {
                implantar: true,
                trigger: { tipo: 'E', eventoIds: ['123', '456'] },
                filtros: {
                  classesJudiciaisIds: ['10'],
                  competenciaIds: [],
                  statusProcessoIds: ['7', '8'],
                },
                condicoes: 'Vista MP - Sim',
                acaoTipo: 'EDP',
                acao: 'intimar o MP',
                observacoes: 'obs da regra',
              },
            },
            {
              id: 's-2',
              categoria: 'Preferência',
              nome: 'Z7',
              ja_criado: false,
              pref: { implantar: true, tipo: 'Intimação' },
            },
            { id: 's-3', categoria: 'Modelo', nome: 'Sentença', ja_criado: true },
          ],
          dobra: { fracaoX: 0.25 },
        },
      },
    ],
  };
}

function migrar3(cru: unknown) {
  return migrarPlanoV3(PlanoV3Schema.parse(cru));
}

describe('migrarPlanoV3', () => {
  it('leva gatilho, ação e filtros para a forma nova', () => {
    const plano = migrar3(planoV3Cru());
    expect(plano.version).toBe(SCHEMA_VERSION);

    const regra = plano.edges[0]?.data.subitems[0];
    expect(regra).toMatchObject({ id: 's-1', nome: 'Vista ao MP', ja_criado: true });
    expect(regra?.atp?.implantar).toBe(true);
    expect(regra?.atp?.trigger).toEqual({ tipo: 'E', eventoIds: ['123', '456'] });
    // O código da ação vira a primeira (e única) ação programada.
    expect(regra?.atp?.acoes).toHaveLength(1);
    expect(regra?.atp?.acoes?.[0]).toMatchObject({ tipo: 'EDP' });
    // Filtros passam a ser indexados pelo id do campo no Eproc; o que estava
    // vazio não vira filtro adicionado.
    expect(regra?.atp?.filtros).toEqual({
      selClassesJudiciaisMultiplo: { selClassesJudiciaisMultiplo: ['10'] },
      selStatusProcessoMultiplo: { selStatusProcessoMultiplo: ['7', '8'] },
    });
  });

  it('os dois textos livres vão para Observações, depois do que já havia lá', () => {
    const atp = migrar3(planoV3Cru()).edges[0]?.data.subitems[0]?.atp;

    expect(atp?.observacoes).toBe(
      'obs da regra\n\nDetalhes da ação: intimar o MP\n\nCondições: Vista MP - Sim',
    );
    expect('condicoes' in (atp ?? {})).toBe(false);
    expect('acao' in (atp ?? {})).toBe(false);
    expect('acaoTipo' in (atp ?? {})).toBe(false);
  });

  it('não toca em preferência, recurso comum nem no resto da aresta', () => {
    const cru = planoV3Cru() as { edges: { data: { subitems: unknown[] } }[]; nodes: unknown };
    const plano = migrar3(cru);
    const data = plano.edges[0]?.data;

    expect(data?.subitems.slice(1)).toEqual(cru.edges[0]!.data.subitems.slice(1));
    expect(data?.kind).toBe('atp');
    expect(data?.resumo).toBe('autoavanço');
    expect(data?.observacao).toBe('nota');
    expect(data?.dobra).toEqual({ fracaoX: 0.25 });
    expect(plano.nodes).toEqual(cru.nodes);
  });

  it('regra só com `implantar` atravessa sem ganhar campo vazio', () => {
    expect(migrarRegraAtpV3({ implantar: false })).toEqual({ implantar: false });
  });

  it('PlanoSchema migra um v3 na própria validação, e o resultado revalida', () => {
    const r = PlanoSchema.safeParse(planoV3Cru());
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.version).toBe(SCHEMA_VERSION);

    const denovo = PlanoSchema.safeParse(JSON.parse(JSON.stringify(r.data)));
    expect(denovo.success).toBe(true);
    if (denovo.success) expect(denovo.data).toEqual(r.data);
  });
});

describe('migrarRegraAtpV3 — gatilhos', () => {
  it('"a cada 1 dia" é o "Todos os dias" do Eproc', () => {
    const r = migrarRegraAtpV3({
      implantar: false,
      trigger: { tipo: 'D', periodicidadeDias: 1 },
    });
    expect(r.trigger).toEqual({ tipo: 'D', tipoData: 'T' });
    expect(r.observacoes).toBeUndefined();
  });

  it('periodicidade que o Eproc não tem fica anotada, não some', () => {
    const r = migrarRegraAtpV3({
      implantar: false,
      trigger: { tipo: 'D', periodicidadeDias: 15 },
    });
    expect(r.trigger).toEqual({ tipo: 'D' });
    expect(r.observacoes).toBe('Periodicidade: 15 dia(s)');
  });

  it('data específica vira o modo "Em data específica"', () => {
    const r = migrarRegraAtpV3({
      implantar: false,
      trigger: { tipo: 'D', data: '2026-12-01' },
    });
    expect(r.trigger).toEqual({ tipo: 'D', tipoData: 'D', data: '2026-12-01' });
  });

  it('os contadores de dias mudam de nome e mantêm o valor', () => {
    expect(
      migrarRegraAtpV3({ implantar: false, trigger: { tipo: 'L', diasNoLocalizador: 30 } })
        .trigger,
    ).toEqual({ tipo: 'L', dias: 30 });
    expect(
      migrarRegraAtpV3({ implantar: false, trigger: { tipo: 'V', diasSemMovimentacao: 0 } })
        .trigger,
    ).toEqual({ tipo: 'V', dias: 0 });
  });

  it('situação: a primeira fica no campo, as demais em Observações', () => {
    const r = migrarRegraAtpV3({
      implantar: false,
      trigger: { tipo: 'S', diasNaSituacao: 10, statusIds: ['7', '8', '9'] },
    });
    expect(r.trigger).toEqual({ tipo: 'S', statusId: '7', dias: 10 });
    expect(r.observacoes).toBe('Outras situações do gatilho: 8, 9');
  });
});
