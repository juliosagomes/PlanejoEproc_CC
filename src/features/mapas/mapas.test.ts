import { describe, expect, it } from 'vitest';
import {
  CATALOGO_UNIDADE_VERSION,
  SCHEMA_VERSION,
  chaveMencaoAtp,
  type CatalogoUnidade,
  type DefinicaoFlag,
  type Edge,
  type EdgeKind,
  type Localizador,
  type Plano,
  type Subitem,
} from '@/domain';
import {
  assinaturaDoRecorte,
  blocoDesatualizado,
  desenharBloco,
  posicoesNoPapel,
  recortar,
  svgDoRecorte,
  traco,
} from './fluxoPapel';
import { gerarDocumento, gerarSlides, type OpcoesGerar } from './gerar';
import {
  atualizarMencoes,
  buscarMencoes,
  htmlDetalhe,
  htmlMencao,
  montarCatalogo,
  resolver,
} from './mencoes';
import { lerFigura, sanitizarHtml, sanitizarSvgFluxo } from './sanitizar';

const SETORES: DefinicaoFlag[] = [{ id: 'f-sc', code: 'SC', label: 'Secretaria', cor: 1 }];

function no(id: string, nome: string, x: number, y: number, extra: Partial<Localizador['data']> = {}): Localizador {
  return { id, position: { x, y }, data: { nome, ja_criado: false, flags: [], ...extra } };
}

function aresta(id: string, source: string, target: string, kind: EdgeKind, subitems: Subitem[] = []): Edge {
  return { id, source, target, data: { kind, resumo: `resumo ${id}`, observacao: '', subitems } };
}

const atp = (id: string, nome: string): Subitem => ({
  id,
  categoria: 'Regra de ATP',
  nome,
  ja_criado: false,
  atp: { implantar: false, comportamentoOrigem: '0' },
});

function planoFamilia(): Plano {
  return {
    version: SCHEMA_VERSION,
    planoNome: 'Família',
    flowMode: 'sharp',
    flags: SETORES,
    nodes: [
      no('A', 'Ag. Contestação', 0, 200, { ja_criado: true }),
      no('B', 'Analisar Reconvenção', 300, 80, { flags: ['f-sc'] }),
      no('D', 'Ag. Réplica', 600, 200),
      no('E', 'Analisar Contestação', 300, 320),
      no('X', 'Conclusos', 900, 200),
    ],
    edges: [
      aresta('e2', 'A', 'D', 'atp', [atp('s2', 'Contestação simples')]),
      aresta('e1', 'A', 'B', 'atp', [atp('s1', 'Contestação com reconvenção')]),
      aresta('e3', 'A', 'E', 'atp'),
      aresta('e5', 'B', 'D', 'pref', [{ id: 's5', categoria: 'Preferência', nome: 'Intimação para Réplica', ja_criado: true, pref: { implantar: false, tipo: 'Intimação' } }]),
      aresta('e7', 'D', 'X', 'manual'),
      aresta('ev', 'entrada-1', 'A', 'atp'),
    ],
    entradas: [{ id: 'entrada-1', position: { x: -200, y: 200 }, rotulo: 'Petição' }],
  };
}

function unidade(): CatalogoUnidade {
  return {
    version: CATALOGO_UNIDADE_VERSION,
    unidade: { chave: 'h::l::s', host: 'h', login: 'l', sigla: 's' },
    coletadoEm: '2026-10-16T10:00:00.000Z',
    localizadores: [
      { eprocId: '111', sigla: 'Ag. Réplica', nome: 'Ag. Réplica', sistema: false },
      { sigla: 'Arquivo provisório', nome: 'Arquivo provisório', sistema: true },
    ],
    preferencias: [{ eprocId: 'p9', nome: 'Intimação para Réplica', detalhe: 'Intimação', grupo: 'Secretaria' }],
    acoesPreferenciais: [{ localizador: 'Analisar Reconvenção', preferencias: ['Intimação para Réplica'] }],
    fontes: {},
  };
}

const OPCOES: OpcoesGerar = { legenda: 'tabela', fora: false, detalhe: true, caixas: true };

