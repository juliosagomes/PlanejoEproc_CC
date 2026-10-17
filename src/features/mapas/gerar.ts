import {
  KIND_LABELS,
  chaveMencaoAtp,
  chaveMencaoNome,
  type BlocoFluxo,
  type DefinicaoFlag,
  type Edge,
  type ElementoSlide,
  type Plano,
  type RefMencao,
  type Slide,
  type Subitem,
} from '@/domain';
import { detalhesAtp } from '@/features/checklist/detalhesAtp';
import { uid } from '@/utils/uid';
import { desenharBloco, nomeDoNo, recortar, type Recorte } from './fluxoPapel';
import { esc } from './html';
import { htmlMencao, type CatalogoMencoes } from './mencoes';

/* ============================================================================
 * GERAR MAPA A PARTIR DO FLUXO — o antigo "modo de impressão" (D-39)
 *
 * O usuário escolhe localizadores no quadro, e o mapa nasce com o desenho do
 * recorte e a descrição de cada transição. Tudo o que sai daqui é ponto de
 * partida: o texto vira do usuário, e as menções continuam ligadas à unidade.
 * ========================================================================== */

export type LegendaMapa = 'tabela' | 'origem';

export interface OpcoesGerar {
  legenda: LegendaMapa;
  /** Mostrar, esmaecido, o que entra e sai da seleção. */
  fora: boolean;
  /** Os campos principais da regra embaixo de cada recurso. */
  detalhe: boolean;
  /** Caixas para marcar à caneta, para quem vai implantar. */
  caixas: boolean;
}

export interface Contexto {
  plano: Plano;
  planoId: string;
  ids: readonly string[];
  setores: readonly DefinicaoFlag[];
  catalogo: CatalogoMencoes;
  /** ISO 8601. */
  agora: string;
}

function refLoc(ctx: Contexto, noId: string): RefMencao {
  const nome = nomeDoNo(ctx.plano, noId);
  const chave = chaveMencaoNome(nome);
  const eprocId = ctx.catalogo.locs.get(chave)?.eprocId;
  // O atalho (D-30) aponta para o alvo: é o nome dele que a menção acompanha.
  const no = ctx.plano.nodes.find((n) => n.id === noId)?.data.atalhoPara ?? noId;
  return { tipo: 'loc', chave, rotulo: nome, no: `${ctx.planoId}/${no}`, ...(eprocId ? { eprocId } : {}) };
}

const chipLoc = (ctx: Contexto, noId: string) => htmlMencao(refLoc(ctx, noId));

function chipRecurso(ctx: Contexto, e: Edge, s: Subitem): string {
  if (s.categoria === 'Regra de ATP') {
    return htmlMencao({
      tipo: 'atp',
      chave: chaveMencaoAtp(ctx.planoId, e.id, s.id),
      rotulo: s.nome.trim() || 'Regra de ATP sem nome',
    });
  }
  if (s.categoria === 'Preferência' && s.nome.trim()) {
    const chave = chaveMencaoNome(s.nome);
    const eprocId = ctx.catalogo.prefs.get(chave)?.eprocId;
    return htmlMencao({ tipo: 'pref', chave, rotulo: s.nome.trim(), ...(eprocId ? { eprocId } : {}) });
  }
  return `${esc(s.categoria)}: ${esc(s.nome.trim() || 'sem nome')}`;
}

function detalheRecurso(s: Subitem): string {
  const linhas =
    s.categoria === 'Regra de ATP' && s.atp
      ? detalhesAtp(s.atp).map((l) => `${l.label}: ${l.valor}`)
      : s.categoria === 'Preferência' && s.pref
        ? [s.pref.tipo && `Tipo: ${s.pref.tipo}`, s.pref.acao && `Ação: ${s.pref.acao}`].filter((x): x is string => !!x)
        : [];
  if (!linhas.length) return '';
  return `<span class="regra-mini">${linhas.map((l) => esc(l).replace(/\n/g, '<br>')).join('<br>')}</span>`;
}

function recursosHtml(ctx: Contexto, e: Edge, o: OpcoesGerar): string {
  if (!e.data.subitems.length) {
    return e.data.kind === 'manual' ? 'Sem recurso: feita à mão.' : 'Nenhum recurso cadastrado.';
  }
  return e.data.subitems
    .map((s) => {
      const caixa = o.caixas ? `<span class="caixa${s.ja_criado ? ' feita' : ''}"></span>` : '';
      return `<span class="rec-linha">${caixa}${chipRecurso(ctx, e, s)}</span>${o.detalhe ? detalheRecurso(s) : ''}`;
    })
    .join('');
}

const numeroHtml = (e: Edge, r: Recorte) => `<span class="n ${e.data.kind}">${r.numero[e.id]}</span>`;
const resumoDe = (e: Edge) => esc(e.data.resumo.trim() || 'Sem descrição.');

/** `<figure>` do desenho no documento. Os metadados vão num atributo; o SVG, dentro. */
export function htmlFigura(bloco: BlocoFluxo): string {
  const { svg, ...meta } = bloco;
  const data = new Date(bloco.desenhadoEm).toLocaleDateString('pt-BR');
  return `<figure class="fluxo-bloco" contenteditable="false" data-fluxo="${esc(JSON.stringify(meta))}"><div class="fluxo-cab">Fluxo do plano ${esc(bloco.planoNome)} · ${bloco.nos.length} localizador${bloco.nos.length === 1 ? '' : 'es'} · desenhado em ${data}</div><div class="fluxo-svg">${svg}</div></figure>`;
}

