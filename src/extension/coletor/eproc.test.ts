import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ACOES from '@/infra/eproc/__fixtures__/localizadorAcaoPreferencialListar.html?raw';
import ORGAO from '@/infra/eproc/__fixtures__/localizadorOrgaoListar.html?raw';
import MODELOS from '@/infra/eproc/__fixtures__/modeloPadraoListar.html?raw';
import PREF_XML from '@/infra/eproc/__fixtures__/preferenciaAutoCompletar.xml?raw';
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
// O hash do autocompletar de preferências vem no HTML de qualquer tela de
// lista do painel — é daqui que o coletor o extrai.
const PAGINA_MODELOS = `<html><body>${MODELOS}<p>4 registros</p>
  <script>var u = "controlador_ajax.php?acao_ajax=preferencia_auto_completar&nomeAcao=minuta_cadastrar&hash=0123456789abcdef0123456789abcdef";</script>
  </body></html>`;
const PAGINA_TEXTOS = `<html><body>${TEXTOS}<p>3 registros</p></body></html>`;

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
      vi.fn((entrada: string) => {
        const url = String(entrada);
        if (url.includes('localizador_orgao_listar')) return Promise.resolve(resposta(PAGINA_ORGAO));
        if (url.includes('localizador_processos_lista')) return Promise.resolve(resposta(PAGINA_SELECT));
        if (url.includes('preferencia_auto_completar')) return Promise.resolve(resposta(PREF_XML));
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
    // 3 tipos de preferência, 5 itens úteis cada, deduplicados por nome.
    expect(r.resumo.preferencias).toBe(5);
    expect(r.catalogo.preferencias?.[0]?.detalhe).toBe('Minuta');
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