describe('recorte do fluxo', () => {
  it('numera pela leitura do desenho, da esquerda para a direita', () => {
    const r = recortar(planoFamilia(), ['A', 'B', 'D', 'E'], false);
    expect(r.arestas.map((e) => e.id)).toEqual(['e1', 'e2', 'e3', 'e5']);
    expect(r.numero).toEqual({ e1: 1, e2: 2, e3: 3, e5: 4 });
  });

  it('com "fora", traz as pontas de fora e as transições que cruzam a borda', () => {
    const r = recortar(planoFamilia(), ['D'], true);
    expect([...r.visiveis].sort()).toEqual(['A', 'B', 'D', 'X']);
    expect(r.arestas.map((e) => e.id).sort()).toEqual(['e2', 'e5', 'e7']);
  });

  it('ignora a seta que sai de uma entrada por evento, que não tem cartão no papel', () => {
    const r = recortar(planoFamilia(), ['A'], true);
    expect(r.arestas.some((e) => e.id === 'ev')).toBe(false);
  });

  it('desenha em degrau, respeitando a dobra manual', () => {
    const p = planoFamilia();
    const e = { ...p.edges[0]!, data: { ...p.edges[0]!.data, dobra: { fracaoX: 0 } } };
    const t = traco(p.nodes[0]!.position, p.nodes[1]!.position, e);
    expect(t.d.startsWith('M176,228 H196 V')).toBe(true);
  });

  it('volta por baixo quando o destino está atrás da origem', () => {
    const p = planoFamilia();
    const t = traco(p.nodes[2]!.position, p.nodes[0]!.position, aresta('z', 'D', 'A', 'manual'));
    expect(t.d.split(' ')).toHaveLength(6);
  });

  it('no papel, reaproxima os vãos largos sem trocar a ordem', () => {
    const p = planoFamilia();
    p.nodes[4]!.position.x = 5000;
    const pos = posicoesNoPapel(p, recortar(p, ['D', 'X'], false));
    expect(pos.get('X')!.x - pos.get('D')!.x).toBe(176 + 90);
    expect(pos.get('X')!.y).toBe(pos.get('D')!.y);
  });

  it('escapa o nome no SVG e esmaece o que está fora da seleção', () => {
    const p = planoFamilia();
    p.nodes[0]!.data.nome = 'Ag. <b>Contestação</b>';
    const svg = svgDoRecorte(p, recortar(p, ['D'], true), SETORES);
    expect(svg).toContain('Ag. &lt;b&gt;Contestação&lt;/b&gt;');
    expect(svg).toContain('class="fantasma"');
    expect(svg).toContain('var(--p-flag-1-bg)');
  });

  it('a assinatura muda com o que o desenho mostra, e só com isso', () => {
    const p = planoFamilia();
    const base = assinaturaDoRecorte(p, recortar(p, ['A', 'B'], false));
    const longe = structuredClone(p);
    longe.nodes[4]!.position.x = 5000;
    expect(assinaturaDoRecorte(longe, recortar(longe, ['A', 'B'], false))).toBe(base);
    const renomeado = structuredClone(p);
    renomeado.nodes[1]!.data.nome = 'Outro nome';
    expect(assinaturaDoRecorte(renomeado, recortar(renomeado, ['A', 'B'], false))).not.toBe(base);
  });

  it('o bloco avisa quando o plano mudou ou sumiu', () => {
    const p = planoFamilia();
    const bloco = desenharBloco(p, 'p1', ['A', 'B'], false, SETORES, '2026-10-16T10:00:00.000Z');
    expect(blocoDesatualizado(bloco, p)).toBe(false);
    const mudou = structuredClone(p);
    mudou.edges[1]!.data.kind = 'manual';
    expect(blocoDesatualizado(bloco, mudou)).toBe(true);
    expect(blocoDesatualizado(bloco, null)).toBe(true);
  });
});

