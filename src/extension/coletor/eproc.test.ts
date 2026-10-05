import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ACOES from '@/infra/eproc/__fixtures__/localizadorAcaoPreferencialListar.html?raw';
import ORGAO from '@/infra/eproc/__fixtures__/localizadorOrgaoListar.html?raw';
import MODELOS from '@/infra/eproc/__fixtures__/modeloPadraoListar.html?raw';
import SELECT from '@/infra/eproc/__fixtures__/selLocalizador.html?raw';
import TEXTOS from '@/infra/eproc/__fixtures__/textoPadraoListar.html?raw';
import { aplicarColeta } from '@/infra/eproc/aplicarColeta';
import type { ColetaUnidade } from '@/infra/eproc/tipos';
import { coletarUnidadeNaAba } from './eproc';

/* ============================================================================
 * O teste que existe por causa de um modo de falha invisível.
 *
 * `chrome.scripting.executeScript({ func })` serializa a função com
 * `toString()` e a re-avalia na aba do Eproc, onde **nada do escopo de módulo
 * existe**. Se alguém adicionar um helper no topo do arquivo, ou um `import` de
 * valor, o resultado é um `ReferenceError` no console *da aba do Eproc* — não no
 * do app —, com o botão simplesmente não fazendo nada.
 *
 * O `new Function` abaixo reproduz essa re-avaliação num escopo vazio. É o único
 * jeito de fazer esse erro aparecer aqui em vez de em produção. (Ele vive num
 * teste; o critério de "pronto" que proíbe `new Function` fala do `dist-ext/`.)
 * ========================================================================== */

/** Reconstrói a função num escopo sem módulo, como o Chrome faz na injeção. */
function reavaliarIsolada<T>(fn: T): T {
  // eslint-disable-next-line no-new-func
  return new Function(`"use strict"; return (${String(fn)});`)() as T;
}

/**
 * O Eproc serve latin-1; o coletor decodifica como tal, então o falso também.
 *
 * Caracteres fora da faixa viram `?`, nunca `charCode & 0xff`. O mascaramento
 * ingênuo transforma um travessão (U+2014) no byte de controle 0x14, que dentro
 * de uma fixture XML quebra o parse e faz o teste falhar a quilômetros da causa
 * — foi o que aconteceu aqui. O conteúdo que o Eproc realmente serve é latin-1
 * e passa intacto; quem cai neste caminho é a prosa dos comentários das
 * fixtures, onde a substituição é inofensiva.
 */
function corpoLatin1(texto: string): ArrayBuffer {
  const bytes = new Uint8Array(texto.length);
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto.charCodeAt(i);
    bytes[i] = c > 0xff ? 0x3f : c;
  }
  return bytes.buffer;
}

function resposta(html: string): Response {
  return {
    ok: true,
    status: 200,
    arrayBuffer: () => Promise.resolve(corpoLatin1(html)),
  } as unknown as Response;
}

const PAGINA_ORGAO = `<html><body><h1>Localizadores do Órgão</h1>${ORGAO}
  <p>7 registros</p></body></html>`;
const PAGINA_SELECT = `<html><body>${SELECT}</body></html>`;
// O hash do autocompletar aqui não é mais lido: as preferências vêm da lista do
// Relatório Geral (decisoes.md#D-37).
const PAGINA_MODELOS = `<html><body>${MODELOS}<p>4 registros</p>
  <script>var u = "controlador_ajax.php?acao_ajax=preferencia_auto_completar&nomeAcao=minuta_cadastrar&hash=0123456789abcdef0123456789abcdef";</script>
  </body></html>`;
const PAGINA_TEXTOS = `<html><body>${TEXTOS}<p>3 registros</p></body></html>`;

/* --- Lista de preferências do componente novo (decisoes.md#D-37) ----------
 * Sintética, no formato levantado no eproc1g em 04/10/2026: a tela do Relatório
 * Geral tem o botão com a URL da janela; a janela traz a URL da lista; a lista
 * é um POST com o tipo em `acao_request`. As descrições trazem entidades HTML e
 * o JSON é ASCII, com `\u00..` nos acentos, como no Eproc. */