function legendaTabela(ctx: Contexto, r: Recorte, o: OpcoesGerar): string {
  const linhas = r.arestas.map(
    (e) =>
      `<tr><td>${numeroHtml(e, r)}</td><td>${chipLoc(ctx, e.source)} →<br>${chipLoc(ctx, e.target)}</td><td><span class="tipo-p ${e.data.kind}">${KIND_LABELS[e.data.kind]}</span><br>${resumoDe(e)}</td><td>${recursosHtml(ctx, e, o)}</td></tr>`,
  );
  return `<table class="leg"><thead><tr><th>Nº</th><th>De → Para</th><th>Quando</th><th>Recursos no Eproc</th></tr></thead><tbody>${linhas.join('')}</tbody></table>`;
}

function origens(r: Recorte): string[] {
  return [...new Set(r.arestas.map((e) => e.source))];
}

function legendaPorOrigem(ctx: Contexto, r: Recorte, o: OpcoesGerar): string {
  return origens(r)
    .map((id) => {
      const itens = r.arestas
        .filter((e) => e.source === id)
        .map((e) => `<li>${numeroHtml(e, r)} para ${chipLoc(ctx, e.target)}: ${resumoDe(e)}<br>${recursosHtml(ctx, e, o)}</li>`);
      return `<h3>Saídas de ${chipLoc(ctx, id)}</h3><ul>${itens.join('')}</ul>`;
    })
    .join('');
}

export function gerarDocumento(ctx: Contexto, nome: string, o: OpcoesGerar): string {
  const bloco = desenharBloco(ctx.plano, ctx.planoId, ctx.ids, o.fora, ctx.setores, ctx.agora);
  const r = recortar(ctx.plano, bloco.nos, o.fora);
  const data = new Date(ctx.agora).toLocaleDateString('pt-BR');
  const transicoes = r.arestas.length
    ? o.legenda === 'tabela'
      ? legendaTabela(ctx, r, o)
      : legendaPorOrigem(ctx, r, o)
    : '<p>Nenhuma transição entre os localizadores escolhidos.</p>';
  const locs = bloco.nos
    .map((id) => {
      const n = ctx.plano.nodes.find((x) => x.id === id);
      return `<li>${chipLoc(ctx, id)} · ${n?.data.ja_criado ? 'já existe no Eproc' : 'a criar'}</li>`;
    })
    .join('');
  return [
    `<h1>${esc(nome)}</h1>`,
    `<p class="sub">Gerado em ${data} do plano <b>${esc(ctx.plano.planoNome)}</b>, a partir de ${bloco.nos.length} localizador${bloco.nos.length === 1 ? '' : 'es'}. O texto é seu: edite, apague ou acrescente. As menções continuam ligadas à unidade.</p>`,
    htmlFigura(bloco),
    `<h2>Transições</h2>${transicoes}`,
    `<h2>Localizadores</h2><ul>${locs}</ul>`,
    '<h2>Observações</h2><p>Escreva aqui o que o desenho não diz.</p>',
  ].join('');
}

/* ---------------------------------------------------------------------------
 * Slides
 * ------------------------------------------------------------------------- */

export function htmlTitulo(titulo: string, sub?: string): string {
  return `<div class="tit-slide">${titulo}</div>${sub ? `<div class="sub-slide">${sub}</div>` : ''}`;
}

export function elementoTexto(x: number, y: number, w: number, h: number, html: string, tipo: 'texto' | 'nota' = 'texto'): ElementoSlide {
  return { id: uid('el'), tipo, x, y, w, h, html };
}

export function gerarSlides(ctx: Contexto, nome: string, o: OpcoesGerar): Slide[] {
  const fluxo = desenharBloco(ctx.plano, ctx.planoId, ctx.ids, o.fora, ctx.setores, ctx.agora);
  const r = recortar(ctx.plano, fluxo.nos, o.fora);
  const data = new Date(ctx.agora).toLocaleDateString('pt-BR');
  const capa: Slide = {
    id: uid('slide'),
    elementos: [
      elementoTexto(48, 32, 1026, 80, htmlTitulo(esc(nome), `Do plano ${esc(ctx.plano.planoNome)} · ${data}`)),
      { id: uid('el'), tipo: 'fluxo', x: 48, y: 120, w: 1026, h: 630, fluxo },
    ],
  };
  const porOrigem = origens(r)
    .filter((id) => r.escolhidos.has(id))
    .map((id): Slide => {
      const itens = r.arestas
        .filter((e) => e.source === id)
        .map(
          (e) =>
            `<li>${numeroHtml(e, r)} para ${chipLoc(ctx, e.target)}<br><span class="sub-slide">${resumoDe(e)}</span><br>${e.data.subitems.map((s) => chipRecurso(ctx, e, s)).join(' ') || '<span class="sub-slide">feita à mão</span>'}</li>`,
        );
      return {
        id: uid('slide'),
        elementos: [
          elementoTexto(48, 32, 1026, 70, htmlTitulo(`Saídas de ${chipLoc(ctx, id)}`)),
          elementoTexto(48, 130, 640, 610, `<ul class="lista-saidas">${itens.join('')}</ul>`),
          elementoTexto(730, 130, 344, 170, '<b>Observação</b><br>Escreva aqui o que a equipe precisa lembrar nesta fila.', 'nota'),
        ],
      };
    });
  return [capa, ...porOrigem];
}