describe('menções', () => {
  const cat = () => montarCatalogo({ planos: [{ id: 'p1', plano: planoFamilia() }], unidade: unidade(), setores: SETORES });

  it('junta localizadores da unidade e dos planos, sem repetir', () => {
    const c = cat();
    const nomes = c.itens.filter((i) => i.ref.tipo === 'loc').map((i) => i.nome);
    expect(nomes.filter((n) => n === 'Ag. Réplica')).toHaveLength(1);
    expect(nomes).toContain('Arquivo provisório');
    expect(nomes).toContain('Conclusos');
  });

  it('a regra de ATP é o recurso da aresta, com o plano na chave', () => {
    const c = cat();
    const r = resolver({ tipo: 'atp', chave: chaveMencaoAtp('p1', 'e2', 's2'), rotulo: 'x' }, c);
    expect(r?.nome).toBe('Contestação simples');
    expect(r?.tipo === 'atp' && r.info.de).toBe('Ag. Contestação');
  });

  it('busca sem acento e prefere o começo da palavra', () => {
    const achados = buscarMencoes(cat(), 'replica', 'todos', 5);
    expect(achados[0]?.nome).toBe('Ag. Réplica');
    expect(achados.some((i) => i.ref.tipo === 'pref' && i.nome === 'Intimação para Réplica')).toBe(true);
    // A regra também é achada pela rota: quem procura "réplica" quer o que leva para lá.
    expect(buscarMencoes(cat(), 'replica', 'atp', 5).map((i) => i.nome)).toEqual(['Contestação simples']);
    expect(buscarMencoes(cat(), 'reconv', 'loc', 5).map((i) => i.nome)).toEqual(['Analisar Reconvenção']);
  });

  it('acompanha a renomeação pelo id do Eproc', () => {
    const u = unidade();
    u.localizadores[0]!.nome = 'Aguardando Réplica do Autor';
    const c = montarCatalogo({ planos: [], unidade: u, setores: [] });
    const r = resolver({ tipo: 'loc', chave: 'ag. replica', rotulo: 'Ag. Réplica', eprocId: '111' }, c);
    expect(r?.nome).toBe('Aguardando Réplica do Autor');
  });

  it('acompanha a renomeação feita no plano pelo nó de origem', () => {
    const div = document.createElement('div');
    div.innerHTML = htmlMencao({ tipo: 'loc', chave: 'analisar contestacao', rotulo: 'Analisar Contestação', no: 'p1/E' });
    const p = planoFamilia();
    p.nodes[3]!.data.nome = 'Analisar Contestação com vários réus';
    const c = montarCatalogo({ planos: [{ id: 'p1', plano: p }], unidade: null, setores: [] });
    atualizarMencoes(div, c);
    const el = div.querySelector('.mencao')!;
    expect(el.textContent).toBe('Analisar Contestação com vários réus');
    expect(el.classList.contains('sumiu')).toBe(false);
    expect(el.getAttribute('data-chave')).toBe('analisar contestacao com varios reus');
  });

  it('atualiza o texto das menções e risca a que sumiu', () => {
    const div = document.createElement('div');
    div.innerHTML =
      htmlMencao({ tipo: 'loc', chave: 'ag. replica', rotulo: 'nome antigo', eprocId: '111' }) +
      htmlMencao({ tipo: 'atp', chave: 'p1/nao/existe', rotulo: 'Regra apagada' });
    const mudou = atualizarMencoes(div, cat());
    const [loc, atpEl] = [...div.querySelectorAll('.mencao')];
    expect(mudou).toBe(1);
    expect(loc!.textContent).toBe('Ag. Réplica');
    expect(atpEl!.classList.contains('sumiu')).toBe(true);
    expect(atpEl!.textContent).toBe('Regra apagada');
  });

  it('escapa o rótulo e a chave', () => {
    const html = htmlMencao({ tipo: 'loc', chave: 'a"b', rotulo: '<i>x</i>' });
    expect(html).toContain('data-chave="a&quot;b"');
    expect(html).toContain('&lt;i&gt;x&lt;/i&gt;');
  });

  it('o detalhe traz a preferência com grupo, onde atua e para onde leva', () => {
    const html = htmlDetalhe({ tipo: 'pref', chave: 'intimacao para replica', rotulo: 'x' }, cat());
    expect(html).toContain('Secretaria');
    expect(html).toContain('data-chave="analisar reconvencao"');
    expect(html).toContain('data-chave="ag. replica"');
  });
});

