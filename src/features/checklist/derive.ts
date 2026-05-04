import {
  SUBITEM_CATS,
  type EdgeData,
  type LocalizadorData,
  type SubitemCategoria,
} from '@/domain';

/**
 * Deriva o checklist do plano. Função pura, sem dependência de React/store —
 * permite testar o comportamento de agrupamento em isolamento e reutilizar
 * para gerar markdown ou outras saídas.
 *
 * Regras de agrupamento (portadas do BETA_2):
 *
 *  - Cada nó vira um item na seção "Localizador".
 *  - Para cada aresta:
 *    - Se `kind` é `atp` ou `pref` E a regra tem `implantar: true`, a regra
 *      vira item próprio na seção "Regra de ATP" / "Preferência", e os
 *      subitens da aresta ficam aninhados como filhos dela.
 *    - Caso contrário, os subitens são distribuídos pelas suas próprias
 *      categorias.
 *  - Categoria desconhecida (improvável) cai em "Outro".
 */

export type ChecklistGroupKey = 'Localizador' | SubitemCategoria;

export const CHECKLIST_GROUP_ORDER: readonly ChecklistGroupKey[] = [
  'Localizador',
  'Texto padrão',
  'Preferência',
  'Modelo',
  'Regra de ATP',
  'Outro',
];

interface ItemBase {
  nome: string;
  descricao?: string;
  ja_criado: boolean;
}

export interface NodeChecklistItem extends ItemBase {
  kind: 'node';
  nodeId: string;
}

export interface SubChecklistItem extends ItemBase {
  kind: 'sub';
  edgeId: string;
  index: number;
  categoria?: SubitemCategoria;
  /** Para subitens que não estão aninhados, exibe "L1 → L2" como contexto. */
  contexto?: string;
}

export interface RuleChecklistItem extends ItemBase {
  kind: 'rule';
  edgeId: string;
  contexto: string;
  children: SubChecklistItem[];
}

export type ChecklistItem = NodeChecklistItem | SubChecklistItem | RuleChecklistItem;

export type ChecklistGroups = Record<ChecklistGroupKey, ChecklistItem[]>;

/**
 * Aceita o formato estrutural mínimo (compatível tanto com o tipo `Localizador`
 * do domain quanto com `FlowNode = RFNode<LocalizadorData>` da store).
 */
type NodeLike = { id: string; data: LocalizadorData };
type EdgeLike = { id: string; source: string; target: string; data?: EdgeData };

function novoGrupo(): ChecklistGroups {
  return {
    Localizador: [],
    'Texto padrão': [],
    Preferência: [],
    Modelo: [],
    'Regra de ATP': [],
    Outro: [],
  };
}

function nomeOuPlaceholder(nome: string | undefined): string {
  return nome && nome.trim() ? nome : '(sem nome)';
}

const SUBITEM_CATS_SET: ReadonlySet<SubitemCategoria> = new Set(SUBITEM_CATS);

function categoriaValida(c: string): c is SubitemCategoria {
  return SUBITEM_CATS_SET.has(c as SubitemCategoria);
}

