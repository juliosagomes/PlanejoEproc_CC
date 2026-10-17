import { useEffect, useMemo, useRef, useState } from 'react';
import { NodeSelection } from '@tiptap/pm/state';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import type { BlocoFluxo, MapaRetrato } from '@/domain';
import { atributosDoBloco, extensoesDoDocumento, FiguraFluxo } from '../editor/extensoes';
import { FiguraFluxoComVisao } from '../editor/FiguraFluxoView';
import { sincronizarMencoes } from '../editor/mencoesNoEditor';
import { useSugestaoMencao } from '../editor/useSugestaoMencao';
import { escolherImagem, prepararImagem } from '../imagem';
import { htmlDetalhe, lerRef, type CatalogoMencoes } from '../mencoes';
import { sanitizarHtml } from '../sanitizar';
import { useMapasStore } from '../store';
import type { AlvoNoFluxo } from '../verNoFluxo';
import { BarraMapa } from './BarraMapa';
import { DialogoInserirFluxo } from './DialogoInserirFluxo';
import { useCartaoMencao } from './useCartaoMencao';

/* ============================================================================
 * EDITOR DO MAPA EM RETRATO (decisoes.md#D-39)
 *
 * TipTap (ProseMirror). O documento tem esquema (`editor/extensoes.ts`): a
 * menção, o desenho e o bloco de detalhe são tipos próprios, e por isso tudo
 * entra no desfazer e a colagem do Word chega filtrada pelo esquema, com a
 * formatação que o mapa aceita. O que se grava continua HTML.
 * ========================================================================== */

const ESTILOS = [
  { valor: 'p', rotulo: 'Parágrafo' },
  { valor: '1', rotulo: 'Título 1' },
  { valor: '2', rotulo: 'Título 2' },
  { valor: '3', rotulo: 'Título 3' },
] as const;

interface Props {
  mapa: MapaRetrato;
  catalogo: CatalogoMencoes;
  somenteLeitura: boolean;
  onVerNoFluxo: (alvo: AlvoNoFluxo) => void;
}

function arquivoDeImagem(lista: FileList | undefined | null): File | undefined {
  return [...(lista ?? [])].find((f) => f.type.startsWith('image/'));
}

/** Insere uma imagem escolhida ou colada onde está o cursor. */
async function inserirImagem(editor: Editor, arquivo?: Blob): Promise<void> {
  try {
    const img = arquivo ? await prepararImagem(arquivo) : await escolherImagem();
    if (img) editor.chain().focus().insertContent({ type: 'image', attrs: { src: img.src, largura: '60%' } }).run();
  } catch (err) {
    window.alert((err as Error).message);
  }
}