describe('gerar mapa a partir do fluxo', () => {
  const ctx = () => {
    const plano = planoFamilia();
    return {
      plano,
      planoId: 'p1',
      ids: ['A', 'B', 'D', 'E'],
      setores: SETORES,
      catalogo: montarCatalogo({ planos: [{ id: 'p1', plano }], unidade: unidade(), setores: SETORES }),
      agora: '2026-10-16T10:00:00.000Z',
    };
  };

  it('o documento tem o desenho, uma linha por transição e menções ligadas', () => {
    const html = gerarDocumento(ctx(), 'Mapa da contestação', OPCOES);
    const div = document.createElement('div');
    div.innerHTML = html;
    expect(div.querySelector('h1')?.textContent).toBe('Mapa da contestação');
    expect(div.querySelectorAll('table.leg tbody tr')).toHaveLength(4);
    expect(div.querySelector('.mencao[data-eproc-id="111"]')).not.toBeNull();
    expect(div.querySelector(`.mencao[data-chave="${chaveMencaoAtp('p1', 'e1', 's1')}"]`)).not.toBeNull();
    expect(div.querySelectorAll('.caixa')).toHaveLength(3);
    const fig = div.querySelector('figure.fluxo-bloco');
    expect(fig && lerFigura(fig)?.nos).toEqual(['A', 'B', 'D', 'E']);
  });

  it('o detalhe em texto corrido troca a lista de campos pela regra em português', () => {
    const div = document.createElement('div');
    div.innerHTML = gerarDocumento(ctx(), 'M', { ...OPCOES, corrido: true });
    const textos = [...div.querySelectorAll('p.regra-mini')].map((p) => p.textContent);
    expect(textos).toContain(
      'Quando [falta tipo de controle], o processo que estiver em Ag. Contestação vai para Analisar Reconvenção e sai de Ag. Contestação.',
    );
    expect(textos).toContain('Preferência de intimação.');
    expect(div.innerHTML).not.toContain('Comportamento do Localizador ORIGEM');
  });

  it('a legenda por origem agrupa pelas saídas de cada localizador', () => {
    const div = document.createElement('div');
    div.innerHTML = gerarDocumento(ctx(), 'M', { ...OPCOES, legenda: 'origem' });
    expect(div.querySelectorAll('h3')).toHaveLength(2);
  });

  it('em slides: a capa com o desenho e um slide por localizador de origem', () => {
    const slides = gerarSlides(ctx(), 'M', OPCOES);
    expect(slides).toHaveLength(3);
    expect(slides[0]!.elementos.some((e) => e.tipo === 'fluxo')).toBe(true);
  });
});

describe('sanitização do documento', () => {
  it('tira script, eventos e imagem remota, e desembrulha o que não conhece', () => {
    const limpo = sanitizarHtml(
      '<p onclick="x()">Oi <font color="red">vermelho</font><script>alert(1)</script></p><img src="https://x/y.png"><a href="https://x">link</a>',
    );
    expect(limpo).toBe('<p>Oi vermelho</p>link');
  });

  it('mantém as menções, a largura da imagem local e o desenho dentro da figura', () => {
    const fig = '<figure class="fluxo-bloco" contenteditable="false" data-fluxo="{}"><div class="fluxo-svg"><svg viewBox="0 0 1 1"><rect fill="var(--p-flag-1-bg)" onload="x()"/></svg></div></figure>';
    const mencao = htmlMencao({ tipo: 'pref', chave: 'k', rotulo: 'r', eprocId: '9' });
    const limpo = sanitizarHtml(`${fig}<p>${mencao}<img src="data:image/png;base64,AA" style="width:50%"></p>`);
    expect(limpo).toContain('data-eproc-id="9"');
    expect(limpo).toContain('contenteditable="false"');
    expect(limpo).toContain('style="width:50%"');
    expect(limpo).toContain('fill="var(--p-flag-1-bg)"');
    expect(limpo).not.toContain('onload');
  });

  it('o SVG fora da figura do app não passa', () => {
    expect(sanitizarHtml('<p><svg><rect/></svg>texto</p>')).toBe('<p>texto</p>');
  });

  it('o desenho do slide passa pelo mesmo crivo', () => {
    const bloco = desenharBloco(planoFamilia(), 'p1', ['A', 'B'], false, SETORES, '2026-10-16T10:00:00.000Z');
    const limpo = sanitizarSvgFluxo(bloco.svg);
    const contar = (html: string, sel: string) => {
      const t = document.createElement('template');
      t.innerHTML = html;
      return t.content.querySelectorAll(sel).length;
    };
    for (const sel of ['rect', 'path', 'circle', 'foreignObject', '.chave-p .it']) {
      expect(contar(limpo, sel)).toBe(contar(bloco.svg, sel));
    }
    expect(limpo).toContain('Analisar Reconvenção');
    expect(sanitizarSvgFluxo('<svg onload="x()"><script>1</script></svg>')).toBe('<svg></svg>');
  });
});
