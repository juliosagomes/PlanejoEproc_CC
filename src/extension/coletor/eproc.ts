import type { ColetaUnidade, FonteBruta } from '@/infra/eproc/tipos';

/* ============================================================================
 * COLETOR — roda DENTRO da aba do Eproc, injetado por
 * `chrome.scripting.executeScript({ func: coletarUnidadeNaAba })`.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ REGRA INEGOCIÁVEL: tudo vive DENTRO da função.                          │
 * │                                                                         │
 * │ O `executeScript` serializa a função com `Function.prototype.toString()` │
 * │ e a re-avalia na outra página. Nada do escopo de módulo existe lá:       │
 * │ qualquer helper no topo do arquivo, constante importada ou variável      │
 * │ externa vira `ReferenceError` **na aba do Eproc**, onde você não está    │
 * │ olhando. Só `import type` é permitido — a compilação o apaga.           │
 * │                                                                         │
 * │ Por `func` e não `files`: o Rollup emite ESM, e `files` exige script     │
 * │ clássico. Com `func` o formato do bundle deixa de importar.             │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * O que ele faz, e por que só isso: rede com o cookie da sessão e leitura do
 * DOM — as duas coisas que exigem estar dentro da página. Recorta os fragmentos
 * HTML e devolve. Parsear é trabalho do lado da página, onde há testes.
 * ========================================================================== */