const TELA_RG_LISTA = `<html><body>
  <button type="button" id="selPreferencia-list" data-url="controlador.php?acao=ui_preferencias/modal_lista_preferencias&amp;acao_request=relatorio_geral_listar&amp;hash=111"></button>
  </body></html>`;
const MODAL_LISTA = `<html><body><form id="frm_preferencias"></form><script>
  DataTableHelper.build({ "ajax": "controlador_ajax.php?acao_ajax=data_table_listar_v2&contexto_datatable[0]=UiPreferenciasRN&acao_origem=ui_preferencias/modal_lista_preferencias&hash=222" });
  </script></body></html>`;
let proximoId = 1000;
const linha = (Descricao: string, grupo = '', SinPreferenciaIndividual = 'N') => ({
  Descricao,
  SinValorPadrao: '',
  SinPainelInicial: '',
  SinPreferenciaIndividual,
  DescricaoGrupoFormularioPersonalizacaoGrupo: grupo,
  IdFormularioPersonalizacao: String((proximoId += 1)),
});
/** Como o Eproc: JSON só com ASCII, acentos em `\u00..`. */
const lista = (...linhas: ReturnType<typeof linha>[]) =>
  JSON.stringify({ draw: 1, recordsTotal: linhas.length, recordsFiltered: linhas.length, data: linhas }).replace(
    /[\u0080-￿]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
const LISTAS: Record<string, string> = {
  minuta_cadastrar: lista(
    linha('&#128309; GAB - Despachar', 'Preferências de Gabinete'),
    linha('Juntar AR'),
    linha('Expedir Ofício'),
  ),
  processo_movimento_consultar: lista(linha('Dar Andamento', 'Secretaria'), linha('Arquivar')),
  // A repetida não duplica; a individual é do servidor, não da unidade.
  processo_intimacao_bloco: lista(linha('Juntar AR'), linha('Minha pessoal', '', 'S'), linha('Intimar Exequente')),
  relatorio_geral_listar: lista(linha('Conclusos há 30 dias', 'Gerenciamento')),
  localizador_processos_lista: lista(linha('Expedição', 'Secretaria')),
  minuta_area_trabalho: lista(),
  relatorio_sem_movimentacao_listar: lista(),
};

/**
 * As rotas do caminho novo das preferências. `null` quando a URL não é dele,
 * para o fetch falso seguir para as outras telas. A janela vem antes do
 * Relatório Geral: a URL dela também cita `relatorio_geral_listar`.
 */
function rotaLista(
  url: string,
  init?: RequestInit,
  listas: Record<string, string> = LISTAS,
): Promise<Response> | null {
  if (url.includes('data_table_listar_v2')) {
    const tipo = new URLSearchParams(String(init?.body ?? '')).get('acao_request') ?? '';
    return Promise.resolve(resposta(listas[tipo] ?? '<html>erro</html>'));
  }
  if (url.includes('modal_lista_preferencias')) return Promise.resolve(resposta(MODAL_LISTA));
  if (url.includes('relatorio_geral_listar')) return Promise.resolve(resposta(TELA_RG_LISTA));
  return null;
}

/** Menu do Painel do Diretor de Secretaria, reduzido aos dois links usados. */
/* ---------------------------------------------------------------------------
 * Simulação de iframe.
 *
 * O jsdom não navega iframes: sem isto, `frame.src = url` nunca dispara `load`
 * e o coletor fica esperando até o timeout. Como a paginação de Modelos e
 * Textos Padrão só existe através do JS da página (ver o comentário em
 * `coletarGradePorIframe`), simular o frame é a única forma de exercitar esse
 * laço aqui — e o que se ganha é justamente cobrir o caminho mais frágil.
 *
 * A simulação reproduz o contrato que o Chrome oferece: `src` navega e dispara
 * `load`; `contentDocument` devolve o documento; `contentWindow.infraAcaoPaginar`
 * avança uma página e dispara `load` de novo.
 * ------------------------------------------------------------------------- */

interface EstadoFrame {
  paginas: string[];
  atual: number;
  doc: Document;
}

const estados = new WeakMap<HTMLIFrameElement, EstadoFrame>();
let paginasPorTela: Record<string, string[]> = {};
const originais: PropertyDescriptor[] = [];

function instalarIframeFalso(): void {
  const proto = HTMLIFrameElement.prototype;
  for (const nome of ['src', 'contentDocument', 'contentWindow'] as const) {
    const d = Object.getOwnPropertyDescriptor(proto, nome);
    if (d) originais.push(Object.assign({ __nome: nome }, d) as PropertyDescriptor);
  }

  const render = (frame: HTMLIFrameElement, estado: EstadoFrame) => {
    const html = estado.paginas[estado.atual] ?? '';
    estado.doc = new DOMParser().parseFromString(html, 'text/html');
    setTimeout(() => frame.dispatchEvent(new Event('load')), 0);
  };

  Object.defineProperty(proto, 'src', {
    configurable: true,
    set(this: HTMLIFrameElement, url: string) {
      const chave = Object.keys(paginasPorTela).find((k) => url.includes(k)) ?? '';
      const estado: EstadoFrame = {
        paginas: paginasPorTela[chave] ?? [],
        atual: 0,
        doc: document.implementation.createHTMLDocument(),
      };
      estados.set(this, estado);
      render(this, estado);
    },
    get(this: HTMLIFrameElement) {
      return '';
    },
  });

  Object.defineProperty(proto, 'contentDocument', {
    configurable: true,
    get(this: HTMLIFrameElement) {
      return estados.get(this)?.doc ?? null;
    },
  });

  Object.defineProperty(proto, 'contentWindow', {
    configurable: true,
    get(this: HTMLIFrameElement) {
      const frame = this;
      const estado = estados.get(frame);
      if (!estado) return null;
      return {
        stop: () => {},
        infraAcaoPaginar: () => {
          if (estado.atual < estado.paginas.length - 1) estado.atual += 1;
          render(frame, estado);
        },
      };
    },
  });
}

function desinstalarIframeFalso(): void {
  const proto = HTMLIFrameElement.prototype;
  for (const nome of ['src', 'contentDocument', 'contentWindow']) {
    delete (proto as unknown as Record<string, unknown>)[nome];
  }
  for (const d of originais) {
    Object.defineProperty(proto, (d as { __nome: string }).__nome, d);
  }
  originais.length = 0;
}

const MENU = `
  <div id="nav-profile"><span>FULANO DE TAL (x0000000)</span></div>
  <select id="selInfraUnidades">
    <option value="a1" title="Vara Única da Comarca de Capinópolis - CNS V.UNICA/ESTAGIÁRIO">CNS V.UNICA/ESTAGIÁRIO</option>
    <option value="e5" selected title="2ª Vara de Família e Sucessões da Comarca de Uberlândia - ULA 2ª V.FAM.SUC/GERENTE DE SECRETARIA">ULA 2ª V.FAM.SUC/GERENTE DE SECRETARIA</option>
  </select>
  <a href="controlador.php?acao=localizador_orgao_listar&hash=abc">Localizadores do Órgão</a>
  <a aria-label="Lista de Processos por Localizador" href="controlador.php?acao=localizador_processos_lista&hash=def">Lista</a>
  <a href="controlador.php?acao=modelo_padrao_listar&hash=ghi">Modelos Padrão</a>
  <a href="controlador.php?acao=texto_padrao_listar&hash=jkl">Textos Padrão</a>
  <a href="controlador.php?acao=localizador_acao_preferencial_listar&hash=mno">Ações Preferenciais</a>
  <a href="controlador.php?acao=relatorio_geral_listar&hash=pqr">Relatório Geral</a>
`;

/**
 * Página 2 de modelos: mesma estrutura, códigos todos distintos.
 *
 * Cada código precisa ser único, senão a deduplicação por código (que é o
 * comportamento certo) apaga linhas e o teste mede a coisa errada. Só a célula
 * de código é puramente numérica — as datas têm barras e não casam.
 */
let proximoCodigo = 90000;
/** Esta tela não pagina: sem rodapé de "N registros", o laço não deve rodar. */
const PAGINA_ACOES = `<html><body>${ACOES}</body></html>`;

const PAGINA_MODELOS_2 = `<html><body>${MODELOS.replace(
  />(\d{4,6})</g,
  () => `>${(proximoCodigo += 1)}<`,
)}<p>8 registros</p></body></html>`;

describe('coletor do Eproc', () => {
  beforeEach(() => {
    document.body.innerHTML = MENU;
    instalarIframeFalso();
    paginasPorTela = {
      modelo_padrao_listar: [
        `<html><body>${MODELOS}<p>8 registros</p></body></html>`,
        PAGINA_MODELOS_2,
      ],
      texto_padrao_listar: [PAGINA_TEXTOS],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn((entrada: string, init?: RequestInit) => {
        const url = String(entrada);
        const daLista = rotaLista(url, init);
        if (daLista) return daLista;
        if (url.includes('localizador_orgao_listar')) return Promise.resolve(resposta(PAGINA_ORGAO));
        if (url.includes('localizador_processos_lista')) return Promise.resolve(resposta(PAGINA_SELECT));
        if (url.includes('localizador_acao_preferencial_listar')) {
          return Promise.resolve(resposta(PAGINA_ACOES));
        }
        if (url.includes('modelo_padrao_listar')) return Promise.resolve(resposta(PAGINA_MODELOS));
        if (url.includes('texto_padrao_listar')) return Promise.resolve(resposta(PAGINA_TEXTOS));
        return Promise.resolve(resposta('<html><body>tela desconhecida</body></html>'));
      }),
    );
  });

  afterEach(() => {
    desinstalarIframeFalso();
  });

  it('sobrevive à re-avaliação em escopo isolado (não referencia nada do módulo)', async () => {
    const isolada = reavaliarIsolada(coletarUnidadeNaAba);
    // Se o coletor tocar qualquer identificador do escopo de módulo, isto
    // rejeita com ReferenceError e o teste falha aqui.
    const coleta = await isolada();
    expect(coleta.erro).toBeUndefined();
    expect(coleta.fontes.localizadoresOrgao?.status).toBe('ok');
    expect(coleta.fontes.catalogoSelect?.status).toBe('ok');
  });

  it('lê o escopo e recorta os fragmentos das duas fontes', async () => {
    const coleta: ColetaUnidade = await coletarUnidadeNaAba();

    expect(coleta.escopo?.unidadeTexto).toBe('ULA 2ª V.FAM.SUC/GERENTE DE SECRETARIA');
    expect(coleta.escopo?.perfilTexto).toContain('x0000000');
    expect(coleta.fontes.localizadoresOrgao?.fragmentos).toHaveLength(1);
    expect(coleta.fontes.localizadoresOrgao?.totalAnunciado).toBe(7);
    // O recorte tem de ser a tabela, não a página inteira.
    expect(coleta.fontes.localizadoresOrgao?.fragmentos[0]).toMatch(/^<table/);
  });

  it('decodifica latin-1: acentos chegam íntegros do outro lado', async () => {
    const coleta = await coletarUnidadeNaAba();
    expect(coleta.fontes.localizadoresOrgao?.fragmentos[0]).toContain('Descrição');
  });

  it('reporta a falta do menu sem lançar', async () => {
    document.body.innerHTML = '<p>Link sem assinatura.</p>';
    const coleta = await coletarUnidadeNaAba();
    expect(coleta.erro).toContain('menu do Eproc');
  });

  it('produz uma coleta que o lado da página consegue aplicar ponta a ponta', async () => {
    const coleta = await coletarUnidadeNaAba();
    const r = aplicarColeta(coleta, '2026-08-27T00:00:00.000Z');

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // 7 linhas na fixture, 2 delas de sistema — todas entram, marcadas (D-23).
    expect(r.resumo.localizadores).toBe(7);
    expect(r.resumo.sistema).toBe(2);
    // 7, não 5: o `<select>` da fixture também lista os dois de sistema, então
    // eles chegam ao catálogo com o id do Eproc como qualquer outro.
    expect(r.resumo.comId).toBe(7);
    expect(r.catalogo.unidade.chave).toContain('::x0000000::ULA 2ª V.FAM.SUC');
    expect(r.catalogo.localizadores[0]?.eprocId).toBe('11772027734669582002217986416');
    expect(r.resumo.textosPadrao).toBe(3);
    // 4 modelos por página × 2 páginas: prova que o laço do iframe avançou.
    expect(r.resumo.modelos).toBe(8);
    // 3 + 2 + 3 linhas, menos a repetida e a individual.
    expect(r.resumo.preferencias).toBe(6);
    expect(r.catalogo.preferencias?.[0]).toMatchObject({
      nome: '🔵 GAB - Despachar',
      detalhe: 'Minuta',
      grupo: 'Preferências de Gabinete',
    });
    expect(r.catalogo.preferencias?.find((p) => p.nome === 'Dar Andamento')?.detalhe).toBe('Movimentação');
    expect(r.catalogo.preferencias?.find((p) => p.nome === 'Intimar Exequente')?.detalhe).toBe('Intimação');
    expect(r.catalogo.preferencias?.some((p) => p.nome === 'Minha pessoal')).toBe(false);
    // As consultas saem da mesma lista, com a tela e o grupo.
    expect(r.catalogo.consultasSalvas).toEqual([
      expect.objectContaining({ tela: 'relatorioGeral', nome: 'Conclusos há 30 dias', grupo: 'Gerenciamento' }),
      expect.objectContaining({ tela: 'processosPorLocalizador', nome: 'Expedição', grupo: 'Secretaria' }),
    ]);
    // 3 linhas na fixture, uma sem vínculo nenhum.
    expect(r.resumo.acoesPreferenciais).toBe(2);
    expect(r.catalogo.acoesPreferenciais?.[0]?.preferencias).toHaveLength(4);
  });

  it('colhe as ações preferenciais por fetch, sem entrar no laço de paginação', async () => {
    const coleta = await coletarUnidadeNaAba();
    const fonte = coleta.fontes.acoesPreferenciais;
    expect(fonte?.status).toBe('ok');
    // A tela não anuncia total, então não há como (nem por que) paginar.
    expect(fonte?.fragmentos).toHaveLength(1);
    expect(fonte?.totalAnunciado).toBeUndefined();
  });

  it('pagina a grade pelo JS da página, não por fetch', async () => {
    const coleta = await coletarUnidadeNaAba();
    const modelos = coleta.fontes.modelos;
    expect(modelos?.status).toBe('ok');
    expect(modelos?.fragmentos).toHaveLength(2);
    expect(modelos?.totalAnunciado).toBe(8);
    // Textos padrão cabem numa página só: o laço não pode inventar uma segunda.
    expect(coleta.fontes.textosPadrao?.fragmentos).toHaveLength(1);
    expect(coleta.fontes.preferencias).toMatchObject({ status: 'ok' });
  });

  it('grava os localizadores mesmo quando as listas acessórias falham', async () => {
    // Sem os links de modelos e textos no menu, as duas fontes viram
    // `semPermissao` — e a coleta principal tem de continuar valendo. É a
    // assimetria deliberada: sem localizadores o catálogo não serve, sem
    // modelos ele ainda serve.
    document.body.innerHTML = MENU.replace(/<a href="[^"]*_padrao_listar[^"]*">[^<]*<\/a>/g, '');
    const r = aplicarColeta(await coletarUnidadeNaAba());

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.resumo.localizadores).toBe(7);
    expect(r.resumo.modelos).toBe(0);
    expect(r.catalogo.fontes.modelos?.status).toBe('semPermissao');
  });
});

