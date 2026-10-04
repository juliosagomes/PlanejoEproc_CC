import { describe, expect, it } from 'vitest';
import type { AtpRule, Edge, Localizador, PrefRule, Subitem } from '@/domain';
import {
  checklistToMarkdown,
  contarChecklist,
  deriveChecklist,
} from './derive';

const noLocalizador = (id: string, nome: string, ja_criado = false): Localizador => ({
  id,
  position: { x: 0, y: 0 },
  data: { nome, ja_criado, flags: [] },
});

// Desde o D-24 a regra é um recurso da aresta, e é o recurso que carrega nome e
// `ja_criado` — daí os dois construtores em vez de um literal em cada fixture.
const regraAtp = (nome: string, atp: AtpRule, ja_criado = false): Subitem => ({
  id: `si-${nome}`,
  categoria: 'Regra de ATP',
  nome,
  ja_criado,
  atp,
});

const regraPref = (nome: string, pref: PrefRule, ja_criado = false): Subitem => ({
  id: `si-${nome}`,
  categoria: 'Preferência',
  nome,
  ja_criado,
  pref,
});

describe('deriveChecklist', () => {
  it('plano vazio retorna grupos vazios', () => {
    const g = deriveChecklist([], []);
    expect(g.Localizador).toEqual([]);
    expect(g['Texto padrão']).toEqual([]);
    expect(g['Preferência']).toEqual([]);
    expect(g['Modelo']).toEqual([]);
    expect(g['Regra de ATP']).toEqual([]);
    expect(g['Outro']).toEqual([]);
  });

  it('cada nó vira um item de Localizador, com placeholder se sem nome', () => {
    const g = deriveChecklist(
      [noLocalizador('n1', 'Despachos'), noLocalizador('n2', '   ')],
      [],
    );
    expect(g.Localizador).toHaveLength(2);
    expect(g.Localizador[0]).toMatchObject({ kind: 'node', nodeId: 'n1', nome: 'Despachos' });
    expect(g.Localizador[1]?.nome).toBe('(sem nome)');
  });

  it('localizador de sistema fica fora do checklist, mas segue servindo de contexto', () => {
    const sistema: Localizador = {
      id: 'n2',
      position: { x: 0, y: 0 },
      data: { nome: 'ISENTO DE CUSTAS', ja_criado: false, sistema: true, flags: [] },
    };
    const edges: Edge[] = [
      {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        data: {
          kind: 'manual',
          resumo: '',
          observacao: '',
          subitems: [{ id: 's1', categoria: 'Modelo', nome: 'modelo X', ja_criado: false }],
        },
      },
    ];

    const g = deriveChecklist([noLocalizador('n1', 'Despachos'), sistema], edges);

    // Não é tarefa da secretaria: não entra na lista nem conta no progresso.
    expect(g.Localizador).toHaveLength(1);
    expect(g.Localizador[0]?.nome).toBe('Despachos');
    // Mas continua nomeando a ponta da aresta — o fluxo passa por ele.
    expect(g['Modelo'][0]).toMatchObject({ contexto: 'Despachos → ISENTO DE CUSTAS' });
  });

  it('subitens de aresta manual caem nas próprias categorias com contexto', () => {
    const nodes = [noLocalizador('n1', 'A'), noLocalizador('n2', 'B')];
    const edges: Edge[] = [
      {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        data: {
          kind: 'manual',
          resumo: '',
          observacao: '',
          subitems: [
            { id: 's1', categoria: 'Modelo', nome: 'modelo X', ja_criado: false },
            { id: 's2', categoria: 'Texto padrão', nome: 'tp Y', ja_criado: true },
          ],
        },
      },
    ];
    const g = deriveChecklist(nodes, edges);
    expect(g['Modelo']).toHaveLength(1);
    expect(g['Modelo'][0]).toMatchObject({
      kind: 'sub',
      edgeId: 'e1',
      index: 0,
      contexto: 'A → B',
      ja_criado: false,
    });
    // Subitens não-aninhados não carregam `categoria` (é redundante — já estão
    // no grupo da categoria). `categoria` só aparece em filhos de rule.
    expect(g['Modelo'][0]?.kind === 'sub' && g['Modelo'][0].categoria).toBe(undefined);
    expect(g['Texto padrão']).toHaveLength(1);
    expect(g['Texto padrão'][0]?.ja_criado).toBe(true);
  });

  it('regra ATP com implantar=true vira item próprio em "Regra de ATP" com filhos aninhados', () => {
    const nodes = [noLocalizador('n1', 'A'), noLocalizador('n2', 'B')];
    const edges: Edge[] = [
      {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        data: {
          kind: 'atp',
          resumo: 'após citação',
          observacao: '',
          subitems: [
            regraAtp('ATP citação', {
              implantar: true,
              observacoes: 'mover para conclusão',
            }),
            { id: 's1', categoria: 'Modelo', nome: 'modelo X', ja_criado: false },
          ],
        },
      },
    ];
    const g = deriveChecklist(nodes, edges);
    expect(g['Regra de ATP']).toHaveLength(1);
    const rule = g['Regra de ATP'][0];
    if (rule?.kind !== 'rule') throw new Error('esperava rule');
    expect(rule.nome).toBe('ATP citação');
    expect(rule.contexto).toBe('A → B');
    // `descricao` saiu — o texto da regra aparece em `detalhes`, rotulado.
    expect(rule.descricao).toBeUndefined();
    expect(rule.detalhes).toEqual([
      { label: 'Observações', valor: 'mover para conclusão' },
    ]);
    expect(rule.children).toHaveLength(1);
    expect(rule.children[0]?.categoria).toBe('Modelo');
    // Subitens aninhados não devem aparecer também em Modelo:
    expect(g['Modelo']).toEqual([]);
  });

  it('detalhes ATP seguem os três blocos do Eproc e resolvem os códigos', () => {
    const nodes = [noLocalizador('n1', 'A'), noLocalizador('n2', 'B')];
    const edges: Edge[] = [
      {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        data: {
          kind: 'atp',
          resumo: '',
          observacao: '',
          subitems: [
            regraAtp('R', {
              implantar: true,
              comportamentoOrigem: '0',
              trigger: { tipo: 'L', dias: 30, diasUteis: true },
              acoes: [
                {
                  id: 'ac-1',
                  tipo: 'CMA',
                  parametros: { TipoComunicacao: 'C', PrazoCMA: 15, CitarDJE: false },
                  localizadorErro: 'ERRO',
                },
              ],
              filtros: {
                selCompetencia: { selCompetencia: ['__cod_inexistente__'] },
                // Adicionado e deixado em branco: não é modelagem, não aparece.
                selRitoProcesso: {},
              },
              observacoes: 'obs',
            }),
          ],
        },
      },
    ];
    const rule = deriveChecklist(nodes, edges)['Regra de ATP'][0];
    if (rule?.kind !== 'rule') throw new Error('esperava rule');
    expect(rule.detalhes).toEqual([
      {
        label: 'Comportamento do Localizador ORIGEM',
        valor: 'Remover o processo do(s) localizador(es) informado(s)',
      },
      {
        label: 'Tipo de controle',
        valor: 'Por Tempo no Localizador / 30 dias (contar apenas dias úteis)',
      },
      {
        label: 'Ação programada',
        valor: [
          'Citação/Intimação por Mandado',
          'Tipo de comunicação: Citação',
          'Prazo: 15',
          'Citação de partes com DJE: Não',
          'Localizador de Erro: ERRO',
        ].join('\n'),
      },
      // Código inexistente vira fallback para o próprio ID.
      { label: 'Competência', valor: '__cod_inexistente__' },
      { label: 'Observações', valor: 'obs' },
    ]);
  });

  it('duas ações programadas saem numeradas, na ordem de execução', () => {
    const nodes = [noLocalizador('n1', 'A'), noLocalizador('n2', 'B')];
    const edges: Edge[] = [
      {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        data: {
          kind: 'atp',
          resumo: '',
          observacao: '',
          subitems: [
            regraAtp('R', {
              implantar: true,
              acoes: [
                { id: 'a', tipo: 'E', parametros: { txtEventoAutomatico: 'Conclusos' } },
                { id: 'b', tipo: 'LBT', descricao: 'aviso', parametros: { Validade: 0 } },
              ],
            }),
          ],
        },
      },
    ];
    const rule = deriveChecklist(nodes, edges)['Regra de ATP'][0];
    if (rule?.kind !== 'rule') throw new Error('esperava rule');
    expect(rule.detalhes).toEqual([
      {
        label: 'Ação programada #1',
        valor: 'Lançar evento automatizado\nEvento Automatizado: Conclusos',
      },
      {
        label: 'Ação programada #2',
        // Zero é valor, não ausência: "Dias Validade: 0" é "sem validade".
        valor: 'Incluir Lembrete\nDescrição: aviso\nDias Validade: 0',
      },
    ]);
  });

  it('detalhes Pref expõem Minuta + conteúdo do Texto padrão', () => {
    const nodes = [noLocalizador('n1', 'A'), noLocalizador('n2', 'B')];
    const edges: Edge[] = [
      {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        data: {
          kind: 'pref',
          resumo: '',
          observacao: '',
          subitems: [
            regraPref('P', {
              implantar: true,
              tipo: 'Minuta',
              minutaModo: 'texto_padrao',
              minutaConteudo: 'linha 1\nlinha 2',
              acao: 'conclusão p/ despacho',
            }),
          ],
        },
      },
    ];
    const rule = deriveChecklist(nodes, edges)['Preferência'][0];
    if (rule?.kind !== 'rule') throw new Error('esperava rule');
    expect(rule.detalhes).toEqual([
      { label: 'Tipo', valor: 'Minuta' },
      { label: 'Texto padrão', valor: 'linha 1\nlinha 2' },
      { label: 'Efeito', valor: 'conclusão p/ despacho' },
    ]);
  });

  it('regra Pref com implantar=true vai para "Preferência"', () => {
    const nodes = [noLocalizador('n1', 'A'), noLocalizador('n2', 'B')];
    const edges: Edge[] = [
      {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        data: {
          kind: 'pref',
          resumo: 'r',
          observacao: '',
          subitems: [
            regraPref('Pref X', { implantar: true, tipo: 'Minuta' }, true),
          ],
        },
      },
    ];
    const g = deriveChecklist(nodes, edges);
    expect(g['Preferência']).toHaveLength(1);
    expect(g['Preferência'][0]?.kind).toBe('rule');
    expect(g['Preferência'][0]?.ja_criado).toBe(true);
  });

  it('duas regras na mesma aresta viram itens irmãos, e os recursos comuns ficam soltos', () => {
    const nodes = [noLocalizador('n1', 'A'), noLocalizador('n2', 'B')];
    const edges: Edge[] = [
      {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        data: {
          kind: 'atp',
          resumo: '',
          observacao: '',
          subitems: [
            regraAtp('ATP 1', { implantar: true }),
            regraAtp('ATP 2', { implantar: true }, true),
            regraPref('Pref', { implantar: true }),
            { id: 's1', categoria: 'Modelo', nome: 'modelo X', ja_criado: false },
          ],
        },
      },
    ];
    const g = deriveChecklist(nodes, edges);

    expect(g['Regra de ATP'].map((i) => i.nome)).toEqual(['ATP 1', 'ATP 2']);
    expect(g['Regra de ATP'].every((i) => i.kind === 'rule')).toBe(true);
    expect(g['Preferência']).toHaveLength(1);
    // Sem aninhamento: nenhuma regra pode reivindicar o modelo sozinha.
    expect(g['Regra de ATP'][0]?.kind === 'rule' && g['Regra de ATP'][0].children).toEqual([]);
    expect(g['Modelo']).toHaveLength(1);
    expect(g['Modelo'][0]).toMatchObject({ kind: 'sub', contexto: 'A → B', index: 3 });
  });

  it('o índice do item de regra aponta para o recurso na aresta', () => {
    const nodes = [noLocalizador('n1', 'A'), noLocalizador('n2', 'B')];
    const edges: Edge[] = [
      {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        data: {
          kind: 'atp',
          resumo: '',
          observacao: '',
          subitems: [
            { id: 's1', categoria: 'Modelo', nome: 'modelo X', ja_criado: false },
            regraAtp('R', { implantar: true }),
          ],
        },
      },
    ];
    const rule = deriveChecklist(nodes, edges)['Regra de ATP'][0];
    if (rule?.kind !== 'rule') throw new Error('esperava rule');
    expect(rule.index).toBe(1);
  });

  it('recurso de categoria Preferência sem regra continua listado como recurso comum', () => {
    const nodes = [noLocalizador('n1', 'A'), noLocalizador('n2', 'B')];
    const edges: Edge[] = [
      {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        data: {
          kind: 'atp',
          resumo: '',
          observacao: '',
          subitems: [
            { id: 's1', categoria: 'Preferência', nome: 'pref a criar', ja_criado: false },
          ],
        },
      },
    ];
    const g = deriveChecklist(nodes, edges);
    expect(g['Preferência']).toHaveLength(1);
    expect(g['Preferência'][0]?.kind).toBe('sub');
  });

  it('regra ATP sem implantar mantém subitens nas próprias categorias (sem item de regra)', () => {
    const nodes = [noLocalizador('n1', 'A'), noLocalizador('n2', 'B')];
    const edges: Edge[] = [
      {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        data: {
          kind: 'atp',
          resumo: '',
          observacao: '',
          subitems: [
            regraAtp('', { implantar: false }),
            { id: 's1', categoria: 'Modelo', nome: 'modelo X', ja_criado: false },
          ],
        },
      },
    ];
    const g = deriveChecklist(nodes, edges);
    expect(g['Regra de ATP']).toEqual([]);
    expect(g['Modelo']).toHaveLength(1);
  });
});

