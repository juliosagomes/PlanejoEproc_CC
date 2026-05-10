import { describe, expect, it } from 'vitest';
import type { Edge, Localizador } from '@/domain';
import {
  checklistToMarkdown,
  contarChecklist,
  deriveChecklist,
} from './derive';

const noLocalizador = (id: string, nome: string, ja_criado = false): Localizador => ({
  id,
  position: { x: 0, y: 0 },
  data: { nome, ja_criado, flags: {} },
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
            { id: 's1', categoria: 'Modelo', nome: 'modelo X', ja_criado: false },
          ],
          atp: {
            implantar: true,
            ja_criado: false,
            nome: 'ATP citação',
            acao: 'mover para conclusão',
          },
        },
      },
    ];
    const g = deriveChecklist(nodes, edges);
    expect(g['Regra de ATP']).toHaveLength(1);
    const rule = g['Regra de ATP'][0];
    if (rule?.kind !== 'rule') throw new Error('esperava rule');
    expect(rule.nome).toBe('ATP citação');
    expect(rule.contexto).toBe('A → B');
    // `descricao` saiu — `acao` aparece em `detalhes` rotulado.
    expect(rule.descricao).toBeUndefined();
    expect(rule.detalhes).toEqual([
      { label: 'Detalhes da ação', valor: 'mover para conclusão' },
    ]);
    expect(rule.children).toHaveLength(1);
    expect(rule.children[0]?.categoria).toBe('Modelo');
    // Subitens aninhados não devem aparecer também em Modelo:
    expect(g['Modelo']).toEqual([]);
  });

  it('detalhes ATP resolvem códigos de gatilho/ação e listam IDs de filtros', () => {
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
          subitems: [],
          atp: {
            implantar: true,
            ja_criado: false,
            nome: 'R',
            trigger: { tipo: 'L', diasNoLocalizador: 5 },
            acaoTipo: 'CMA',
            condicoes: 'condição livre',
            filtros: { competenciaIds: ['__cod_inexistente__'] },
            observacoes: 'obs',
          },
        },
      },
    ];
    const rule = deriveChecklist(nodes, edges)['Regra de ATP'][0];
    if (rule?.kind !== 'rule') throw new Error('esperava rule');
    const labels = rule.detalhes.map((d) => d.label);
    expect(labels).toEqual([
      'Gatilho',
      'Dias no localizador',
      'Ação programada',
      'Condições',
      'Competência',
      'Observações',
    ]);
    // Gatilho começa com o código L; resolução do label (se o catálogo
    // contiver) acrescenta " — <rótulo>", senão fica só "L".
    expect(rule.detalhes[0]?.valor.startsWith('L')).toBe(true);
    expect(rule.detalhes[1]?.valor).toBe('5');
    // Código inexistente vira fallback para o próprio ID.
    expect(rule.detalhes[4]?.valor).toBe('__cod_inexistente__');
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
          subitems: [],
          pref: {
            implantar: true,
            ja_criado: false,
            nome: 'P',
            tipo: 'Minuta',
            minutaModo: 'texto_padrao',
            minutaConteudo: 'linha 1\nlinha 2',
            acao: 'conclusão p/ despacho',
          },
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
          subitems: [],
          pref: {
            implantar: true,
            ja_criado: true,
            nome: 'Pref X',
            tipo: 'Minuta',
          },
        },
      },
    ];
    const g = deriveChecklist(nodes, edges);
    expect(g['Preferência']).toHaveLength(1);
    expect(g['Preferência'][0]?.kind).toBe('rule');
    expect(g['Preferência'][0]?.ja_criado).toBe(true);
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
            { id: 's1', categoria: 'Modelo', nome: 'modelo X', ja_criado: false },
          ],
          atp: { implantar: false, ja_criado: false, nome: '' },
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
          ],
          atp: { implantar: true, ja_criado: false, nome: 'r' },
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
          subitems: [{ id: 's1', categoria: 'Modelo', nome: 'm1', ja_criado: false }],
          atp: { implantar: true, ja_criado: false, nome: 'R1' },
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
          subitems: [],
          pref: {
            implantar: true,
            ja_criado: false,
            nome: 'P',
            tipo: 'Minuta',
            minutaModo: 'modelo',
            minutaConteudo: 'L1\nL2',
          },
        },
      },
    ];
    const md = checklistToMarkdown('X', deriveChecklist(nodes, edges));
    expect(md).toContain('  - **Tipo:** Minuta');
    expect(md).toContain('  - **Modelo:** L1');
    expect(md).toContain('    L2');
  });
});
