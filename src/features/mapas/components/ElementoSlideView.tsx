import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { ElementoSlide } from '@/domain';
import { cn } from '@/utils/cn';
import { atualizarMencoes, type CatalogoMencoes } from '../mencoes';
import { sanitizarHtml, sanitizarSvgFluxo } from '../sanitizar';

const ROTULO = { texto: 'Texto', nota: 'Nota', imagem: 'Imagem', fluxo: 'Fluxo' } as const;

export type Gesto = 'mover' | 'redimensionar';

interface Props {
  elemento: ElementoSlide;
  selecionado: boolean;
  editavel: boolean;
  catalogo: CatalogoMencoes;
  /** O desenho ficou para trás do plano (ou o plano sumiu). */
  desatualizado: 'nao' | 'mudou' | 'sumiu';
  onSelecionar: () => void;
  onGesto: (e: ReactPointerEvent, gesto: Gesto) => void;
  onTexto: (html: string) => void;
  onAtualizarFluxo: () => void;
}

/**
 * Uma peça do slide. O texto é um `contenteditable` não controlado, como a
 * folha do documento: o HTML é posto na montagem e devolvido a cada `input`.
 */
export function ElementoSlideView(p: Props) {
  const { elemento: e, editavel } = p;
  const textoRef = useRef<HTMLDivElement>(null);
  const ehTexto = e.tipo === 'texto' || e.tipo === 'nota';

  useEffect(() => {
    if (!ehTexto || !textoRef.current) return;
    textoRef.current.innerHTML = sanitizarHtml(e.html);
    atualizarMencoes(textoRef.current, p.catalogo);
    // Só na montagem: depois disso o DOM é a verdade, e regravá-lo moveria o cursor.
  }, [e.id]);

  useEffect(() => {
    if (ehTexto && textoRef.current && atualizarMencoes(textoRef.current, p.catalogo) > 0) {
      p.onTexto(textoRef.current.innerHTML);
    }
  }, [p.catalogo]);

  // Imagem e desenho se movem pelo corpo; texto só pela alça, para o clique editar.
  const corpoMove = editavel && !ehTexto;
  const fluxo = e.tipo === 'fluxo' ? e.fluxo : null;

  return (
    <div
      className={cn('el', `el-${e.tipo}`, p.selecionado && 'sel')}
      data-id={e.id}
      style={{ left: e.x, top: e.y, width: e.w, height: e.h }}
      onPointerDown={(ev) => {
        if (!editavel) return;
        p.onSelecionar();
        if (corpoMove && !(ev.target as Element).closest('button')) p.onGesto(ev, 'mover');
      }}
    >
      {e.tipo === 'texto' || e.tipo === 'nota' ? (
        <div
          ref={textoRef}
          className="el-conteudo"
          contentEditable={editavel}
          suppressContentEditableWarning
          spellCheck
          lang="pt-BR"
          data-mencoes=""
          role="textbox"
          aria-multiline="true"
          aria-label={ROTULO[e.tipo]}
          onInput={(ev) => p.onTexto(ev.currentTarget.innerHTML)}
          onPaste={(ev) => {
            ev.preventDefault();
            document.execCommand('insertText', false, ev.clipboardData.getData('text/plain'));
          }}
        />
      ) : e.tipo === 'imagem' ? (
        <div className="el-conteudo">
          {e.src.startsWith('data:image/') && <img src={e.src} alt="" draggable={false} />}
        </div>
      ) : (
        <div className="el-conteudo">
          {editavel && p.desatualizado !== 'nao' && (
            <div className="fluxo-aviso">
              {p.desatualizado === 'sumiu'
                ? `O plano "${fluxo?.planoNome ?? ''}" não existe mais. O desenho fica como estava.`
                : 'O plano mudou depois deste desenho.'}
              {p.desatualizado === 'mudou' && (
                <button type="button" onPointerDown={(ev) => ev.stopPropagation()} onClick={p.onAtualizarFluxo}>
                  Atualizar desenho
                </button>
              )}
            </div>
          )}
          <div className="fluxo-svg" dangerouslySetInnerHTML={{ __html: sanitizarSvgFluxo(fluxo?.svg ?? '') }} />
        </div>
      )}
      {editavel && (
        <>
          <span
            className="el-alca"
            onPointerDown={(ev) => {
              ev.stopPropagation();
              p.onSelecionar();
              p.onGesto(ev, 'mover');
            }}
            title="Arraste para mover"
          >
            ⠿ {ROTULO[e.tipo]}
          </span>
          <span
            className="el-canto"
            onPointerDown={(ev) => {
              ev.stopPropagation();
              p.onSelecionar();
              p.onGesto(ev, 'redimensionar');
            }}
            title="Arraste para redimensionar"
            aria-hidden
          />
        </>
      )}
    </div>
  );
}
