import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { buscarMencoes, htmlMencao, type CatalogoMencoes, type FiltroMencao, type ItemMencao } from '../mencoes';
import { MenuMencao } from './MenuMencao';

/* ============================================================================
 * O @ DENTRO DE UM TEXTO EDITÁVEL (decisoes.md#D-39)
 *
 * Vale para qualquer `[data-mencoes]` dentro de `raiz`: a folha do documento
 * ou as caixas de texto dos slides. O @ abre a busca quando está no começo do
 * texto ou depois de um espaço — "fulano@tjmg" não abre nada.
 *
 * A menção entra como um `<span contenteditable=false>`, e quem guarda o HTML
 * é avisado por `aoMudar`: a inserção é feita pelo DOM e não dispara `input`.
 * ========================================================================== */

interface Contexto {
  no: Text;
  ini: number;
  fim: number;
  consulta: string;
}

const LIMITE_POR_GRUPO = 4;
const LIMITE_FILTRADO = 12;
const LARGURA_MENU = 380;

function editavelDe(no: Node | null): HTMLElement | null {
  const el = no instanceof Element ? no : no?.parentElement;
  return (el?.closest('[data-mencoes]') as HTMLElement | null) ?? null;
}

function contextoDoCursor(raiz: HTMLElement): Contexto | null {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !sel.isCollapsed) return null;
  const no = sel.anchorNode;
  if (!(no instanceof Text) || !raiz.contains(no) || !editavelDe(no) || no.parentElement?.closest('.mencao')) {
    return null;
  }
  const antes = no.data.slice(0, sel.anchorOffset);
  const ini = antes.lastIndexOf('@');
  if (ini < 0) return null;
  if (ini > 0 && !/[\s (]/.test(antes[ini - 1] ?? '')) return null;
  const consulta = antes.slice(ini + 1);
  if (consulta.length > 40 || (consulta.match(/ /g) ?? []).length > 3) return null;
  return { no, ini, fim: sel.anchorOffset, consulta };
}

export interface UsoMencoes {
  menu: ReactNode;
  /** Escreve um @ onde está o cursor (ou no fim de `alvo`) e abre a busca. */
  iniciar: (alvo: HTMLElement) => void;
}

export function useMencoes(
  raizRef: RefObject<HTMLElement>,
  catalogo: CatalogoMencoes,
  aoMudar: (editavel: HTMLElement) => void,
): UsoMencoes {
  const ctx = useRef<Contexto | null>(null);
  const [aberto, setAberto] = useState(false);
  const [consulta, setConsulta] = useState('');
  const [filtro, setFiltro] = useState<FiltroMencao>('todos');
  const [ativo, setAtivo] = useState(0);
  const [pos, setPos] = useState({ left: 0, top: 0, acima: false });

  const itens: ItemMencao[] = aberto
    ? buscarMencoes(catalogo, consulta, filtro, filtro === 'todos' ? LIMITE_POR_GRUPO : LIMITE_FILTRADO)
    : [];

  const fechar = useCallback(() => {
    ctx.current = null;
    setAberto(false);
  }, []);

  const checar = useCallback(() => {
    const raiz = raizRef.current;
    const c = raiz && contextoDoCursor(raiz);
    if (!c) {
      if (ctx.current) fechar();
      return;
    }
    const novo = !ctx.current;
    ctx.current = c;
    const r = document.createRange();
    r.setStart(c.no, c.ini);
    r.setEnd(c.no, c.ini + 1);
    const ret = r.getBoundingClientRect();
    setPos({
      left: Math.max(8, Math.min(ret.left, window.innerWidth - LARGURA_MENU - 8)),
      top: ret.bottom,
      acima: ret.bottom > window.innerHeight * 0.6,
    });
    setConsulta(c.consulta);
    if (novo) {
      setFiltro('todos');
      setAtivo(0);
    }
    setAberto(true);
  }, [raizRef, fechar]);

  const escolher = useCallback(
    (item: ItemMencao) => {
      const c = ctx.current;
      const editavel = c && editavelDe(c.no);
      if (!c || !editavel) return;
      const r = document.createRange();
      r.setStart(c.no, c.ini);
      r.setEnd(c.no, Math.min(c.fim, c.no.length));
      r.deleteContents();
      const tpl = document.createElement('template');
      tpl.innerHTML = htmlMencao(item.ref, item.nome);
      const chip = tpl.content.firstChild!;
      // O espaço inquebrável depois da menção dá ao cursor onde parar: sem ele,
      // não há como continuar a digitar à direita de um bloco não editável.
      const espaco = document.createTextNode(' ');
      r.insertNode(espaco);
      r.insertNode(chip);
      const sel = window.getSelection();
      const depois = document.createRange();
      depois.setStartAfter(espaco);
      depois.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(depois);
      fechar();
      aoMudar(editavel);
    },
    [aoMudar, fechar],
  );

  useEffect(() => {
    const raiz = raizRef.current;
    if (!raiz) return;
    const aoDigitar = (e: Event) => {
      if (editavelDe(e.target as Node)) checar();
    };
    raiz.addEventListener('input', aoDigitar);
    return () => raiz.removeEventListener('input', aoDigitar);
  }, [raizRef, checar]);

  useEffect(() => {
    if (!aberto) return;
    const aoMoverCursor = () => checar();
    document.addEventListener('selectionchange', aoMoverCursor);
    return () => document.removeEventListener('selectionchange', aoMoverCursor);
  }, [aberto, checar]);

  // Captura: as setas e o Enter são do menu enquanto ele está aberto, não do texto.
  useEffect(() => {
    if (!aberto) return;
    const n = itens.length;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' && n) setAtivo((i) => (i + 1) % n);
      else if (e.key === 'ArrowUp' && n) setAtivo((i) => (i - 1 + n) % n);
      else if ((e.key === 'Enter' || e.key === 'Tab') && n) escolher(itens[Math.min(ativo, n - 1)]!);
      else if (e.key === 'Escape') fechar();
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener('keydown', tecla, true);
    return () => document.removeEventListener('keydown', tecla, true);
  }, [aberto, itens, ativo, escolher, fechar]);

  const iniciar = useCallback((alvo: HTMLElement) => {
    alvo.focus();
    const sel = window.getSelection();
    if (!sel) return;
    if (!sel.rangeCount || !alvo.contains(sel.anchorNode)) {
      const r = document.createRange();
      r.selectNodeContents(alvo);
      r.collapse(false);
      sel.removeAllRanges();
      sel.addRange(r);
    }
    const no = sel.anchorNode;
    const antes = no instanceof Text ? no.data.slice(0, sel.anchorOffset) : '';
    // execCommand, e não DOM: dispara o `input` que abre o menu e entra no desfazer.
    document.execCommand('insertText', false, antes && !/\s$/.test(antes) ? ' @' : '@');
  }, []);

  const menu = aberto
    ? createPortal(
        <MenuMencao
          itens={itens}
          consulta={consulta}
          filtro={filtro}
          ativo={Math.min(ativo, Math.max(0, itens.length - 1))}
          pos={pos}
          largura={LARGURA_MENU}
          onFiltro={(f) => {
            setFiltro(f);
            setAtivo(0);
          }}
          onEscolher={escolher}
        />,
        document.body,
      )
    : null;

  return { menu, iniciar };
}
