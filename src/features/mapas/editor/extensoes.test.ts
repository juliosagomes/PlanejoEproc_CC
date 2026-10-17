import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, type Plano } from '@/domain';
import { gerarDocumento } from '../gerar';
import { htmlDetalhe, htmlMencao, montarCatalogo } from '../mencoes';
import { sanitizarHtml } from '../sanitizar';
import { extensoesDoDocumento } from './extensoes';
import { atributosDaRef, sincronizarMencoes } from './mencoesNoEditor';

function plano(): Plano {
  const no = (id: string, nome: string, x: number, y: number) => ({
    id,
    position: { x, y },
    data: { nome, ja_criado: id === 'A', flags: [] },
  });
  return {
    version: SCHEMA_VERSION,
    planoNome: 'Família',
    flowMode: 'sharp',
    flags: [],
    nodes: [no('A', 'Ag. Contestação', 0, 100), no('D', 'Ag. Réplica', 400, 100), no('E', 'Analisar', 200, 260)],
    edges: [
      {
        id: 'e1',
        source: 'A',
        target: 'D',
        data: {
          kind: 'atp',
          resumo: 'Contestação juntada',
          observacao: '',
          subitems: [{ id: 's1', categoria: 'Regra de ATP', nome: 'Contestação simples', ja_criado: true, atp: { implantar: false, comportamentoOrigem: '0' } }],
        },
      },
      { id: 'e2', source: 'A', target: 'E', data: { kind: 'manual', resumo: 'À mão', observacao: '', subitems: [] } },
    ],
  };
}

const editores: Editor[] = [];
function abrir(html: string): Editor {
  const e = new Editor({ extensions: extensoesDoDocumento(), content: sanitizarHtml(html) });
  editores.push(e);
  return e;
}
afterEach(() => editores.splice(0).forEach((e) => e.destroy()));

const ctx = () => {
  const p = plano();
  return {
    plano: p,
    planoId: 'p1',
    ids: ['A', 'D', 'E'],
    setores: [],
    catalogo: montarCatalogo({ planos: [{ id: 'p1', plano: p }], unidade: null, setores: [] }),
    agora: '2026-10-16T10:00:00.000Z',
  };
};

function dom(html: string): HTMLElement {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div;
}

describe('o documento gerado passa pelo esquema do editor sem perda', () => {
  const opcoes = { legenda: 'tabela' as const, fora: false, detalhe: true, caixas: true };

  it('mantém menções, números, caixas, tipo, tabela e o desenho', () => {
    const original = dom(gerarDocumento(ctx(), 'Mapa', opcoes));
    const volta = dom(abrir(original.innerHTML).getHTML());

    const mencoes = (d: HTMLElement) =>
      [...d.querySelectorAll('.mencao')].map((m) => [m.getAttribute('data-tipo'), m.getAttribute('data-chave'), m.getAttribute('data-no'), m.textContent]);
    expect(mencoes(volta)).toEqual(mencoes(original));
    expect([...volta.querySelectorAll('.n')].map((n) => n.className + n.textContent)).toEqual(['n atp1', 'n manual2']);
    expect(volta.querySelectorAll('.caixa.feita')).toHaveLength(1);
    expect(volta.querySelector('.tipo-p.atp')?.textContent).toBe('ATP');
    const linhas = [...volta.querySelectorAll('table.leg tr')];
    expect(linhas.filter((tr) => tr.querySelector('td'))).toHaveLength(2);
    expect(linhas[0]?.querySelectorAll('th')[1]?.textContent).toBe('De → Para');
    expect(volta.querySelector('p.regra-mini')).not.toBeNull();
    const fig = volta.querySelector('figure.fluxo-bloco');
    expect(JSON.parse(fig!.getAttribute('data-fluxo')!).nos).toEqual(['A', 'D', 'E']);
    expect(fig!.querySelectorAll('.fluxo-svg rect.no-r')).toHaveLength(3);
  });

  it('a ida e volta é estável: abrir o que foi gravado não muda nada', () => {
    const uma = abrir(gerarDocumento(ctx(), 'Mapa', { ...opcoes, legenda: 'origem' })).getHTML();
    expect(abrir(uma).getHTML()).toBe(uma);
  });

  it('o bloco de detalhe vira um bloco editável, com as menções dentro', () => {
    const c = ctx();
    const ref = { tipo: 'atp' as const, chave: 'p1/e1/s1', rotulo: 'x' };
    const volta = dom(abrir(htmlDetalhe(ref, c.catalogo)).getHTML());
    expect(volta.querySelector('.detalhe-mencao p.dm-tit .mencao')?.textContent).toBe('Contestação simples');
    expect(volta.querySelectorAll('.detalhe-mencao .mencao[data-tipo="loc"]')).toHaveLength(2);
  });

  it('imagem de endereço remoto não entra, nem colada', () => {
    const e = abrir('<p>a</p>');
    e.commands.focus('end');
    e.commands.insertContent('<p><b>do Word</b><img src="https://x.com/y.png"><a href="https://x.com">link</a></p>');
    const html = e.getHTML();
    expect(html).toContain('<strong>do Word</strong>');
    expect(html).not.toContain('x.com');
  });

  it('a imagem guarda a largura', () => {
    const volta = abrir('<p><img src="data:image/png;base64,AA" style="width:33%"></p>').getHTML();
    expect(volta).toMatch(/style="width: ?33%;?"/);
  });
});

describe('menções no editor', () => {
  it('a menção inserida entra no desfazer', () => {
    const e = abrir('<p>Ver </p>');
    e.commands.focus('end');
    e.commands.insertContent({ type: 'mencao', attrs: atributosDaRef({ tipo: 'loc', chave: 'ag. replica', rotulo: 'Ag. Réplica' }) });
    expect(e.getHTML()).toContain('data-chave="ag. replica"');
    e.commands.undo();
    expect(e.getHTML()).not.toContain('mencao');
  });

  it('acompanha a unidade fora do desfazer, e risca o que sumiu', () => {
    const c = ctx();
    const e = abrir(
      `<p>${htmlMencao({ tipo: 'loc', chave: 'ag. replica', rotulo: 'Ag. Réplica', no: 'p1/D' })} e ${htmlMencao({ tipo: 'atp', chave: 'p1/x/y', rotulo: 'Apagada' })}</p>`,
    );
    const renomeado = plano();
    renomeado.nodes[1]!.data.nome = 'Aguardando Réplica';
    const cat = montarCatalogo({ planos: [{ id: 'p1', plano: renomeado }], unidade: null, setores: [] });
    expect(sincronizarMencoes(e, cat)).toBe(true);
    const html = e.getHTML();
    expect(html).toContain('>Aguardando Réplica<');
    expect(html).toContain('mencao m-atp sumiu');
    e.commands.undo();
    expect(e.getHTML()).toContain('>Aguardando Réplica<');
    expect(sincronizarMencoes(e, cat)).toBe(false);
    void c;
  });
});