export function deriveChecklist(
  nodes: ReadonlyArray<NodeLike>,
  edges: ReadonlyArray<EdgeLike>,
): ChecklistGroups {
  const groups = novoGrupo();

  for (const n of nodes) {
    groups['Localizador'].push({
      kind: 'node',
      nodeId: n.id,
      nome: nomeOuPlaceholder(n.data.nome),
      descricao: n.data.descricao,
      ja_criado: n.data.ja_criado,
    });
  }

  for (const e of edges) {
    const data = e.data;
    if (!data) continue;
    const subs = data.subitems;
    const src = nomeOuPlaceholder(nodes.find((n) => n.id === e.source)?.data.nome);
    const tgt = nomeOuPlaceholder(nodes.find((n) => n.id === e.target)?.data.nome);
    const contexto = `${src} → ${tgt}`;

    if (data.kind !== 'manual') {
      const rule = data.kind === 'atp' ? data.atp : data.pref;
      const ruleCat: ChecklistGroupKey = data.kind === 'pref' ? 'Preferência' : 'Regra de ATP';
      if (rule?.implantar) {
        groups[ruleCat].push({
          kind: 'rule',
          edgeId: e.id,
          nome: nomeOuPlaceholder(rule.nome || data.resumo),
          descricao: rule.acao || rule.observacoes,
          contexto,
          ja_criado: rule.ja_criado,
          children: subs.map((s, idx) => ({
            kind: 'sub',
            edgeId: e.id,
            index: idx,
            nome: nomeOuPlaceholder(s.nome),
            descricao: s.descricao,
            categoria: s.categoria,
            ja_criado: s.ja_criado,
          })),
        });
        // Subitens aninhados não aparecem nas próprias categorias.
        continue;
      }
    }

    for (const [idx, s] of subs.entries()) {
      const cat: ChecklistGroupKey = categoriaValida(s.categoria) ? s.categoria : 'Outro';
      groups[cat].push({
        kind: 'sub',
        edgeId: e.id,
        index: idx,
        nome: nomeOuPlaceholder(s.nome),
        descricao: s.descricao,
        contexto,
        ja_criado: s.ja_criado,
      });
    }
  }

  return groups;
}

/** Conta total e concluídos somando filhos aninhados em itens `rule`. */
export function contarChecklist(groups: ChecklistGroups): { total: number; done: number } {
  let total = 0;
  let done = 0;
  for (const items of Object.values(groups)) {
    for (const it of items) {
      total += 1;
      if (it.ja_criado) done += 1;
      if (it.kind === 'rule') {
        for (const ch of it.children) {
          total += 1;
          if (ch.ja_criado) done += 1;
        }
      }
    }
  }
  return { total, done };
}

function dataBR(): string {
  return new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Serializa o checklist em Markdown — mesma forma do BETA_2:
 * `# Checklist · <plano>` / `_<data>_` / por seção, `## Categoria (n/m)` +
 * `- [x] item` (subitens aninhados ficam indentados com `  - [x]`).
 */
export function checklistToMarkdown(planoNome: string, groups: ChecklistGroups): string {
  const linhas: string[] = [];
  linhas.push(`# Checklist · ${planoNome}`);
  linhas.push(`_${dataBR()}_`);
  linhas.push('');
  for (const cat of CHECKLIST_GROUP_ORDER) {
    const items = groups[cat];
    if (items.length === 0) continue;
    const ownDone = items.filter((i) => i.ja_criado).length;
    const childTotal = items.reduce(
      (s, x) => s + (x.kind === 'rule' ? x.children.length : 0),
      0,
    );
    const childDone = items.reduce(
      (s, x) =>
        s + (x.kind === 'rule' ? x.children.filter((c) => c.ja_criado).length : 0),
      0,
    );
    linhas.push(`## ${cat} (${ownDone + childDone}/${items.length + childTotal})`);
    for (const it of items) {
      const mark = it.ja_criado ? 'x' : ' ';
      const ctx =
        it.kind === 'sub' && it.contexto
          ? ` _(${it.contexto})_`
          : it.kind === 'rule'
            ? ` _(${it.contexto})_`
            : '';
      const desc = it.descricao ? ` — ${it.descricao}` : '';
      linhas.push(`- [${mark}] ${it.nome}${ctx}${desc}`);
      if (it.kind === 'rule') {
        for (const ch of it.children) {
          const cm = ch.ja_criado ? 'x' : ' ';
          const cat2 = ch.categoria ? ` _[${ch.categoria}]_` : '';
          const cdesc = ch.descricao ? ` — ${ch.descricao}` : '';
          linhas.push(`  - [${cm}] ${ch.nome}${cat2}${cdesc}`);
        }
      }
    }
    linhas.push('');
  }
  return linhas.join('\n');
}
