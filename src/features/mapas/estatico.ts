import type { ElementoSlide, Mapa, Slide } from '@/domain';
import { esc } from './html';
import { atualizarMencoes, type CatalogoMencoes } from './mencoes';
import { sanitizarHtml, sanitizarSvgFluxo } from './sanitizar';

/**
 * O mapa como HTML só de leitura — miniaturas dos slides e impressão. O editor
 * desenha com React; aqui é string, para servir também fora da árvore React
 * (a impressão monta as folhas direto no `<body>`).
 */

function htmlElemento(e: ElementoSlide): string {
  const caixa = `left:${e.x}px;top:${e.y}px;width:${e.w}px;height:${e.h}px`;
  let corpo: string;
  if (e.tipo === 'imagem') {
    corpo = e.src.startsWith('data:image/') ? `<img src="${esc(e.src)}" alt="">` : '';
  } else if (e.tipo === 'fluxo') {
    corpo = `<div class="fluxo-svg">${sanitizarSvgFluxo(e.fluxo.svg)}</div>`;
  } else {
    corpo = sanitizarHtml(e.html);
  }
  return `<div class="el el-${e.tipo}" style="${caixa}"><div class="el-conteudo">${corpo}</div></div>`;
}

export function htmlSlide(slide: Slide): string {
  return `<div class="slide papel">${slide.elementos.map(htmlElemento).join('')}</div>`;
}

/** As folhas do mapa, prontas para o `@page` de cada formato. */
export function folhasParaImpressao(mapa: Mapa, catalogo: CatalogoMencoes): HTMLElement {
  const raiz = document.createElement('div');
  raiz.id = 'impressao-mapa';
  if (mapa.formato === 'paisagem') {
    raiz.innerHTML = mapa.slides.map((s) => `<div class="folha-slide">${htmlSlide(s)}</div>`).join('');
  } else {
    raiz.innerHTML = `<div class="doc-impressa doc papel">${sanitizarHtml(mapa.html)}</div>`;
    raiz.querySelectorAll('[contenteditable]').forEach((el) => el.removeAttribute('contenteditable'));
  }
  atualizarMencoes(raiz, catalogo);
  return raiz;
}

/**
 * Imprime o mapa pelo diálogo do Chrome, de onde sai também o PDF. Sem
 * biblioteca: o texto continua selecionável, e não há `eval` escondido para a
 * CSP barrar (critério de pronto nº 7).
 */
export function imprimirMapa(mapa: Mapa, catalogo: CatalogoMencoes, comoPdf: boolean): void {
  const folhas = folhasParaImpressao(mapa, catalogo);
  document.body.appendChild(folhas);
  document.body.classList.add('imprimindo-mapa');
  const titulo = document.title;
  // O Chrome sugere o título da página como nome do PDF.
  if (comoPdf) document.title = `PlanejoEproc - ${mapa.nome} - ${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}`;
  const limpar = () => {
    document.body.classList.remove('imprimindo-mapa');
    folhas.remove();
    document.title = titulo;
    window.removeEventListener('afterprint', limpar);
  };
  window.addEventListener('afterprint', limpar);
  // As imagens das folhas precisam decodificar antes de o diálogo tirar a foto.
  const imagens = [...folhas.querySelectorAll('img')].map((img) => img.decode().catch(() => undefined));
  void Promise.all(imagens).then(() => window.print());
}
