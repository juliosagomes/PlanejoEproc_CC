import type { BlocoFluxo } from '@/domain';

/* ============================================================================
 * SANITIZAÇÃO DO DOCUMENTO (decisoes.md#D-39)
 *
 * O documento é HTML editado num `contenteditable`, gravado e reaberto com
 * `innerHTML`. A colagem já entra como texto puro, mas o HTML gravado pode vir
 * de outra aba, de uma versão antiga ou de um arquivo no futuro. Por isso toda
 * leitura passa por uma lista do que é permitido — o que o editor e o gerador
 * produzem —, e o resto é desembrulhado (fica o texto) ou removido.
 *
 * A CSP da extensão já bloqueia script inline; isto aqui é a segunda camada,
 * e o que garante que nada de fora (`src` remoto, `href`) chegue à página.
 * ========================================================================== */

const TAGS_HTML = new Set([
  'p', 'br', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'b', 'strong', 'i', 'em', 'u', 's', 'span', 'div',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'figure', 'figcaption', 'img', 'dl', 'dt', 'dd', 'small',
]);

/** Só dentro do desenho do fluxo, que é gerado pelo app. */
const TAGS_SVG = new Set(['svg', 'g', 'path', 'rect', 'circle', 'line', 'text', 'foreignobject']);

/** Removidos com o conteúdo: desembrulhar um `<script>` deixaria o código como texto. */
const REMOVER = new Set(['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'template', 'noscript', 'title']);

const ATRIBUTOS = new Set([
  'class', 'data-tipo', 'data-chave', 'data-rotulo', 'data-eproc-id', 'data-fluxo', 'colspan', 'rowspan',
]);

const ATRIBUTOS_SVG = new Set([
  'viewbox', 'preserveaspectratio', 'role', 'aria-label', 'aria-hidden', 'd', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
  'width', 'height', 'rx', 'cx', 'cy', 'r', 'fill', 'xmlns',
]);

const FILL_SEGURO = /^(none|#[0-9a-f]{3,8}|var\(--p-[a-z0-9-]+\))$/i;
const LARGURA_IMG = /^width:\s*\d{1,3}%;?$/;

function limparAtributos(el: Element, noSvg: boolean): void {
  for (const attr of [...el.attributes]) {
    const nome = attr.name.toLowerCase();
    const v = attr.value;
    const ok =
      ATRIBUTOS.has(nome) ||
      (nome === 'contenteditable' && v === 'false') ||
      (noSvg && ATRIBUTOS_SVG.has(nome) && (nome !== 'fill' || FILL_SEGURO.test(v))) ||
      (el.localName === 'img' && nome === 'src' && v.startsWith('data:image/')) ||
      (el.localName === 'img' && nome === 'style' && LARGURA_IMG.test(v.trim())) ||
      (el.localName === 'img' && nome === 'alt');
    if (!ok) el.removeAttribute(attr.name);
  }
}

function limpar(no: Node, noSvg: boolean): void {
  for (const filho of [...no.childNodes]) {
    if (filho.nodeType === Node.COMMENT_NODE) {
      filho.remove();
      continue;
    }
    if (filho.nodeType !== Node.ELEMENT_NODE) continue;
    const el = filho as Element;
    const tag = el.localName.toLowerCase();
    if (REMOVER.has(tag) || (tag === 'img' && !el.getAttribute('src')?.startsWith('data:image/'))) {
      el.remove();
      continue;
    }
    // O desenho só vale dentro da figura que o app gera; solto, sai inteiro.
    if (tag === 'svg' && !el.closest('figure.fluxo-bloco')) {
      el.remove();
      continue;
    }
    const dentroSvg = noSvg || tag === 'svg';
    const permitido = TAGS_HTML.has(tag) || (dentroSvg && TAGS_SVG.has(tag));
    if (!permitido) {
      limpar(el, dentroSvg);
      el.replaceWith(...el.childNodes);
      continue;
    }
    limparAtributos(el, dentroSvg);
    limpar(el, dentroSvg);
  }
}

export function sanitizarHtml(html: string): string {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  limpar(tpl.content, false);
  return tpl.innerHTML;
}

/** O desenho de um slide, que não mora numa `<figure>`: passa pelo mesmo crivo dentro de uma. */
export function sanitizarSvgFluxo(svg: string): string {
  const tpl = document.createElement('template');
  tpl.innerHTML = sanitizarHtml(`<figure class="fluxo-bloco">${svg}</figure>`);
  return tpl.content.firstElementChild?.innerHTML ?? '';
}

/** O bloco de fluxo guardado numa `<figure>` do documento. */
export function lerFigura(fig: Element): BlocoFluxo | null {
  try {
    const meta = JSON.parse(fig.getAttribute('data-fluxo') ?? '') as Omit<BlocoFluxo, 'svg'>;
    if (typeof meta.planoId !== 'string' || !Array.isArray(meta.nos)) return null;
    return { ...meta, svg: fig.querySelector('.fluxo-svg')?.innerHTML ?? '' };
  } catch {
    return null;
  }
}
