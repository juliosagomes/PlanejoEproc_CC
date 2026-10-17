import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type MouseEvent } from 'react';
import type { BlocoFluxo, MapaRetrato } from '@/domain';
import { useSetoresStore } from '@/features/setores/store';
import { blocoDesatualizado, desenharBloco } from '../fluxoPapel';
import { htmlFigura } from '../gerar';
import { escolherImagem, prepararImagem } from '../imagem';
import { atualizarMencoes, htmlDetalhe, lerRef, type CatalogoMencoes } from '../mencoes';
import { planoPorId } from '../planos';
import { lerFigura, sanitizarHtml } from '../sanitizar';
import { useMapasStore } from '../store';
import type { AlvoNoFluxo } from '../verNoFluxo';
import { BarraMapa } from './BarraMapa';
import { DialogoInserirFluxo } from './DialogoInserirFluxo';
import { useCartaoMencao } from './useCartaoMencao';
import { useMencoes } from './useMencoes';

/* ============================================================================
 * EDITOR DO MAPA EM RETRATO (decisoes.md#D-39)
 *
 * Um `contenteditable` com `execCommand`, sem biblioteca de editor: cobre o que
 * o documento precisa (títulos, negrito, listas, imagem, menção) sem dependência
 * nova. O React não controla o conteúdo — ele é posto uma vez por mapa, e cada
 * `input` devolve o HTML para a store. Controlá-lo faria o cursor pular a cada
 * tecla.
 *
 * A colagem entra como texto puro: HTML de fora traria estilo e, pior, o que a
 * sanitização teria de tirar depois.
 * ========================================================================== */

const ESTILOS = [
  { valor: 'p', rotulo: 'Parágrafo' },
  { valor: 'h1', rotulo: 'Título 1' },
  { valor: 'h2', rotulo: 'Título 2' },
  { valor: 'h3', rotulo: 'Título 3' },
] as const;

const FORMATOS = [
  { cmd: 'bold', rotulo: 'N', titulo: 'Negrito (Ctrl+B)', classe: 'font-bold' },
  { cmd: 'italic', rotulo: 'I', titulo: 'Itálico (Ctrl+I)', classe: 'italic' },
  { cmd: 'underline', rotulo: 'S', titulo: 'Sublinhado (Ctrl+U)', classe: 'underline' },
  { cmd: 'insertUnorderedList', rotulo: '•', titulo: 'Lista com marcadores', classe: '' },
  { cmd: 'insertOrderedList', rotulo: '1.', titulo: 'Lista numerada', classe: '' },
] as const;

interface Props {
  mapa: MapaRetrato;
  catalogo: CatalogoMencoes;
  somenteLeitura: boolean;
  onVerNoFluxo: (alvo: AlvoNoFluxo) => void;
}

/** O aviso que vai dentro da figura desatualizada. Some na gravação e na impressão. */
function avisoFluxo(planoSumiu: boolean, planoNome: string): HTMLElement {
  const div = document.createElement('div');
  div.className = 'fluxo-aviso';
  div.setAttribute('contenteditable', 'false');
  div.textContent = planoSumiu
    ? `O plano "${planoNome}" não existe mais neste silo. O desenho fica como estava.`
    : 'O plano mudou depois deste desenho.';
  if (!planoSumiu) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.atualizarFluxo = '';
    b.textContent = 'Atualizar desenho';
    div.appendChild(b);
  }
  return div;
}

function marcarFluxos(folha: HTMLElement): void {
  folha.querySelectorAll('figure.fluxo-bloco').forEach((fig) => {
    fig.querySelector('.fluxo-aviso')?.remove();
    const bloco = lerFigura(fig);
    if (!bloco) return;
    const plano = planoPorId(bloco.planoId);
    if (blocoDesatualizado(bloco, plano)) fig.prepend(avisoFluxo(plano === null, bloco.planoNome));
  });
}

/** O filho direto da folha onde está `no` — é depois dele que blocos novos entram. */
function blocoDe(folha: HTMLElement, no: Node | null | undefined): Element | null {
  let atual = no ?? null;
  while (atual && atual.parentNode !== folha) atual = atual.parentNode;
  return atual instanceof Element ? atual : null;
}

