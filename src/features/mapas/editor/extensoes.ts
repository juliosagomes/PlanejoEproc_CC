import { Extension, Mark, Node, mergeAttributes, type AnyExtension } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import StarterKit from '@tiptap/starter-kit';
import type { BlocoFluxo } from '@/domain';
import { htmlFigura } from '../gerar';
import { sanitizarSvgFluxo } from '../sanitizar';

/* ============================================================================
 * O DOCUMENTO COMO ESQUEMA (decisoes.md#D-39)
 *
 * O editor do retrato é o TipTap (ProseMirror). Cada peça que o mapa usa além
 * do texto comum é um tipo do esquema, e por isso entra no desfazer, sobrevive
 * à colagem e não pode ser quebrada pela metade pelo cursor:
 *
 *  - `mencao`: o @, um átomo em linha que guarda só a referência (RefMencao);
 *  - `numeroTransicao`: o ① da legenda, que casa com o número no desenho;
 *  - `caixa`: o quadradinho para marcar à caneta;
 *  - `tipoTransicao`: a marca "ATP / PREFERÊNCIA / MANUAL";
 *  - `detalheMencao`: o bloco que "Inserir detalhes" cria, editável;
 *  - `figuraFluxo`: o desenho do plano, um átomo em bloco com o SVG gravado.
 *
 * O formato gravado continua HTML, o mesmo que o gerador produz e a impressão
 * lê. Estas definições não importam React: o `NodeView` da figura é posto pelo
 * componente do editor.
 * ========================================================================== */

export const Mencao = Node.create({
  name: 'mencao',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    const dado = (nome: string) => ({
      default: null,
      parseHTML: (el: HTMLElement) => el.getAttribute(`data-${nome}`),
      renderHTML: (a: Record<string, unknown>) => {
        const chave = nome.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
        return a[chave] ? { [`data-${nome}`]: a[chave] } : {};
      },
    });
    return {
      tipo: dado('tipo'),
      chave: dado('chave'),
      rotulo: { ...dado('rotulo'), parseHTML: (el: HTMLElement) => el.getAttribute('data-rotulo') ?? el.textContent },
      eprocId: dado('eproc-id'),
      no: dado('no'),
      // Calculado contra o catálogo a cada abertura; o HTML só o carrega como classe.
      sumiu: {
        default: false,
        parseHTML: (el: HTMLElement) => el.classList.contains('sumiu'),
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span.mencao[data-tipo]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: `mencao m-${String(node.attrs.tipo)}${node.attrs.sumiu ? ' sumiu' : ''}`,
        contenteditable: 'false',
      }),
      String(node.attrs.rotulo ?? ''),
    ];
  },

  renderText({ node }) {
    return String(node.attrs.rotulo ?? '');
  },
});

const TIPOS_ARESTA = ['atp', 'pref', 'manual'];
const tipoDaClasse = (el: HTMLElement) => [...el.classList].find((c) => TIPOS_ARESTA.includes(c)) ?? 'manual';

export const NumeroTransicao = Node.create({
  name: 'numeroTransicao',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      tipo: { default: 'manual', parseHTML: tipoDaClasse, renderHTML: () => ({}) },
      valor: { default: '', parseHTML: (el: HTMLElement) => el.textContent ?? '', renderHTML: () => ({}) },
    };
  },

  parseHTML() {
    return [{ tag: 'span.n' }];
  },

  renderHTML({ node }) {
    return ['span', { class: `n ${String(node.attrs.tipo)}` }, String(node.attrs.valor)];
  },
});

export const Caixa = Node.create({
  name: 'caixa',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      feita: { default: false, parseHTML: (el: HTMLElement) => el.classList.contains('feita'), renderHTML: () => ({}) },
    };
  },

  parseHTML() {
    return [{ tag: 'span.caixa' }];
  },

  renderHTML({ node }) {
    return ['span', { class: `caixa${node.attrs.feita ? ' feita' : ''}` }];
  },
});

