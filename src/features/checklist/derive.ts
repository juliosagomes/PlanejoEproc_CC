import {
  EFEITO_SEM_MOVER_CURTO,
  SUBITEM_CATS,
  rotuloDescarte,
  ehAtalho,
  nomeDaPonta,
  ehRecursoRegra,
  regraDoSubitem,
  type AtpRule,
  type EdgeData,
  type LocalizadorData,
  type PrefRule,
  type RegraSemMover,
  type Subitem,
  type SubitemCategoria,
} from '@/domain';
import { detalhesAtp } from './detalhesAtp';

/**
 * Deriva o checklist do plano. Função pura, sem dependência de React/store —
 * permite testar o comportamento de agrupamento em isolamento e reutilizar
 * para gerar markdown ou outras saídas. Os imports de `@/data` são JSONs
 * puros (catálogos do Eproc embutidos), então a pureza é preservada.
 *
 * Regras de agrupamento (portadas do BETA_2):
 *
 *  - Cada nó vira um item na seção "Localizador".
 *  - Cada ação preferencial planejada vira um item em "Ação preferencial", com
 *    o localizador como contexto (decisoes.md#D-28).
 *  - Para cada aresta, os recursos de categoria `Regra de ATP`/`Preferência`
 *    que têm `implantar: true` viram itens próprios na seção da sua categoria.
 *    Os campos preenchidos da regra (gatilho, ação programada, filtros,
 *    conteúdo da minuta, etc.) viram `detalhes` rotulados — é o que mostra
 *    "todos os detalhes preenchidos" no modal de checklist.
 *  - Os **demais** recursos da aresta ficam aninhados como filhos da regra
 *    **quando ela é a única** com `implantar`. Com duas ou mais, não há a quem
 *    pendurá-los sem inventar um vínculo que o usuário nunca declarou, então
 *    cada um vai para a própria categoria, com o contexto "L1 → L2" — a mesma
 *    saída de quando nenhuma regra pede implantação.
 *  - Cada regra pendurada num localizador (decisoes.md#D-38) vira item em
 *    "Regra de ATP", com o localizador e o grupo como contexto. Entra sempre,
 *    com ou sem `implantar`: pendurar a regra já é declarar a tarefa, e a
 *    manual nasce com tipo de controle — pela regra das arestas, ela sumiria
 *    do checklist no instante em que foi criada.
 *  - Categoria desconhecida (improvável) cai em "Outro".
 */

export type ChecklistGroupKey = 'Localizador' | 'Ação preferencial' | SubitemCategoria;