export function EditorDocumento({ mapa, catalogo, somenteLeitura, onVerNoFluxo }: Props) {
  const mudar = useMapasStore((s) => s.mudar);
  const raizRef = useRef<HTMLDivElement>(null);
  const [inserindoFluxo, setInserindoFluxo] = useState(false);
  const [, setRolagem] = useState(0);
  const { extensao: sugestao, menu } = useSugestaoMencao(catalogo);

  const extensoes = useMemo(
    () => [...extensoesDoDocumento().filter((e) => e.name !== FiguraFluxo.name), FiguraFluxoComVisao, sugestao],
    [sugestao],
  );

  const editor = useEditor(
    {
      extensions: extensoes,
      content: sanitizarHtml(mapa.html),
      editable: !somenteLeitura,
      // A barra mostra o estado da seleção (negrito, tabela, imagem), então ela
      // precisa redesenhar a cada transação; o documento de um mapa é pequeno.
      shouldRerenderOnTransaction: true,
      editorProps: {
        attributes: { spellcheck: 'true', lang: 'pt-BR', 'aria-label': 'Documento do mapa' },
        handlePaste: (_view, event) => {
          const arquivo = arquivoDeImagem(event.clipboardData?.files);
          if (!arquivo || !editorRef.current) return false;
          void inserirImagem(editorRef.current, arquivo);
          return true;
        },
        handleDrop: (_view, event) => {
          const arquivo = arquivoDeImagem((event as DragEvent).dataTransfer?.files);
          if (!arquivo || !editorRef.current) return false;
          event.preventDefault();
          void inserirImagem(editorRef.current, arquivo);
          return true;
        },
      },
      onUpdate: ({ editor: e }) => {
        const html = e.getHTML();
        mudar((m) => (m.formato === 'retrato' ? { ...m, html } : m));
      },
    },
    [mapa.id],
  );
  const editorRef = useRef<Editor | null>(null);
  editorRef.current = editor;

  useEffect(() => {
    editor?.setEditable(!somenteLeitura);
  }, [editor, somenteLeitura]);

  // Sincronizou a unidade ou mexeu num plano: as menções acompanham.
  useEffect(() => {
    if (editor && !editor.isDestroyed) sincronizarMencoes(editor, catalogo);
  }, [editor, catalogo]);

  const cartao = useCartaoMencao(raizRef, catalogo, {
    podeEditar: !somenteLeitura,
    onVerNoFluxo,
    onInserirDetalhe: (chip) => {
      const ref = lerRef(chip);
      if (!editor || !ref) return;
      const $pos = editor.state.doc.resolve(editor.view.posAtDOM(chip, 0));
      // Logo depois do parágrafo da menção — ou do bloco de detalhe, se ela já estiver num.
      const profundidade = $pos.node($pos.depth - 1)?.type.name === 'detalheMencao' ? $pos.depth - 1 : $pos.depth;
      editor.chain().focus().insertContentAt($pos.after(profundidade), htmlDetalhe(ref, catalogo)).run();
    },
  });

  const imagemSelecionada =
    editor && editor.state.selection instanceof NodeSelection && editor.state.selection.node.type.name === 'image';
  const posImagem = (() => {
    if (!editor || !imagemSelecionada) return null;
    const el = editor.view.nodeDOM(editor.state.selection.from) as HTMLElement | null;
    const r = el?.getBoundingClientRect();
    return r ? { left: r.left, top: Math.max(8, r.top - 40) } : null;
  })();

  // A barra da tabela flutua sobre ela: na barra principal, faria tudo pular de linha.
  const posTabela = (() => {
    if (!editor || !editor.isActive('table')) return null;
    const { node } = editor.view.domAtPos(editor.state.selection.from);
    const tabela = (node instanceof Element ? node : node.parentElement)?.closest('table');
    const r = tabela?.getBoundingClientRect();
    return r ? { left: r.left, top: Math.max(8, r.top - 40) } : null;
  })();

  const estiloAtual = !editor
    ? 'p'
    : ([1, 2, 3] as const).find((n) => editor.isActive('heading', { level: n }))?.toString() ?? 'p';

  const botao = (rotulo: string, titulo: string, ativo: boolean, acao: () => void, classe = '') => (
    <button
      type="button"
      className={`btn btn-sm btn-icon btn-ghost${ativo ? ' ativo-formato' : ''}`}
      title={titulo}
      aria-label={titulo}
      aria-pressed={ativo}
      onMouseDown={(e) => e.preventDefault()}
      onClick={acao}
    >
      <span className={classe}>{rotulo}</span>
    </button>
  );

  const ferramentas = editor && (
    <>
      <select
        className="input mapa-estilo"
        aria-label="Estilo do parágrafo"
        value={estiloAtual}
        onChange={(e) => {
          const v = e.target.value;
          const c = editor.chain().focus();
          if (v === 'p') c.setParagraph().run();
          else c.setHeading({ level: Number(v) as 1 | 2 | 3 }).run();
        }}
      >
        {ESTILOS.map((s) => (
          <option key={s.valor} value={s.valor}>
            {s.rotulo}
          </option>
        ))}
      </select>
      {botao('N', 'Negrito (Ctrl+B)', editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), 'font-bold')}
      {botao('I', 'Itálico (Ctrl+I)', editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), 'italic')}
      {botao('S', 'Sublinhado (Ctrl+U)', editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), 'underline')}
      {botao('•', 'Lista com marcadores', editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run())}
      {botao('1.', 'Lista numerada', editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run())}
      {botao('↶', 'Desfazer (Ctrl+Z)', false, () => editor.chain().focus().undo().run())}
      {botao('↷', 'Refazer (Ctrl+Y)', false, () => editor.chain().focus().redo().run())}
      <span className="mapa-barra-sep" aria-hidden />
      <button type="button" className="btn btn-sm btn-ghost" onMouseDown={(e) => e.preventDefault()} onClick={() => void inserirImagem(editor)}>
        Imagem
      </button>
      <button type="button" className="btn btn-sm btn-ghost" onMouseDown={(e) => e.preventDefault()} onClick={() => setInserindoFluxo(true)}>
        Fluxo do plano
      </button>
      <button
        type="button"
        className="btn btn-sm btn-ghost"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      >
        Tabela
      </button>
    </>
  );

  const mencionar = () => {
    if (!editor) return;
    const antes = editor.state.selection.$from.nodeBefore?.text ?? '';
    editor.chain().focus().insertContent(antes && !/\s$/.test(antes) ? ' @' : '@').run();
  };

  return (
    <div className="flex flex-col flex-1 min-h-0" ref={raizRef}>
      <BarraMapa mapa={mapa} catalogo={catalogo} somenteLeitura={somenteLeitura} ferramentas={ferramentas} onMencionar={mencionar} />
      {/* As barras flutuantes medem a tela a cada desenho; rolar precisa redesenhar. */}
      <div className="mapa-doc-rolagem" onScroll={() => setRolagem((n) => n + 1)}>
        <div className="doc-folha doc papel" data-mencoes="">
          <EditorContent editor={editor} />
        </div>
      </div>
      {menu}
      {cartao}
      {editor && posImagem && !somenteLeitura && (
        <div className="mapa-barra-imagem" style={posImagem}>
          {(['33%', '60%', '100%'] as const).map((w, i) => (
            <button
              key={w}
              type="button"
              className="btn btn-sm btn-ghost"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().updateAttributes('image', { largura: w }).run()}
            >
              {['Pequena', 'Média', 'Largura toda'][i]}
            </button>
          ))}
          <button type="button" className="btn btn-sm btn-ghost" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().deleteSelection().run()}>
            Remover
          </button>
        </div>
      )}
      {editor && posTabela && !somenteLeitura && (
        <div className="mapa-barra-imagem" style={posTabela} role="toolbar" aria-label="Tabela">
          {(
            [
              ['+ Linha', () => editor.chain().focus().addRowAfter().run()],
              ['+ Coluna', () => editor.chain().focus().addColumnAfter().run()],
              ['− Linha', () => editor.chain().focus().deleteRow().run()],
              ['− Coluna', () => editor.chain().focus().deleteColumn().run()],
              ['Excluir tabela', () => editor.chain().focus().deleteTable().run()],
            ] as const
          ).map(([rotulo, acao]) => (
            <button key={rotulo} type="button" className="btn btn-sm btn-ghost" onMouseDown={(e) => e.preventDefault()} onClick={acao}>
              {rotulo}
            </button>
          ))}
        </div>
      )}
      {inserindoFluxo && (
        <DialogoInserirFluxo
          onFechar={() => setInserindoFluxo(false)}
          onInserir={(bloco: BlocoFluxo) => {
            setInserindoFluxo(false);
            editor?.chain().focus().insertContent({ type: 'figuraFluxo', attrs: atributosDoBloco(bloco) }).run();
          }}
        />
      )}
    </div>
  );
}