export const TipoTransicao = Mark.create({
  name: 'tipoTransicao',

  addAttributes() {
    return { tipo: { default: 'manual', parseHTML: tipoDaClasse, renderHTML: () => ({}) } };
  },

  parseHTML() {
    return [{ tag: 'span.tipo-p' }];
  },

  renderHTML({ mark }) {
    return ['span', { class: `tipo-p ${String(mark.attrs.tipo)}` }, 0];
  },
});

/** Classes de parágrafo que o mapa usa: subtítulo, detalhe da regra, título do detalhe. */
const CLASSES_PARAGRAFO = ['sub', 'regra-mini', 'dm-tit'];

export const ClasseParagrafo = Extension.create({
  name: 'classeParagrafo',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          classe: {
            default: null,
            parseHTML: (el: HTMLElement) => [...el.classList].find((c) => CLASSES_PARAGRAFO.includes(c)) ?? null,
            renderHTML: (a: Record<string, unknown>) => (a.classe ? { class: a.classe } : {}),
          },
        },
      },
    ];
  },
});

export const DetalheMencao = Node.create({
  name: 'detalheMencao',
  group: 'block',
  content: 'paragraph+',
  defining: true,

  parseHTML() {
    return [{ tag: 'div.detalhe-mencao' }];
  },

  renderHTML() {
    return ['div', { class: 'detalhe-mencao' }, 0];
  },
});

/** Os metadados do bloco, sem o SVG — o que vai no `data-fluxo`. */
export function blocoDosAtributos(attrs: Record<string, unknown>): BlocoFluxo | null {
  try {
    const meta = JSON.parse(String(attrs.meta ?? '')) as Omit<BlocoFluxo, 'svg'>;
    if (typeof meta.planoId !== 'string' || !Array.isArray(meta.nos)) return null;
    return { ...meta, svg: String(attrs.svg ?? '') };
  } catch {
    return null;
  }
}

export function atributosDoBloco(bloco: BlocoFluxo): { meta: string; svg: string } {
  const { svg, ...meta } = bloco;
  return { meta: JSON.stringify(meta), svg };
}

export const FiguraFluxo = Node.create({
  name: 'figuraFluxo',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return { meta: { default: '{}' }, svg: { default: '' } };
  },

  parseHTML() {
    return [
      {
        tag: 'figure.fluxo-bloco',
        getAttrs: (el: HTMLElement) => ({
          meta: el.getAttribute('data-fluxo') ?? '{}',
          svg: el.querySelector('.fluxo-svg')?.innerHTML ?? '',
        }),
      },
    ];
  },

  // A figura é montada pelo mesmo `htmlFigura` do gerador; o SVG passa pelo crivo.
  renderHTML({ node }) {
    const bloco = blocoDosAtributos(node.attrs);
    const tpl = document.createElement('template');
    tpl.innerHTML = bloco ? htmlFigura({ ...bloco, svg: sanitizarSvgFluxo(bloco.svg) }) : '<figure class="fluxo-bloco"></figure>';
    return tpl.content.firstElementChild as HTMLElement;
  },
});

/**
 * Só imagem embutida (`data:`): o app é offline, e uma imagem colada de um site
 * faria o editor buscar na rede. A largura vai como `style="width:N%"`, o único
 * estilo que a sanitização aceita.
 */
export const ImagemMapa = Image.extend({
  parseHTML() {
    return [{ tag: 'img[src^="data:image/"]' }];
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      largura: {
        default: '60%',
        parseHTML: (el: HTMLElement) => el.style.width || '60%',
        renderHTML: (a: Record<string, unknown>) => ({ style: `width:${String(a.largura)}` }),
      },
    };
  },
}).configure({ allowBase64: true });

/** Tudo o que o documento entende, sem as peças de tela (sugestão, NodeView). */
export function extensoesDoDocumento(): AnyExtension[] {
  return [
    StarterKit.configure({
      link: false,
      code: false,
      codeBlock: false,
      blockquote: false,
      horizontalRule: false,
      strike: false,
    }),
    TableKit.configure({ table: { HTMLAttributes: { class: 'leg' }, resizable: false } }),
    ImagemMapa,
    Mencao,
    NumeroTransicao,
    Caixa,
    TipoTransicao,
    ClasseParagrafo,
    DetalheMencao,
    FiguraFluxo,
  ];
}