export async function coletarUnidadeNaAba(): Promise<ColetaUnidade> {
  const MAX_PAGINAS = 40;
  const PAUSA_MS = 120;
  const TIMEOUT_FRAME_MS = 30000;

  /**
   * Uma requisição por tipo de preferência. O tipo não vem dentro do XML — só
   * existe na pergunta —, então viaja em `rotulos`, paralelo aos fragmentos.
   * Os rótulos são os do glossário (`PREF_TIPOS` do domínio).
   */
  const TIPOS_PREFERENCIA: ReadonlyArray<readonly [string, string]> = [
    ['minuta_cadastrar', 'Minuta'],
    ['processo_movimento_consultar', 'Movimentação'],
    ['processo_intimacao_bloco', 'Intimação'],
  ];

  const host = location.host;
  const fontes: ColetaUnidade['fontes'] = {};

  const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

  /** O Eproc serve ISO-8859-1 sem declarar; `res.text()` corrompe acento. */
  const lerHtml = async (res: Response): Promise<string> =>
    new TextDecoder('iso-8859-1').decode(await res.arrayBuffer());

  const parseDoc = (html: string): Document =>
    new DOMParser().parseFromString(html, 'text/html');

  /**
   * Base da instalação: `/eproc/`, `/eproc1g/`, `/eprocV2_prod_1grau/`… O
   * primeiro segmento do caminho é o discriminador entre as variantes.
   */
  const base = `${location.origin}/${location.pathname.split('/')[1] ?? 'eproc'}/`;

  /**
   * Nunca montar URL de ação: o `hash` das telas é de uso único e não há como
   * inventá-lo. Só seguir `<a href>` do menu, procurando também em parent/top
   * porque o Eproc usa frames.
   */
  const acharLink = (doc: Document, teste: (a: HTMLAnchorElement) => boolean) => {
    const docs: Document[] = [doc];
    for (const janela of [window.parent, window.top]) {
      try {
        if (janela && janela.document && !docs.includes(janela.document)) {
          docs.push(janela.document);
        }
      } catch {
        // frame de outra origem — ignorar
      }
    }
    for (const d of docs) {
      for (const a of Array.from(d.querySelectorAll('a[href]'))) {
        const anchor = a as HTMLAnchorElement;
        if (teste(anchor)) return anchor;
      }
    }
    return null;
  };

  const temMenu = (doc: Document): boolean =>
    !!acharLink(doc, (a) =>
      /[?&]acao=localizador_orgao_listar/.test(a.getAttribute('href') ?? ''),
    );

  /**
   * Documento com o menu completo. Se a aba estiver numa tela sem menu (ou numa
   * tela de erro), a raiz da instalação redireciona para o painel com `hash`
   * novo — é o único ponto de entrada estável que existe.
   */
  let docMenu: Document = document;
  if (!temMenu(docMenu)) {
    const res = await fetch(base, { credentials: 'same-origin' });
    docMenu = parseDoc(await lerHtml(res));
    if (!temMenu(docMenu)) {
      return {
        host,
        escopo: null,
        fontes,
        erro:
          'Não encontrei o menu do Eproc nesta aba. Confirme que você está logado ' +
          'e que a sessão não expirou, depois tente de novo.',
      };
    }
  }

  /* --- escopo: quem é o usuário e em qual unidade está --------------------- */

  const lerEscopo = (): ColetaUnidade['escopo'] => {
    for (const d of [document, docMenu]) {
      const sel = d.querySelector('#selInfraUnidades') as HTMLSelectElement | null;
      const perfil = d.querySelector('#nav-profile');
      if (!sel) continue;
      const opcoes = Array.from(sel.querySelectorAll('option'));
      const opcao =
        (sel.selectedIndex >= 0 ? opcoes[sel.selectedIndex] : null) ??
        opcoes.find((o) => o.hasAttribute('selected')) ??
        null;
      if (!opcao) continue;
      return {
        perfilTexto: perfil?.textContent ?? null,
        unidadeTexto: opcao.textContent,
        unidadeTitle: opcao.getAttribute('title'),
      };
    }
    return null;
  };

  /* --- coleta de uma grade paginada --------------------------------------- */

  const recortarTabela = (doc: Document): string | null => {
    const t = doc.querySelector('table.infraTable');
    return t ? t.outerHTML : null;
  };

  /** Linhas de dado: filhas diretas do tbody, fora as tabelas aninhadas. */
  const contarLinhas = (doc: Document): number => {
    const t = doc.querySelector('table.infraTable') as HTMLTableElement | null;
    if (!t) return 0;
    const corpo: Element = t.tBodies[0] ?? t;
    const trs = Array.from(corpo.children).filter((el) => el.tagName === 'TR');
    return Math.max(0, trs.length - 1);
  };

  /** O form de paginação não tem nome; acha-se pelos campos que ele carrega. */
  const formDePaginacao = (doc: Document): HTMLFormElement | null => {
    const campo = doc.querySelector(
      '[name="hdnInfraPaginaAtual"], #hdnInfraPaginaAtual',
    ) as HTMLInputElement | null;
    return campo?.form ?? null;
  };

  const coletarGrade = async (link: HTMLAnchorElement): Promise<FonteBruta> => {
    const primeira = await fetch(link.href, { credentials: 'same-origin' });
    if (!primeira.ok) {
      return { status: 'falhou', fragmentos: [], motivo: `HTTP ${primeira.status}` };
    }
    let html = await lerHtml(primeira);
    let doc = parseDoc(html);

    const fragmento = recortarTabela(doc);
    if (!fragmento) {
      return {
        status: 'semPermissao',
        fragmentos: [],
        motivo:
          'A tela abriu sem a grade esperada — provável desvio por falta de ' +
          'permissão do perfil, ou hash já usado.',
      };
    }

    const fragmentos = [fragmento];
    // Sobre o texto do documento, não sobre o HTML cru: no cru o casamento pega
    // a primeira ocorrência em qualquer lugar — comentário, atributo, script.
    const m = (doc.body?.textContent ?? '').match(/([\d.]+)\s*registros?/i);
    const total = m?.[1] ? Number(m[1].replace(/\./g, '')) : undefined;
    const totalAnunciado = Number.isFinite(total) ? total : undefined;

    let colhidos = contarLinhas(doc);
    let pagina = 1;

    while (
      totalAnunciado !== undefined &&
      colhidos < totalAnunciado &&
      pagina < MAX_PAGINAS
    ) {
      const form = formDePaginacao(doc);
      const action = form?.getAttribute('action');
      if (!form || !action) break;

      const corpo = new URLSearchParams();
      for (const el of Array.from(
        form.querySelectorAll('input,select,textarea'),
      ) as (HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement)[]) {
        if (!el.name) continue;
        if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
          if (el.checked) corpo.append(el.name, el.value);
          continue;
        }
        corpo.append(el.name, el.value);
      }
      corpo.set('hdnInfraPaginaAtual', String(pagina));

      await dormir(PAUSA_MS);
      const res = await fetch(new URL(action, base).toString(), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: corpo.toString(),
      });
      if (!res.ok) break;

      html = await lerHtml(res);
      doc = parseDoc(html);
      const proximo = recortarTabela(doc);
      const linhas = contarLinhas(doc);
      // Página vazia ou repetida: a paginação não avançou e insistir viraria
      // laço infinito contra o servidor do tribunal.
      if (!proximo || linhas === 0 || fragmentos.includes(proximo)) break;

      fragmentos.push(proximo);
      colhidos += linhas;
      pagina += 1;
    }

    return {
      status: 'ok',
      fragmentos,
      ...(totalAnunciado !== undefined ? { totalAnunciado } : {}),
    };
  };

  /**
   * Coleta de grade cujo paginador é JavaScript.
   *
   * Nas telas de Modelos Padrão e Textos Padrão **todos** os controles de página
   * são `javascript:infraAcaoPaginar('+',0,'Infra',null)`: não há URL para
   * seguir, o POST do form de filtro devolve página sem grade, e trocar a
   * quantidade por página não dispara requisição nenhuma (verificado com o
   * monitor de rede). A única forma de paginar é deixar o JS da página rodar —
   * daí o iframe. É o mesmo mecanismo do Epryx, e aqui ele é necessário mesmo.
   *
   * O `localizador_orgao_listar` NÃO passa por aqui: nele o POST do form pagina
   * de verdade, e fetch é mais barato e menos frágil.
   */
  async function coletarGradePorIframe(link: HTMLAnchorElement): Promise<FonteBruta> {
    const frame = document.createElement('iframe');
    frame.style.cssText =
      'position:absolute;width:1px;height:1px;left:-9999px;top:-9999px;border:0;';

    const esperarCarga = (): Promise<void> =>
      new Promise((resolve, reject) => {
        const relogio = setTimeout(() => {
          frame.removeEventListener('load', ok);
          reject(new Error('A tela do Eproc não terminou de carregar a tempo.'));
        }, TIMEOUT_FRAME_MS);
        const ok = () => {
          clearTimeout(relogio);
          resolve();
        };
        frame.addEventListener('load', ok, { once: true });
      });

    const tabela = (): string | null => {
      const t = frame.contentDocument?.querySelector('table.infraTable');
      return t ? t.outerHTML : null;
    };
    const linhas = (): number => {
      const t = frame.contentDocument?.querySelector('table.infraTable');
      if (!t) return 0;
      const corpo: Element = (t as HTMLTableElement).tBodies[0] ?? t;
      return Math.max(
        0,
        Array.from(corpo.children).filter((el) => el.tagName === 'TR').length - 1,
      );
    };

    document.body.appendChild(frame);
    try {
      const carga = esperarCarga();
      frame.src = link.href;
      await carga;

      const primeiro = tabela();
      if (!primeiro) {
        return {
          status: 'semPermissao',
          fragmentos: [],
          motivo:
            'A tela abriu sem a grade esperada — provável desvio por falta de ' +
            'permissão do perfil.',
        };
      }

      const texto = frame.contentDocument?.body?.textContent ?? '';
      const m = texto.match(/([\d.]+)\s*registros?/i);
      const bruto = m?.[1] ? Number(m[1].replace(/\./g, '')) : NaN;
      const totalAnunciado = Number.isFinite(bruto) ? bruto : undefined;

      const fragmentos = [primeiro];
      let colhidos = linhas();
      let pagina = 1;
      let incompleto: string | undefined;

      while (
        totalAnunciado !== undefined &&
        colhidos < totalAnunciado &&
        pagina < MAX_PAGINAS
      ) {
        // A cada navegação o documento anterior morre: reler do frame, nunca
        // guardar referência de uma volta para a seguinte.
        const janela = frame.contentWindow as (Window & {
          infraAcaoPaginar?: (t: string, p: number, s: string, c: unknown) => void;
        }) | null;
        if (typeof janela?.infraAcaoPaginar !== 'function') {
          // Sintoma clássico de estar rodando no mundo isolado, que não vê
          // funções da página. Dizer isso é melhor que devolver a primeira
          // página como se fosse o total.
          incompleto =
            'Não alcancei o paginador da tela; vieram só os ' +
            `${colhidos} primeiros de ${totalAnunciado}.`;
          break;
        }

        await dormir(PAUSA_MS);
        const carga2 = esperarCarga();
        janela.infraAcaoPaginar('+', 0, 'Infra', null);
        await carga2;

        const proximo = tabela();
        const n = linhas();
        // Página vazia ou repetida significa que a paginação não avançou;
        // insistir viraria laço contra o servidor do tribunal.
        if (!proximo || n === 0 || fragmentos.includes(proximo)) {
          incompleto =
            `A paginação não avançou depois de ${colhidos} de ${totalAnunciado}.`;
          break;
        }

        fragmentos.push(proximo);
        colhidos += n;
        pagina += 1;
      }

      return {
        status: 'ok',
        fragmentos,
        ...(totalAnunciado !== undefined ? { totalAnunciado } : {}),
        ...(incompleto ? { motivo: incompleto } : {}),
      };
    } finally {
      // Essencial, não higiene: deixar o frame terminando de renderizar rouba
      // recursos da aba que o usuário está usando.
      try {
        frame.contentWindow?.stop();
      } catch {
        // frame já descartado
      }
      frame.remove();
    }
  }

  /* --- fonte 1: o <select> com os ids ------------------------------------- */

  try {
    const link = acharLink(
      docMenu,
      (a) => a.getAttribute('aria-label') === 'Lista de Processos por Localizador',
    );
    if (!link) {
      fontes.catalogoSelect = {
        status: 'semPermissao',
        fragmentos: [],
        motivo: 'Link "Lista de Processos por Localizador" ausente no menu.',
      };
    } else {
      const res = await fetch(link.href, { credentials: 'same-origin' });
      const doc = parseDoc(await lerHtml(res));
      const sel = doc.querySelector('#selLocalizador');
      fontes.catalogoSelect = sel
        ? { status: 'ok', fragmentos: [sel.outerHTML] }
        : { status: 'vazio', fragmentos: [], motivo: 'Tela sem #selLocalizador.' };
    }
  } catch (err) {
    fontes.catalogoSelect = {
      status: 'falhou',
      fragmentos: [],
      motivo: err instanceof Error ? err.message : String(err),
    };
  }

  /* --- fonte 2: a listagem do órgão (a principal) ------------------------- */

  try {
    const link = acharLink(docMenu, (a) =>
      /[?&]acao=localizador_orgao_listar/.test(a.getAttribute('href') ?? ''),
    );
    fontes.localizadoresOrgao = link
      ? await coletarGrade(link)
      : {
          status: 'semPermissao',
          fragmentos: [],
          motivo: 'Ação "Localizadores do Órgão" ausente no menu deste perfil.',
        };
  } catch (err) {
    fontes.localizadoresOrgao = {
      status: 'falhou',
      fragmentos: [],
      motivo: err instanceof Error ? err.message : String(err),
    };
  }

  /* --- fontes 3 e 4: modelos e textos padrão, por iframe ------------------ */

  for (const [fonte, acao, rotulo] of [
    ['modelos', 'modelo_padrao_listar', 'Modelos Padrão'],
    ['textosPadrao', 'texto_padrao_listar', 'Textos Padrão'],
  ] as const) {
    try {
      const link = acharLink(docMenu, (a) =>
        new RegExp(`[?&]acao=${acao}(&|$|")`).test(a.getAttribute('href') ?? ''),
      );
      fontes[fonte] = link
        ? await coletarGradePorIframe(link)
        : {
            status: 'semPermissao',
            fragmentos: [],
            motivo: `Ação "${rotulo}" ausente no menu deste perfil.`,
          };
    } catch (err) {
      fontes[fonte] = {
        status: 'falhou',
        fragmentos: [],
        motivo: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /* --- fonte 5: preferências, pelo autocomplete --------------------------- */

  try {
    // O `hash` do autocomplete não se inventa: é lido do HTML de uma tela que o
    // carregue. Qualquer tela de lista do painel serve — medido em Modelos
    // Padrão, Textos Padrão e Área de Trabalho de Minutas. Reaproveita-se o que
    // as fontes anteriores já buscaram para não gastar mais uma volta.
    const linkTela = acharLink(docMenu, (a) =>
      /[?&]acao=(modelo_padrao_listar|minuta_area_trabalho)(&|$|")/.test(
        a.getAttribute('href') ?? '',
      ),
    );
    const htmlTela = linkTela
      ? await lerHtml(await fetch(linkTela.href, { credentials: 'same-origin' }))
      : '';
    const hash = htmlTela.match(
      /acao_ajax=preferencia_auto_completar[^"'<>]*?hash=([a-f0-9]{32})/i,
    )?.[1];

    if (!hash) {
      fontes.preferencias = {
        status: 'semPermissao',
        fragmentos: [],
        motivo:
          'Não achei a chave do autocompletar de preferências nas telas deste perfil.',
      };
    } else {
      const fragmentos: string[] = [];
      const rotulos: string[] = [];
      for (const [nomeAcao, rotulo] of TIPOS_PREFERENCIA) {
        await dormir(PAUSA_MS);
        const res = await fetch(
          `${base}controlador_ajax.php?acao_ajax=preferencia_auto_completar` +
            `&nomeAcao=${nomeAcao}&hash=${hash}`,
          { credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } },
        );
        if (!res.ok) continue;
        const xml = await lerHtml(res);
        if (!xml.includes('<item')) continue;
        fragmentos.push(xml);
        rotulos.push(rotulo);
      }

      fontes.preferencias =
        fragmentos.length > 0
          ? { status: 'ok', fragmentos, rotulos }
          : {
              status: 'vazio',
              fragmentos: [],
              motivo: 'Nenhuma preferência cadastrada nos três tipos.',
            };
    }
  } catch (err) {
    fontes.preferencias = {
      status: 'falhou',
      fragmentos: [],
      motivo: err instanceof Error ? err.message : String(err),
    };
  }

  return { host, escopo: lerEscopo(), fontes };
}