describe('coletor do Eproc — lista de preferências recusada (D-35/D-37)', () => {
  /** Igual ao fetch padrão, com a mesma resposta da lista para todo tipo. */
  function stubLista(corpo: string): void {
    const todas = Object.fromEntries(Object.keys(LISTAS).map((k) => [k, corpo]));
    vi.stubGlobal(
      'fetch',
      vi.fn((entrada: string, init?: RequestInit) => {
        const url = String(entrada);
        const daLista = rotaLista(url, init, todas);
        if (daLista) return daLista;
        if (url.includes('localizador_orgao_listar')) return Promise.resolve(resposta(PAGINA_ORGAO));
        if (url.includes('localizador_processos_lista')) return Promise.resolve(resposta(PAGINA_SELECT));
        if (url.includes('localizador_acao_preferencial_listar')) {
          return Promise.resolve(resposta(PAGINA_ACOES));
        }
        if (url.includes('modelo_padrao_listar')) return Promise.resolve(resposta(PAGINA_MODELOS));
        if (url.includes('texto_padrao_listar')) return Promise.resolve(resposta(PAGINA_TEXTOS));
        return Promise.resolve(resposta('<html><body>tela desconhecida</body></html>'));
      }),
    );
  }

  beforeEach(() => {
    document.body.innerHTML = MENU;
    instalarIframeFalso();
    paginasPorTela = { modelo_padrao_listar: [PAGINA_MODELOS], texto_padrao_listar: [PAGINA_TEXTOS] };
  });

  afterEach(() => {
    desinstalarIframeFalso();
  });

  it('página de erro no lugar do JSON é falha, não "nenhuma cadastrada"', async () => {
    stubLista('<!DOCTYPE html><html><body>Acesso negado</body></html>');
    const coleta = await coletarUnidadeNaAba();
    expect(coleta.fontes.preferencias?.status).toBe('falhou');
    expect(coleta.fontes.preferencias?.motivo).toContain('recusou a lista');
  });

  it('lista sem linhas continua sendo "vazio"', async () => {
    stubLista(lista());
    const coleta = await coletarUnidadeNaAba();
    expect(coleta.fontes.preferencias?.status).toBe('vazio');
  });

  it('na falha, mantém as da última sincronização e soma as das ações preferenciais', async () => {
    stubLista('<html>erro</html>');
    const coleta = await coletarUnidadeNaAba();

    const semAnterior = aplicarColeta(coleta, '2026-10-04T00:00:00.000Z');
    if (!semAnterior.ok) throw new Error(semAnterior.erro);
    const dosVinculos = semAnterior.catalogo.preferencias ?? [];
    expect(dosVinculos.length).toBeGreaterThan(0);
    expect(dosVinculos.every((p) => p.detalhe === undefined)).toBe(true);
    expect(semAnterior.catalogo.fontes.preferencias?.status).toBe('falhou');
    expect(semAnterior.catalogo.fontes.preferencias?.motivo).toContain('ações preferenciais');

    const anterior = {
      ...semAnterior.catalogo,
      preferencias: [{ nome: 'Antiga só no catálogo', detalhe: 'Minuta' }],
    };
    const comAnterior = aplicarColeta(coleta, '2026-10-04T00:00:00.000Z', anterior);
    if (!comAnterior.ok) throw new Error(comAnterior.erro);
    expect(comAnterior.catalogo.preferencias?.[0]).toEqual({
      nome: 'Antiga só no catálogo',
      detalhe: 'Minuta',
    });
    expect(comAnterior.resumo.preferencias).toBe(dosVinculos.length + 1);
    expect(comAnterior.catalogo.fontes.preferencias?.motivo).toContain(
      '1 mantidas da última sincronização',
    );

    // Catálogo de outra unidade não empresta nada.
    const deOutra = {
      ...anterior,
      unidade: { ...anterior.unidade, chave: 'outro::host::VX' },
    };
    const r = aplicarColeta(coleta, '2026-10-04T00:00:00.000Z', deOutra);
    if (!r.ok) throw new Error(r.erro);
    expect(r.resumo.preferencias).toBe(dosVinculos.length);
  });
});

