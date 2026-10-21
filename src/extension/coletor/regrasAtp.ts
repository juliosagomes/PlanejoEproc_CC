import type { ColetaRegrasAtp } from '@/infra/eproc/tipos';

/* ============================================================================
 * COLETOR DAS REGRAS DE ATP (decisoes.md#D-46) — roda DENTRO da aba do Eproc,
 * injetado como `coletarUnidadeNaAba`, e sob as mesmas regras: tudo vive
 * dentro da função, só `import type`, e não parseia.
 *
 * Só leitura. A listagem tem dois controles que **escrevem** no Eproc
 * (`acaoDesativar` e o checkbox `ativarDesativarRegra`): nenhum deles é
 * acionado, e o `montarDadosGatilho` é o mesmo POST de leitura que a tela
 * dispara ao abrir.
 *
 * `numeros`:
 *  - `[]`: só a listagem;
 *  - `'todas'`: listagem e o formulário de cada regra (minutos);
 *  - `[182]`: listagem e o formulário das regras pedidas.
 * ========================================================================== */

export async function coletarRegrasAtpNaAba(
  numeros: number[] | 'todas',
): Promise<ColetaRegrasAtp> {
  const vazia: ColetaRegrasAtp['lista'] = { status: 'falhou', fragmentos: [] };
  const detalhes: Record<string, string> = {};
  const falhas: Record<string, string> = {};
  const progresso = window as unknown as { __planejoProgressoAtp?: { feitas: number; total: number } };

  const lerHtml = async (res: Response): Promise<string> =>
    new TextDecoder('iso-8859-1').decode(await res.arrayBuffer());
  const parseDoc = (html: string): Document => new DOMParser().parseFromString(html, 'text/html');
  const base = `${location.origin}/${location.pathname.split('/')[1] ?? 'eproc'}/`;
  const ehLista = (a: Element) =>
    /[?&]acao=automatizar_localizadores(&|$)/.test(a.getAttribute('href') ?? '');

  /** O mesmo ponto de entrada da coleta da unidade: o menu, ou a raiz. */
  let docMenu: Document = document;
  let link = Array.from(docMenu.querySelectorAll('a[href]')).find(ehLista) as
    | HTMLAnchorElement
    | undefined;
  if (!link) {
    docMenu = parseDoc(await lerHtml(await fetch(base, { credentials: 'same-origin' })));
    link = Array.from(docMenu.querySelectorAll('a[href]')).find(ehLista) as
      | HTMLAnchorElement
      | undefined;
  }
  if (!link) {
    return {
      lista: {
        status: 'semPermissao',
        fragmentos: [],
        motivo: 'Ação "Automatizar Localizadores" ausente no menu deste perfil.',
      },
      detalhes,
      falhas,
    };
  }

  /**
   * Tira da cópia o que não é dado: opções não escolhidas (os selects de grupo
   * e de prioridade repetem a lista inteira em cada linha), scripts, tooltips
   * de histórico, que trazem matrícula, e o `hash` dos links.
   */
  const limpar = (raiz: Element): Element => {
    raiz.querySelectorAll('script, style, img').forEach((e) => e.remove());
    raiz.querySelectorAll('option').forEach((o) => {
      if (!o.hasAttribute('selected')) o.remove();
    });
    raiz.querySelectorAll('*').forEach((e) => {
      for (const a of Array.from(e.attributes)) {
        if (/^on/i.test(a.name) || a.name === 'title' || a.name === 'style') {
          e.removeAttribute(a.name);
        } else if (a.name === 'href') {
          e.setAttribute('href', a.value.replace(/[?&]hash=[^&]*/, ''));
        }
      }
    });
    return raiz;
  };

  /** Só os controles, com o valor; do `<select>` fica a opção escolhida. */
  const controles = (raiz: Element, id: string): string => {
    const doc = raiz.ownerDocument;
    const saida = doc.createElement('div');
    saida.id = id;
    for (const el of Array.from(raiz.querySelectorAll('select, input, textarea'))) {
      const idEl = el.id;
      const nome = el.getAttribute('name');
      const tipo = (el.getAttribute('type') ?? '').toLowerCase();
      if ((!idEl && !nome) || ['button', 'submit', 'image', 'reset', 'file'].includes(tipo)) continue;
      const copia = doc.createElement(el.tagName.toLowerCase());
      if (idEl) copia.id = idEl;
      if (nome) copia.setAttribute('name', nome);
      if (el.tagName === 'SELECT') {
        if ((el as HTMLSelectElement).multiple) copia.setAttribute('multiple', '');
        for (const o of Array.from(el.querySelectorAll('option'))) {
          if (!o.hasAttribute('selected')) continue;
          const op = doc.createElement('option');
          op.setAttribute('value', o.getAttribute('value') ?? '');
          op.setAttribute('selected', '');
          op.textContent = (o.textContent ?? '').trim();
          copia.appendChild(op);
        }
      } else if (el.tagName === 'TEXTAREA') {
        copia.textContent = el.textContent ?? '';
      } else {
        let valor = el.getAttribute('value') ?? '';
        if (/^valueOptions/.test(idEl)) {
          valor = (valor.match(/<option[^>]*\bselected\b[^>]*>[^<]*<\/option>/gi) ?? []).join('');
        }
        if (/hash=/.test(valor)) continue;
        if (tipo) copia.setAttribute('type', tipo);
        copia.setAttribute('value', valor);
        if (el.hasAttribute('checked')) copia.setAttribute('checked', '');
      }
      saida.appendChild(copia);
    }
    return saida.outerHTML;
  };

  /** O filtro "Evento/Tipo de Petição" só existe nos `append('…')` do script. */
  const appendsDeFiltro = (html: string): string => {
    const partes: string[] = [];
    const re = /divFiltroOpcionaisEscolhidos['"]\)\.append\('((?:[^'\\]|\\.)*)'\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      if (m[1]?.trim()) partes.push(m[1].replace(/\\(.)/g, '$1'));
    }
    return partes.join('\n');
  };

  const lerDetalhe = async (href: string): Promise<string> => {
    const html = await lerHtml(await fetch(href, { credentials: 'same-origin' }));
    const doc = parseDoc(html);
    const form = doc.getElementById('frmAssociaEventoLocalizador');
    if (!form) throw new Error('O formulário da regra não veio (sessão expirada?).');

    // O gatilho chega por XHR depois do load; a URL, com o hash dela, está no
    // script do próprio formulário.
    const script = Array.from(doc.scripts)
      .map((s) => s.textContent ?? '')
      .find((t) => t.includes('montarDadosGatilho'));
    const url = script?.match(/url:\s*'([^']*montarDadosGatilho[^']*)'/)?.[1];
    const tipo = form.querySelector('#selTipoControle option[selected]')?.getAttribute('value');
    const idRegra = (doc.getElementById('hdnIdControleLocalizadorSistema') as HTMLInputElement | null)
      ?.value;
    let gatilho = '';
    if (url && tipo && idRegra) {
      const res = await fetch(new URL(url, location.href).href, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: `codTipo=${encodeURIComponent(tipo)}&idRegra=${encodeURIComponent(idRegra)}`,
      });
      const json = (await res.json()) as { html?: string };
      gatilho = json.html ?? '';
    }

    const filtros = doc.createElement('div');
    filtros.innerHTML = appendsDeFiltro(html);
    const dadosGatilho = doc.createElement('div');
    dadosGatilho.innerHTML = gatilho;
    return (
      '<div id="regraAtpDetalhe">' +
      controles(form, 'formulario') +
      controles(filtros, 'filtrosEscolhidos') +
      controles(dadosGatilho, 'dadosGatilho') +
      '</div>'
    );
  };

  /* --- a listagem: uma página só ------------------------------------------ */

  let tabela: HTMLTableElement | null = null;
  try {
    const res = await fetch(link.href, { credentials: 'same-origin' });
    if (!res.ok) return { lista: { ...vazia, motivo: `HTTP ${res.status}` }, detalhes, falhas };
    tabela = parseDoc(await lerHtml(res)).querySelector<HTMLTableElement>(
      '#tableAutomatizacaoLocalizadores',
    );
  } catch (err) {
    return {
      lista: { ...vazia, motivo: err instanceof Error ? err.message : String(err) },
      detalhes,
      falhas,
    };
  }
  if (!tabela) {
    return {
      lista: { status: 'semPermissao', fragmentos: [], motivo: 'A tela não trouxe a tabela de regras.' },
      detalhes,
      falhas,
    };
  }

  /* --- o detalhe, regra a regra ------------------------------------------- */

  const linhas = Array.from(tabela.tBodies[0]?.rows ?? []);
  const alvos: { numero: number; href: string }[] = [];
  for (const tr of linhas) {
    const numero = Number(tr.querySelector('.colunaRegra span span')?.textContent?.match(/\d+/)?.[0]);
    if (!numero || (numeros !== 'todas' && !numeros.includes(numero))) continue;
    const a = Array.from(tr.querySelectorAll('a[href]')).find((x) => {
      const h = x.getAttribute('href') ?? '';
      return /acao=automatizar_localizadores_alterar/.test(h) && !/sin_duplicar_regra=S/.test(h);
    });
    if (a) alvos.push({ numero, href: new URL(a.getAttribute('href') ?? '', location.href).href });
    else falhas[numero] = 'A linha da regra não tem o link de edição.';
  }
  if (numeros !== 'todas') {
    for (const n of numeros) {
      if (!alvos.some((a) => a.numero === n) && !falhas[n]) falhas[n] = 'Regra não encontrada no Eproc.';
    }
  }

  progresso.__planejoProgressoAtp = { feitas: 0, total: alvos.length };
  for (const alvo of alvos) {
    try {
      detalhes[alvo.numero] = await lerDetalhe(alvo.href);
    } catch (err) {
      falhas[alvo.numero] = err instanceof Error ? err.message : String(err);
    }
    progresso.__planejoProgressoAtp = {
      feitas: (progresso.__planejoProgressoAtp?.feitas ?? 0) + 1,
      total: alvos.length,
    };
  }

  const recorte = limpar(tabela.cloneNode(true) as Element);
  return {
    lista: { status: linhas.length ? 'ok' : 'vazio', fragmentos: [recorte.outerHTML] },
    detalhes,
    falhas,
  };
}

/** Lido pela página, em paralelo, enquanto o detalhe completo corre. */
export function lerProgressoRegrasAtpNaAba(): { feitas: number; total: number } | null {
  return (
    (window as unknown as { __planejoProgressoAtp?: { feitas: number; total: number } })
      .__planejoProgressoAtp ?? null
  );
}
