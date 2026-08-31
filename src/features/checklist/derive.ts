import {
  SUBITEM_CATS,
  type AtpRule,
  type EdgeData,
  type LocalizadorData,
  type PrefRule,
  type SubitemCategoria,
} from '@/domain';
import {
  CLASSES_JUDICIAIS,
  COMPETENCIAS,
  EVENTOS,
  STATUS_PROCESSO,
  TIPOS_ACAO_PROGRAMADA,
  TIPOS_CONTROLE,
  buscarLabel,
} from '@/data';

/**
 * Deriva o checklist do plano. Função pura, sem dependência de React/store —
 * permite testar o comportamento de agrupamento em isolamento e reutilizar
 * para gerar markdown ou outras saídas. Os imports de `@/data` são JSONs
 * puros (catálogos do Eproc embutidos), então a pureza é preservada.
 *
 * Regras de agrupamento (portadas do BETA_2):
 *
 *  - Cada nó vira um item na seção "Localizador".
 *  - Para cada aresta:
 *    - Se `kind` é `atp` ou `pref` E a regra tem `implantar: true`, a regra
 *      vira item próprio na seção "Regra de ATP" / "Preferência", e os
 *      subitens da aresta ficam aninhados como filhos dela. Os campos
 *      preenchidos da regra (gatilho, ação programada, filtros, conteúdo
 *      da minuta, etc.) viram `detalhes` rotulados — é o que mostra "todos
 *      os detalhes preenchidos" no modal de checklist.
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

/**
 * Linha de detalhe de uma regra (ATP ou Preferência) no checklist. Cada campo
 * preenchido vira um par rotulado; o consumidor (modal/markdown) decide se
 * quebra `valor` em múltiplas linhas (textos longos como conteúdo de minuta
 * podem conter `\n`).
 */
export interface ChecklistDetail {
  label: string;
  valor: string;
}

export interface RuleChecklistItem extends ItemBase {
  kind: 'rule';
  edgeId: string;
  contexto: string;
  children: SubChecklistItem[];
  detalhes: ChecklistDetail[];
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

/** "código — rótulo" se o catálogo conhece o código; senão só o código. */
function fmtCodigo(catalogo: ReadonlyArray<{ value: string; label: string }>, code: string): string {
  const label = buscarLabel(catalogo as never, code);
  return label ? `${code} — ${label}` : code;
}

function fmtIds(
  catalogo: ReadonlyArray<{ value: string; label: string }>,
  ids: ReadonlyArray<string>,
): string {
  return ids.map((id) => buscarLabel(catalogo as never, id) ?? id).join(', ');
}

function detalhesAtp(rule: AtpRule): ChecklistDetail[] {
  const out: ChecklistDetail[] = [];
  const t = rule.trigger;
  if (t) {
    out.push({ label: 'Gatilho', valor: fmtCodigo(TIPOS_CONTROLE, t.tipo) });
    if ((t.tipo === 'E' || t.tipo === 'A') && t.eventoIds && t.eventoIds.length > 0) {
      out.push({ label: 'Eventos', valor: fmtIds(EVENTOS, t.eventoIds) });
    }
    if (t.tipo === 'D') {
      if (t.data) out.push({ label: 'Data', valor: t.data });
      if (t.periodicidadeDias != null) {
        out.push({ label: 'Periodicidade', valor: `${t.periodicidadeDias} dia(s)` });
      }
    }
    if (t.tipo === 'L' && t.diasNoLocalizador != null) {
      out.push({ label: 'Dias no localizador', valor: String(t.diasNoLocalizador) });
    }
    if (t.tipo === 'S' && t.diasNaSituacao != null) {
      out.push({ label: 'Dias na situação', valor: String(t.diasNaSituacao) });
    }
    if (t.tipo === 'V' && t.diasSemMovimentacao != null) {
      out.push({ label: 'Dias sem movimentação', valor: String(t.diasSemMovimentacao) });
    }
  }
  if (rule.acaoTipo) {
    out.push({ label: 'Ação programada', valor: fmtCodigo(TIPOS_ACAO_PROGRAMADA, rule.acaoTipo) });
  }
  if (rule.acao?.trim()) {
    out.push({ label: 'Detalhes da ação', valor: rule.acao.trim() });
  }
  if (rule.condicoes?.trim()) {
    out.push({ label: 'Condições', valor: rule.condicoes.trim() });
  }
  const f = rule.filtros;
  if (f) {
    if (f.classesJudiciaisIds?.length) {
      out.push({ label: 'Classes judiciais', valor: fmtIds(CLASSES_JUDICIAIS, f.classesJudiciaisIds) });
    }
    if (f.competenciaIds?.length) {
      out.push({ label: 'Competência', valor: fmtIds(COMPETENCIAS, f.competenciaIds) });
    }
    if (f.statusProcessoIds?.length) {
      out.push({ label: 'Situação do processo', valor: fmtIds(STATUS_PROCESSO, f.statusProcessoIds) });
    }
  }
  if (rule.observacoes?.trim()) {
    out.push({ label: 'Observações', valor: rule.observacoes.trim() });
  }
  return out;
}

const MINUTA_MODO_LABEL = { modelo: 'Modelo', texto_padrao: 'Texto padrão' } as const;

function detalhesPref(rule: PrefRule): ChecklistDetail[] {
  const out: ChecklistDetail[] = [];
  if (rule.tipo) out.push({ label: 'Tipo', valor: rule.tipo });
  if (rule.tipo === 'Minuta' && rule.minutaModo) {
    const modoLabel = MINUTA_MODO_LABEL[rule.minutaModo];
    const conteudo = rule.minutaConteudo?.trim();
    if (conteudo) {
      out.push({ label: modoLabel, valor: conteudo });
    } else {
      out.push({ label: 'Conteúdo da minuta', valor: `${modoLabel} (sem conteúdo)` });
    }
  }
  if (rule.acao?.trim()) out.push({ label: 'Efeito', valor: rule.acao.trim() });
  if (rule.observacoes?.trim()) out.push({ label: 'Observações', valor: rule.observacoes.trim() });
  return out;
}

export function deriveChecklist(
  nodes: ReadonlyArray<NodeLike>,
  edges: ReadonlyArray<EdgeLike>,
): ChecklistGroups {
  const groups = novoGrupo();

  for (const n of nodes) {
    // Localizador de sistema fica de fora: o checklist é a lista do que a
    // secretaria precisa configurar no Eproc, e um padrão do sistema nunca entra
    // nessa lista. Incluí-lo o mostraria como tarefa pendente e ainda puxaria a
    // contagem de progresso para baixo (decisoes.md#D-23).
    if (n.data.sistema) continue;
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
        // `detalhes` cobre acao/observacoes rotulados (e mais), então
        // `descricao` fica vazio para regras — evita duplicar info.
        const detalhes =
          data.kind === 'atp'
            ? detalhesAtp(rule as AtpRule)
            : detalhesPref(rule as PrefRule);
        groups[ruleCat].push({
          kind: 'rule',
          edgeId: e.id,
          nome: nomeOuPlaceholder(rule.nome || data.resumo),
          contexto,
          ja_criado: rule.ja_criado,
          detalhes,
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
        // Detalhes rotulados (sem checkbox — só info). Valores multi-linha
        // ganham continuação com indent de 4 espaços, que markdown trata
        // como continuação do item da lista.
        for (const d of it.detalhes) {
          const [primeira, ...resto] = d.valor.split('\n');
          linhas.push(`  - **${d.label}:** ${primeira ?? ''}`);
          for (const linha of resto) linhas.push(`    ${linha}`);
        }
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