describe('coletor do Eproc — consultas salvas (D-32)', () => {
  const MENU_RELATORIOS = `
    <div id="nav-profile"><span>FULANO DE TAL (x0000000)</span></div>
    <select id="selInfraUnidades"><option selected title="Vara X - VX/GERENTE">VX/GERENTE</option></select>
    <a href="controlador.php?acao=localizador_orgao_listar&hash=abc">Localizadores do Órgão</a>
    <a aria-label="Lista de Processos por Localizador" href="controlador.php?acao=localizador_processos_lista&hash=def">Lista</a>
    <a href="controlador.php?acao=minuta_area_trabalho&hash=ghi">Área de Trabalho</a>
    <a href="controlador.php?acao=relatorio_geral_listar&hash=jkl">Relatório Geral</a>
  `;
  const HASH_LISTA = 'a'.repeat(32);
  const HASH_MINUTAS = 'b'.repeat(32);
  const tela = (hash: string) =>
    `<html><body><script>var u = "controlador_ajax.php?acao_ajax=preferencia_auto_completar&hash=${hash}";</script></body></html>`;
  const xml = (nome: string) => `<itens><item id="1|x" descricao="${nome}" complemento="N"/></itens>`;
  // A URL do Relatório Geral vem escapada dentro de um JSON, como no Eproc.
  const TELA_RG = `<html><body><script>UI.init({"url":"controlador.php?acao=ui_preferencias\/listar&acao_request=relatorio_geral_listar&hash=zzz"});</script></body></html>`;

  // Sem o botão da lista no Relatório Geral, o coletor cai no caminho de antes.
  it('na reserva, coleta as quatro telas com a tela de cada fragmento no rótulo', async () => {
    document.body.innerHTML = MENU_RELATORIOS;
    const chamadas: { url: string; metodo: string }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((entrada: string, init?: RequestInit) => {
        const url = String(entrada);
        chamadas.push({ url, metodo: init?.method ?? 'GET' });
        if (url.includes('acao_ajax=preferencia_auto_completar')) {
          if (url.includes(`nomeAcao=localizador_processos_lista&hash=${HASH_LISTA}`)) {
            return Promise.resolve(resposta(xml('Conclusos')));
          }
          if (url.includes(`nomeAcao=minuta_area_trabalho&hash=${HASH_MINUTAS}`)) {
            return Promise.resolve(resposta(xml('Minutas urgentes')));
          }
          return Promise.resolve(resposta('<html>erro</html>'));
        }
        if (url.includes('ui_preferencias/listar')) {
          return Promise.resolve(resposta(JSON.stringify([{ Descricao: 'Geral 1', IdFormularioPersonalizacao: '7', SinPreferenciaIndividual: 'N' }])));
        }
        if (url.includes('localizador_orgao_listar')) return Promise.resolve(resposta(PAGINA_ORGAO));
        if (url.includes('localizador_processos_lista')) return Promise.resolve(resposta(tela(HASH_LISTA)));
        if (url.includes('minuta_area_trabalho')) return Promise.resolve(resposta(tela(HASH_MINUTAS)));
        if (url.includes('relatorio_geral_listar')) return Promise.resolve(resposta(TELA_RG));
        return Promise.resolve(resposta('<html><body>tela desconhecida</body></html>'));
      }),
    );

    const coleta = await coletarUnidadeNaAba();
    expect(coleta.fontes.consultasSalvas).toMatchObject({
      status: 'ok',
      rotulos: ['processosPorLocalizador', 'areaMinutas', 'relatorioGeral'],
    });
    // A lista do Relatório Geral é um POST de busca vazia, com a barra desescapada.
    expect(chamadas.find((c) => c.url.includes('ui_preferencias/listar'))?.metodo).toBe('POST');

    const r = aplicarColeta(coleta, '2026-10-03T00:00:00.000Z');
    if (!r.ok) throw new Error(r.erro);
    expect(r.ok && r.catalogo.consultasSalvas?.map((c) => `${c.tela}:${c.nome}`)).toEqual([
      'processosPorLocalizador:Conclusos',
      'areaMinutas:Minutas urgentes',
      'relatorioGeral:Geral 1',
    ]);
    expect(r.ok && r.resumo.consultasSalvas).toBe(3);
  });

  it('sem nenhuma das telas no menu, a fonte é "sem permissão"', async () => {
    document.body.innerHTML = MENU_RELATORIOS.replace(/<a href="controlador\.php\?acao=(minuta_area_trabalho|relatorio_geral_listar)[^<]*<\/a>/g, '').replace(/<a aria-label[^<]*<\/a>/, '');
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(resposta('<html><body></body></html>'))));
    const coleta = await coletarUnidadeNaAba();
    expect(coleta.fontes.consultasSalvas?.status).toBe('semPermissao');
  });
});