describe('contarChecklist', () => {
  it('soma itens próprios + filhos aninhados em rule', () => {
    const nodes = [
      noLocalizador('n1', 'A', true),
      noLocalizador('n2', 'B', false),
    ];
    const edges: Edge[] = [
      {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        data: {
          kind: 'atp',
          resumo: 'r',
          observacao: '',
          subitems: [
            { id: 's1', categoria: 'Modelo', nome: 'm1', ja_criado: true },
            { id: 's2', categoria: 'Modelo', nome: 'm2', ja_criado: false },
            regraAtp('r', { implantar: true }),
          ],
        },
      },
    ];
    const g = deriveChecklist(nodes, edges);
    const c = contarChecklist(g);
    // 2 nós + 1 rule + 2 children = 5; 1 nó criado + 1 child criado = 2
    expect(c).toEqual({ total: 5, done: 2 });
  });
});

describe('checklistToMarkdown', () => {
  it('renderiza seções, marcadores e indentação', () => {
    const nodes = [noLocalizador('n1', 'A', true)];
    const edges: Edge[] = [
      {
        id: 'e1',
        source: 'n1',
        target: 'n1',
        data: {
          kind: 'atp',
          resumo: '',
          observacao: '',
          subitems: [
            regraAtp('R1', { implantar: true }),
            { id: 's1', categoria: 'Modelo', nome: 'm1', ja_criado: false },
          ],
        },
      },
    ];
    const md = checklistToMarkdown('Plano X', deriveChecklist(nodes, edges));
    expect(md).toContain('# Checklist · Plano X');
    expect(md).toContain('## Localizador (1/1)');
    expect(md).toContain('- [x] A');
    expect(md).toContain('## Regra de ATP (0/2)');
    expect(md).toContain('- [ ] R1 _(A → A)_');
    expect(md).toContain('  - [ ] m1 _[Modelo]_');
  });

  it('inclui detalhes rotulados sob a regra (multi-linha indentado)', () => {
    const nodes = [noLocalizador('n1', 'A')];
    const edges: Edge[] = [
      {
        id: 'e1',
        source: 'n1',
        target: 'n1',
        data: {
          kind: 'pref',
          resumo: '',
          observacao: '',
          subitems: [
            regraPref('P', {
              implantar: true,
              tipo: 'Minuta',
              minutaModo: 'modelo',
              minutaConteudo: 'L1\nL2',
            }),
          ],
        },
      },
    ];
    const md = checklistToMarkdown('X', deriveChecklist(nodes, edges));
    expect(md).toContain('  - **Tipo:** Minuta');
    expect(md).toContain('  - **Modelo:** L1');
    expect(md).toContain('    L2');
  });
});

