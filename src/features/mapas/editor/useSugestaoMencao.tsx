import { useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Extension } from '@tiptap/core';
import Suggestion, { type SuggestionProps } from '@tiptap/suggestion';
import { MenuMencao } from '../components/MenuMencao';
import { buscarMencoes, type CatalogoMencoes, type FiltroMencao, type ItemMencao } from '../mencoes';
import { atributosDaRef } from './mencoesNoEditor';

/* ============================================================================
 * O @ NO EDITOR DO DOCUMENTO (decisoes.md#D-39)
 *
 * O plugin de sugestão do TipTap acha o @ e o texto digitado depois dele; a
 * lista e o teclado são nossos, com o mesmo `MenuMencao` dos slides. A menção
 * entra por comando do editor, e por isso o Ctrl+Z a desfaz.
 * ========================================================================== */

const LIMITE_POR_GRUPO = 4;
const LIMITE_FILTRADO = 12;
const LARGURA_MENU = 380;

interface Aberto {
  consulta: string;
  rect: DOMRect | null;
  escolher: (item: ItemMencao) => void;
}

/** Busca longa demais, ou com muitas palavras, já não é uma menção: é texto. */
const ehMencao = (q: string) => q.length <= 40 && (q.match(/ /g) ?? []).length <= 3;

export function useSugestaoMencao(catalogo: CatalogoMencoes): { extensao: Extension; menu: ReactNode } {
  const [aberto, setAberto] = useState<Aberto | null>(null);
  const [filtro, setFiltro] = useState<FiltroMencao>('todos');
  const [ativo, setAtivo] = useState(0);
  const dispensado = useRef(false);

  const itens = aberto
    ? buscarMencoes(catalogo, aberto.consulta, filtro, filtro === 'todos' ? LIMITE_POR_GRUPO : LIMITE_FILTRADO)
    : [];

  // O plugin é criado uma vez; o teclado lê o estado de agora por esta ref.
  const agora = useRef({ aberto, itens, ativo });
  agora.current = { aberto, itens, ativo };

  const extensao = useMemo(
    () =>
      Extension.create({
        name: 'sugestaoMencao',
        addProseMirrorPlugins() {
          const mostrar = (p: SuggestionProps<ItemMencao>, novo: boolean) => {
            if (novo) {
              dispensado.current = false;
              setFiltro('todos');
              setAtivo(0);
            }
            if (dispensado.current || !ehMencao(p.query)) {
              setAberto(null);
              return;
            }
            setAberto({ consulta: p.query, rect: p.clientRect?.() ?? null, escolher: p.command });
          };
          return [
            Suggestion<ItemMencao>({
              editor: this.editor,
              char: '@',
              allowSpaces: true,
              items: () => [],
              command: ({ editor, range, props }) => {
                editor
                  .chain()
                  .focus()
                  .insertContentAt(range, [
                    { type: 'mencao', attrs: atributosDaRef(props.ref, props.nome) },
                    { type: 'text', text: ' ' },
                  ])
                  .run();
              },
              render: () => ({
                onStart: (p) => mostrar(p, true),
                onUpdate: (p) => mostrar(p, false),
                onExit: () => setAberto(null),
                onKeyDown: ({ event }) => {
                  const { aberto: a, itens: lista, ativo: i } = agora.current;
                  if (!a) return false;
                  const n = lista.length;
                  if (event.key === 'ArrowDown' && n) setAtivo((i + 1) % n);
                  else if (event.key === 'ArrowUp' && n) setAtivo((i - 1 + n) % n);
                  else if ((event.key === 'Enter' || event.key === 'Tab') && n) a.escolher(lista[Math.min(i, n - 1)]!);
                  else if (event.key === 'Escape') {
                    dispensado.current = true;
                    setAberto(null);
                  } else return false;
                  return true;
                },
              }),
            }),
          ];
        },
      }),
    [],
  );

  const r = aberto?.rect;
  const menu =
    aberto && r
      ? createPortal(
          <MenuMencao
            itens={itens}
            consulta={aberto.consulta}
            filtro={filtro}
            ativo={Math.min(ativo, Math.max(0, itens.length - 1))}
            pos={{
              left: Math.max(8, Math.min(r.left, window.innerWidth - LARGURA_MENU - 8)),
              top: r.bottom,
              acima: r.bottom > window.innerHeight * 0.6,
            }}
            largura={LARGURA_MENU}
            onFiltro={(f) => {
              setFiltro(f);
              setAtivo(0);
            }}
            onEscolher={(item) => aberto.escolher(item)}
          />,
          document.body,
        )
      : null;

  return { extensao, menu };
}
