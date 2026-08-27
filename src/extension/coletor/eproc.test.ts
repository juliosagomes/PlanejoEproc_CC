import { beforeEach, describe, expect, it, vi } from 'vitest';
import ORGAO from '@/infra/eproc/__fixtures__/localizadorOrgaoListar.html?raw';
import SELECT from '@/infra/eproc/__fixtures__/selLocalizador.html?raw';
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

/** O Eproc serve latin-1; o coletor decodifica como tal, então o falso também. */
function corpoLatin1(html: string): ArrayBuffer {
  const bytes = new Uint8Array(html.length);
  for (let i = 0; i < html.length; i += 1) bytes[i] = html.charCodeAt(i) & 0xff;
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

/** Menu do Painel do Diretor de Secretaria, reduzido aos dois links usados. */
const MENU = `
  <div id="nav-profile"><span>FULANO DE TAL (x0000000)</span></div>
  <select id="selInfraUnidades">
    <option value="a1" title="Vara Única da Comarca de Capinópolis - CNS V.UNICA/ESTAGIÁRIO">CNS V.UNICA/ESTAGIÁRIO</option>
    <option value="e5" selected title="2ª Vara de Família e Sucessões da Comarca de Uberlândia - ULA 2ª V.FAM.SUC/GERENTE DE SECRETARIA">ULA 2ª V.FAM.SUC/GERENTE DE SECRETARIA</option>
  </select>
  <a href="controlador.php?acao=localizador_orgao_listar&hash=abc">Localizadores do Órgão</a>
  <a aria-label="Lista de Processos por Localizador" href="controlador.php?acao=localizador_processos_lista&hash=def">Lista</a>
`;

describe('coletor do Eproc', () => {
  beforeEach(() => {
    document.body.innerHTML = MENU;
    vi.stubGlobal(
      'fetch',
      vi.fn((entrada: string) => {
        const url = String(entrada);
        if (url.includes('localizador_orgao_listar')) return Promise.resolve(resposta(PAGINA_ORGAO));
        if (url.includes('localizador_processos_lista')) return Promise.resolve(resposta(PAGINA_SELECT));
        return Promise.resolve(resposta('<html><body>tela desconhecida</body></html>'));
      }),
    );
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
    // 7 linhas na fixture, 2 de sistema filtradas (D-7).
    expect(r.resumo.localizadores).toBe(5);
    expect(r.resumo.ignoradosSistema).toBe(2);
    expect(r.resumo.comId).toBe(5);
    expect(r.catalogo.unidade.chave).toContain('::x0000000::ULA 2ª V.FAM.SUC');
    expect(r.catalogo.localizadores[0]?.eprocId).toBe('11772027734669582002217986416');
  });
});