export function EditorDocumento({ mapa, catalogo, somenteLeitura, onVerNoFluxo }: Props) {
  const mudar = useMapasStore((s) => s.mudar);
  const setores = useSetoresStore((s) => s.setores);
  const raizRef = useRef<HTMLDivElement>(null);
  const folhaRef = useRef<HTMLDivElement>(null);
  const ultimoRange = useRef<Range | null>(null);
  const [inserindoFluxo, setInserindoFluxo] = useState(false);
  const [imagem, setImagem] = useState<{ el: HTMLImageElement; left: number; top: number } | null>(null);

  const salvar = useCallback(() => {
    const folha = folhaRef.current;
    if (!folha) return;
    const copia = folha.cloneNode(true) as HTMLElement;
    copia.querySelectorAll('.fluxo-aviso').forEach((el) => el.remove());
    const html = copia.innerHTML;
    mudar((m) => (m.formato === 'retrato' ? { ...m, html } : m));
  }, [mudar]);

  // O conteúdo é posto uma vez por mapa; dali em diante, quem manda é o DOM.
  useEffect(() => {
    const folha = folhaRef.current;
    if (!folha) return;
    folha.innerHTML = sanitizarHtml(mapa.html);
    atualizarMencoes(folha, catalogo);
    marcarFluxos(folha);
    // Só na troca de mapa; o catálogo tem efeito próprio logo abaixo.
  }, [mapa.id]);

  // Sincronizou a unidade ou mexeu num plano com o mapa aberto: as menções acompanham.
  useEffect(() => {
    const folha = folhaRef.current;
    if (!folha) return;
    if (atualizarMencoes(folha, catalogo) > 0 && !somenteLeitura) salvar();
    marcarFluxos(folha);
  }, [catalogo, salvar, somenteLeitura]);

  useEffect(() => {
    const guardar = () => {
      const sel = window.getSelection();
      const folha = folhaRef.current;
      if (sel?.rangeCount && folha?.contains(sel.anchorNode)) ultimoRange.current = sel.getRangeAt(0).cloneRange();
    };
    document.addEventListener('selectionchange', guardar);
    return () => document.removeEventListener('selectionchange', guardar);
  }, []);

  const { menu, iniciar } = useMencoes(raizRef, catalogo, salvar);

  const inserirDepoisDoCursor = useCallback(
    (html: string) => {
      const folha = folhaRef.current;
      if (!folha) return;
      const tpl = document.createElement('template');
      tpl.innerHTML = html;
      const ref = blocoDe(folha, ultimoRange.current?.startContainer);
      if (ref) ref.after(tpl.content);
      else folha.append(tpl.content);
      atualizarMencoes(folha, catalogo);
      salvar();
    },
    [catalogo, salvar],
  );

  const cartao = useCartaoMencao(raizRef, catalogo, {
    podeEditar: !somenteLeitura,
    onVerNoFluxo,
    onInserirDetalhe: (chip) => {
      const folha = folhaRef.current;
      const ref = lerRef(chip);
      if (!folha || !ref) return;
      const tpl = document.createElement('template');
      tpl.innerHTML = htmlDetalhe(ref, catalogo);
      const celula = chip.closest('td');
      if (celula) celula.append(tpl.content);
      else blocoDe(folha, chip)?.after(tpl.content);
      salvar();
    },
  });

  const formatar = (cmd: string, valor?: string) => {
    folhaRef.current?.focus();
    const r = ultimoRange.current;
    if (r) {
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(r);
    }
    document.execCommand(cmd, false, valor);
    salvar();
  };

  const inserirImagem = async (arquivo?: Blob) => {
    try {
      const img = arquivo ? await prepararImagem(arquivo) : await escolherImagem();
      if (img) inserirDepoisDoCursor(`<p><img src="${img.src}" style="width:60%" alt=""></p>`);
    } catch (err) {
      window.alert((err as Error).message);
    }
  };

  const atualizarFigura = (fig: Element) => {
    const bloco = lerFigura(fig);
    const plano = bloco && planoPorId(bloco.planoId);
    if (!bloco || !plano) return;
    const novo = desenharBloco(plano, bloco.planoId, bloco.nos, bloco.fora, setores, new Date().toISOString());
    const tpl = document.createElement('template');
    tpl.innerHTML = htmlFigura(novo);
    fig.replaceWith(tpl.content);
    salvar();
  };

  const aoColar = (e: ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const arquivo = [...e.clipboardData.files].find((f) => f.type.startsWith('image/'));
    if (arquivo) void inserirImagem(arquivo);
    else document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
  };

  const aoSoltar = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const arquivo = [...e.dataTransfer.files].find((f) => f.type.startsWith('image/'));
    if (arquivo && !somenteLeitura) void inserirImagem(arquivo);
  };

  const aoClicar = (e: MouseEvent<HTMLDivElement>) => {
    const alvo = e.target as HTMLElement;
    const atualizar = alvo.closest('[data-atualizar-fluxo]');
    if (atualizar) {
      const fig = atualizar.closest('figure.fluxo-bloco');
      if (fig) atualizarFigura(fig);
      return;
    }
    if (alvo instanceof HTMLImageElement && !somenteLeitura) {
      const r = alvo.getBoundingClientRect();
      setImagem({ el: alvo, left: r.left, top: Math.max(8, r.top - 40) });
    } else {
      setImagem(null);
    }
  };

  const ferramentas = (
    <>
      <select
        className="input mapa-estilo"
        aria-label="Estilo do parágrafo"
        value=""
        onChange={(e) => formatar('formatBlock', e.target.value)}
      >
        <option value="" disabled hidden>
          Estilo
        </option>
        {ESTILOS.map((s) => (
          <option key={s.valor} value={s.valor}>
            {s.rotulo}
          </option>
        ))}
      </select>
      {FORMATOS.map((f) => (
        <button
          key={f.cmd}
          type="button"
          className="btn btn-sm btn-icon btn-ghost"
          title={f.titulo}
          aria-label={f.titulo}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => formatar(f.cmd)}
        >
          <span className={f.classe}>{f.rotulo}</span>
        </button>
      ))}
      <span className="mapa-barra-sep" aria-hidden />
      <button type="button" className="btn btn-sm btn-ghost" onMouseDown={(e) => e.preventDefault()} onClick={() => void inserirImagem()}>
        Imagem
      </button>
      <button type="button" className="btn btn-sm btn-ghost" onMouseDown={(e) => e.preventDefault()} onClick={() => setInserindoFluxo(true)}>
        Fluxo do plano
      </button>
    </>
  );

  return (
    <div className="flex flex-col flex-1 min-h-0" ref={raizRef}>
      <BarraMapa
        mapa={mapa}
        catalogo={catalogo}
        somenteLeitura={somenteLeitura}
        ferramentas={ferramentas}
        onMencionar={() => folhaRef.current && iniciar(folhaRef.current)}
      />
      <div className="mapa-doc-rolagem" onScroll={() => setImagem(null)}>
        <div
          ref={folhaRef}
          className="doc-folha doc papel"
          contentEditable={!somenteLeitura}
          suppressContentEditableWarning
          spellCheck
          lang="pt-BR"
          data-mencoes=""
          role="textbox"
          aria-multiline="true"
          aria-label="Documento do mapa"
          onInput={salvar}
          onPaste={aoColar}
          onDrop={aoSoltar}
          onClick={aoClicar}
        />
      </div>
      {menu}
      {cartao}
      {imagem && (
        <div className="mapa-barra-imagem" style={{ left: imagem.left, top: imagem.top }}>
          {(['33%', '60%', '100%'] as const).map((w, i) => (
            <button
              key={w}
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => {
                imagem.el.style.width = w;
                setImagem(null);
                salvar();
              }}
            >
              {['Pequena', 'Média', 'Largura toda'][i]}
            </button>
          ))}
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => {
              imagem.el.remove();
              setImagem(null);
              salvar();
            }}
          >
            Remover
          </button>
        </div>
      )}
      {inserindoFluxo && (
        <DialogoInserirFluxo
          onFechar={() => setInserindoFluxo(false)}
          onInserir={(bloco: BlocoFluxo) => {
            setInserindoFluxo(false);
            inserirDepoisDoCursor(htmlFigura(bloco));
          }}
        />
      )}
    </div>
  );
}