describe('ações preferenciais planejadas (D-28)', () => {
  const comAcoes = (id: string, nome: string, sistema = false): Localizador => ({
    id,
    position: { x: 0, y: 0 },
    data: {
      nome,
      ja_criado: true,
      flags: [],
      ...(sistema ? { sistema: true } : {}),
      acoesPreferenciais: [
        { id: `${id}-a1`, nome: 'Despacho — cite-se', ja_criado: true },
        { id: `${id}-a2`, nome: 'Ofício INSS', ja_criado: false },
      ],
    },
  });

  it('cada vínculo planejado vira tarefa com o localizador de contexto', () => {
    const g = deriveChecklist([comAcoes('n1', 'Minutar')], []);
    expect(g['Ação preferencial']).toEqual([
      { kind: 'acao', nodeId: 'n1', acaoId: 'n1-a1', nome: 'Despacho — cite-se', contexto: 'Minutar', ja_criado: true },
      { kind: 'acao', nodeId: 'n1', acaoId: 'n1-a2', nome: 'Ofício INSS', contexto: 'Minutar', ja_criado: false },
    ]);
  });

  it('entra mesmo quando o localizador é de sistema', () => {
    const g = deriveChecklist([comAcoes('n1', 'CONCLUSOS', true)], []);
    expect(g.Localizador).toEqual([]);
    expect(g['Ação preferencial']).toHaveLength(2);
  });

  it('conta no progresso e sai no markdown com o contexto', () => {
    const g = deriveChecklist([comAcoes('n1', 'Minutar')], []);
    expect(contarChecklist(g)).toEqual({ total: 3, done: 2 });
    const md = checklistToMarkdown('P', g);
    expect(md).toContain('## Ação preferencial (1/2)');
    expect(md).toContain('- [ ] Ofício INSS _(Minutar)_');
  });
});