export const CHECKLIST_GROUP_ORDER: readonly ChecklistGroupKey[] = [
  'Localizador',
  'Texto padrão',
  'Preferência',
  'Ação preferencial',
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

/**
 * Vínculo planejado de uma preferência a um localizador (decisoes.md#D-28). O
 * contexto é o localizador: a mesma preferência planejada em dois lugares são
 * duas tarefas.
 */
export interface AcaoChecklistItem extends ItemBase {
  kind: 'acao';
  nodeId: string;
  acaoId: string;
  contexto: string;
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
  /** Posição do recurso-regra em `edge.data.subitems` — é por ela que o modal alterna `ja_criado`. */
  index: number;
  contexto: string;
  children: SubChecklistItem[];
  detalhes: ChecklistDetail[];
}

/** Regra de ATP pendurada no localizador, que não move o processo (D-38). */
export interface SemMoverChecklistItem extends ItemBase {
  kind: 'semMover';
  nodeId: string;
  regraId: string;
  contexto: string;
  detalhes: ChecklistDetail[];
}

export type ChecklistItem =
  | NodeChecklistItem
  | SubChecklistItem
  | RuleChecklistItem
  | AcaoChecklistItem
  | SemMoverChecklistItem;

export type ChecklistGroups = Record<ChecklistGroupKey, ChecklistItem[]>;

/**
 * Aceita o formato estrutural mínimo (compatível tanto com o tipo `Localizador`
 * do domain quanto com `FlowNode = RFNode<LocalizadorData>` da store).
 */
type NodeLike = { id: string; data: LocalizadorData };
type EdgeLike = { id: string; source: string; target: string; data?: EdgeData };
/** A aresta pode chegar num grupo (D-31): só o rótulo dele serve ao contexto. */
type GrupoLike = { id: string; rotulo: string };
/** E pode sair de uma entrada por evento (D-38). */
type EntradaLike = { id: string; rotulo: string };

function novoGrupo(): ChecklistGroups {
  return {
    Localizador: [],
    'Texto padrão': [],
    Preferência: [],
    'Ação preferencial': [],
    Modelo: [],
    'Regra de ATP': [],
    Outro: [],
  };
}

function nomeOuPlaceholder(nome: string | undefined): string {
  return nome && nome.trim() ? nome : '(sem nome)';
}

const SUBITEM_CATS_SET: ReadonlySet<SubitemCategoria> = new Set(SUBITEM_CATS);

/**
 * Recurso-regra que o usuário marcou para virar item próprio do checklist.
 * Sem `implantar`, a regra existe no plano mas não é tarefa da secretaria — cai
 * como recurso comum na seção da sua categoria.
 */
function implantavel(s: Subitem): boolean {
  return regraDoSubitem(s)?.rule.implantar === true;
}

function categoriaValida(c: string): c is SubitemCategoria {
  return SUBITEM_CATS_SET.has(c as SubitemCategoria);
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

function detalhesSemMover(r: RegraSemMover): ChecklistDetail[] {
  const out: ChecklistDetail[] = [];
  if (r.efeito === 'limpeza') {
    if (r.tira?.trim()) out.push({ label: 'Tira o localizador', valor: r.tira.trim() });
  } else {
    out.push({
      label: 'Destino no Eproc',
      valor: r.destino ? rotuloDescarte(r.destino) : 'destino de descarte da unidade',
    });
  }
  if (r.descricao?.trim()) out.push({ label: 'Descrição', valor: r.descricao.trim() });
  return r.atp ? [...out, ...detalhesAtp(r.atp)] : out;
}

export function deriveChecklist(
  nodes: ReadonlyArray<NodeLike>,
  edges: ReadonlyArray<EdgeLike>,
  grupos: ReadonlyArray<GrupoLike> = [],
  entradas: ReadonlyArray<EntradaLike> = [],
): ChecklistGroups {
  const groups = novoGrupo();

  for (const n of nodes) {
    // Localizador de sistema fica de fora: o checklist é a lista do que a
    // secretaria precisa configurar no Eproc, e um padrão do sistema nunca entra
    // nessa lista. Incluí-lo o mostraria como tarefa pendente e ainda puxaria a
    // contagem de progresso para baixo (decisoes.md#D-23).
    if (n.data.sistema) continue;
    // Atalho representa outro localizador, que já está na lista (D-30).
    if (ehAtalho(n)) continue;
    groups['Localizador'].push({
      kind: 'node',
      nodeId: n.id,
      nome: nomeOuPlaceholder(n.data.nome),
      descricao: n.data.descricao,
      ja_criado: n.data.ja_criado,
    });
  }

  // Ao contrário do nó, a ação planejada entra mesmo em localizador de
  // sistema: vincular uma preferência a um padrão do Eproc é configuração que a
  // secretaria faz.
  for (const n of nodes) {
    if (ehAtalho(n)) continue;
    for (const a of n.data.acoesPreferenciais ?? []) {
      groups['Ação preferencial'].push({
        kind: 'acao',
        nodeId: n.id,
        acaoId: a.id,
        nome: nomeOuPlaceholder(a.nome),
        contexto: nomeOuPlaceholder(n.data.nome),
        ja_criado: a.ja_criado,
      });
    }
  }

  for (const n of nodes) {
    if (ehAtalho(n)) continue;
    for (const r of n.data.regrasSemMover ?? []) {
      groups['Regra de ATP'].push({
        kind: 'semMover',
        nodeId: n.id,
        regraId: r.id,
        nome: nomeOuPlaceholder(r.nome),
        contexto: `${nomeOuPlaceholder(n.data.nome)} · ${EFEITO_SEM_MOVER_CURTO[r.efeito]}`,
        ja_criado: r.ja_criado,
        detalhes: detalhesSemMover(r),
      });
    }
  }

  for (const e of edges) {
    const data = e.data;
    if (!data) continue;
    const subs = data.subitems;
    const src = nomeOuPlaceholder(nomeDaPonta(nodes, grupos, e.source, entradas));
    const tgt = nomeOuPlaceholder(nomeDaPonta(nodes, grupos, e.target));
    const contexto = `${src} → ${tgt}`;

    const aImplantar = subs
      .map((s, idx) => ({ s, idx }))
      .filter(({ s }) => implantavel(s));
    const comuns = subs
      .map((s, idx) => ({ s, idx }))
      .filter(({ s }) => !ehRecursoRegra(s));
    // Só faz sentido aninhar quando há uma regra e uma só; ver o cabeçalho.
    const aninhar = aImplantar.length === 1;

    for (const { s, idx } of aImplantar) {
      const regra = regraDoSubitem(s);
      if (!regra) continue;
      // `detalhes` cobre acao/observacoes rotulados (e mais), então
      // `descricao` fica vazio para regras — evita duplicar info.
      const detalhes =
        regra.kind === 'atp'
          ? detalhesAtp(regra.rule as AtpRule)
          : detalhesPref(regra.rule as PrefRule);
      groups[regra.kind === 'pref' ? 'Preferência' : 'Regra de ATP'].push({
        kind: 'rule',
        edgeId: e.id,
        index: idx,
        nome: nomeOuPlaceholder(s.nome || data.resumo),
        contexto,
        ja_criado: s.ja_criado,
        detalhes,
        children: aninhar
          ? comuns.map(({ s: c, idx: cIdx }) => ({
              kind: 'sub',
              edgeId: e.id,
              index: cIdx,
              nome: nomeOuPlaceholder(c.nome),
              descricao: c.descricao,
              categoria: c.categoria,
              ja_criado: c.ja_criado,
            }))
          : [],
      });
    }

    for (const [idx, s] of subs.entries()) {
      // Recurso com regra fica de fora: implantado, já entrou como item
      // próprio; não implantado, é escolha explícita do usuário de não pedir
      // essa configuração no checklist — é para isso que a caixa existe. Um
      // recurso de categoria `Preferência` **sem** regra nenhuma segue listado,
      // que é o caso de quem só anotou o nome de uma preferência a criar.
      if (regraDoSubitem(s)) continue;
      if (aninhar) continue;
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
        it.kind === 'node' || !it.contexto ? '' : ` _(${it.contexto})_`;
      const desc = it.descricao ? ` — ${it.descricao}` : '';
      linhas.push(`- [${mark}] ${it.nome}${ctx}${desc}`);
      if (it.kind === 'rule' || it.kind === 'semMover') {
        // Detalhes rotulados (sem checkbox — só info). Valores multi-linha
        // ganham continuação com indent de 4 espaços, que markdown trata
        // como continuação do item da lista.
        for (const d of it.detalhes) {
          const [primeira, ...resto] = d.valor.split('\n');
          linhas.push(`  - **${d.label}:** ${primeira ?? ''}`);
          for (const linha of resto) linhas.push(`    ${linha}`);
        }
      }
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
