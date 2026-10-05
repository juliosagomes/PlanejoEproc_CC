import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type InputHTMLAttributes,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';

export interface Sugestao {
  valor: string;
  /** Segunda linha, menor: tipo do documento, órgão dono, tela de origem. */
  detalhe?: string;
}

interface SugestoesInputProps<S extends Sugestao>
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'list'> {
  value: string;
  onValueChange: (valor: string) => void;
  sugestoes: readonly S[];
  /**
   * Chamado quando o usuário escolhe um item da lista (e não quando digita o
   * mesmo texto). Serve a quem precisa do resto da sugestão além do texto.
   */
  onEscolher?: (sugestao: S) => void;
}

/** Acima disso a lista pesa no DOM sem ajudar ninguém: quem procura digita. */
const MAX_VISIVEIS = 80;
const ALTURA_MAX = 260;

function normalizar(t: string): string {
  return t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR').trim();
}

/**
 * Campo de texto livre com sugestões, no lugar do `<datalist>`.
 *
 * O `<datalist>` é desenhado pelo navegador e não aceita estilo: no Windows o
 * Chrome o abre escuro, com a barra de rolagem do sistema, no meio de um app
 * claro. Este componente mantém o que o `<datalist>` dava — digitação livre,
 * teclado, nada de "valor selecionado" separado do texto — com a lista do
 * próprio app.
 *
 * A lista vai num portal com posição fixa, como o `react-select` do
 * `LocalizadorNomeInput`: dentro de modais com rolagem, uma lista absoluta seria
 * cortada pela caixa que rola.
 */
export function SugestoesInput<S extends Sugestao>({
  value,
  onValueChange,
  sugestoes,
  onEscolher,
  onKeyDown,
  onFocus,
  onBlur,
  ...resto
}: SugestoesInputProps<S>) {
  const listaId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  const [posicao, setPosicao] = useState<CSSProperties | null>(null);

  const visiveis = useMemo(() => {
    const alvo = normalizar(value);
    const filtradas = alvo
      ? sugestoes.filter((s) => normalizar(s.valor).includes(alvo))
      : sugestoes;
    // Texto idêntico à única sugestão: a lista não teria o que oferecer.
    if (filtradas.length === 1 && filtradas[0]?.valor === value) return [];
    return filtradas.slice(0, MAX_VISIVEIS);
  }, [sugestoes, value]);

  const mostrar = aberto && visiveis.length > 0;

  useLayoutEffect(() => {
    if (!mostrar) return;
    const medir = () => {
      const r = inputRef.current?.getBoundingClientRect();
      if (!r) return;
      const abaixo = window.innerHeight - r.bottom;
      const emCima = abaixo < Math.min(ALTURA_MAX, 160) && r.top > abaixo;
      setPosicao({
        position: 'fixed',
        left: r.left,
        width: Math.max(r.width, 220),
        ...(emCima
          ? { bottom: window.innerHeight - r.top + 4, maxHeight: Math.min(ALTURA_MAX, r.top - 12) }
          : { top: r.bottom + 4, maxHeight: Math.min(ALTURA_MAX, abaixo - 12) }),
      });
    };
    medir();
    // Captura: a rolagem que move o campo costuma ser a de um modal, não a da janela.
    window.addEventListener('scroll', medir, true);
    window.addEventListener('resize', medir);
    return () => {
      window.removeEventListener('scroll', medir, true);
      window.removeEventListener('resize', medir);
    };
  }, [mostrar]);

  useEffect(() => {
    setAtivo(-1);
  }, [value]);

  useEffect(() => {
    if (!mostrar || ativo < 0) return;
    document.getElementById(`${listaId}-${ativo}`)?.scrollIntoView({ block: 'nearest' });
  }, [mostrar, ativo, listaId]);

  const escolher = (s: S) => {
    onValueChange(s.valor);
    onEscolher?.(s);
    setAberto(false);
  };

  const teclas = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (visiveis.length === 0) return;
      e.preventDefault();
      setAberto(true);
      const passo = e.key === 'ArrowDown' ? 1 : -1;
      setAtivo((a) => (a + passo + visiveis.length) % visiveis.length);
      return;
    }
    if (e.key === 'Enter' && mostrar && ativo >= 0) {
      const s = visiveis[ativo];
      if (s) {
        e.preventDefault();
        escolher(s);
        return;
      }
    }
    if (e.key === 'Escape' && mostrar) {
      e.preventDefault();
      e.stopPropagation();
      setAberto(false);
      return;
    }
    onKeyDown?.(e);
  };

  return (
    <>
      <input
        {...resto}
        ref={inputRef}
        value={value}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={mostrar}
        aria-controls={mostrar ? listaId : undefined}
        aria-activedescendant={mostrar && ativo >= 0 ? `${listaId}-${ativo}` : undefined}
        autoComplete="off"
        onChange={(e) => {
          onValueChange(e.target.value);
          setAberto(true);
        }}
        onFocus={(e) => {
          setAberto(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setAberto(false);
          onBlur?.(e);
        }}
        onClick={() => setAberto(true)}
        onKeyDown={teclas}
      />
      {mostrar &&
        posicao &&
        createPortal(
          <ul id={listaId} role="listbox" className="sugestoes-lista" style={posicao}>
            {visiveis.map((s, i) => (
              <li
                key={`${s.valor}::${s.detalhe ?? ''}`}
                id={`${listaId}-${i}`}
                role="option"
                aria-selected={i === ativo}
                className="sugestoes-item"
                // mousedown, e não click: o click viria depois do blur, com a lista já fechada.
                onMouseDown={(e) => {
                  e.preventDefault();
                  escolher(s);
                }}
                onMouseEnter={() => setAtivo(i)}
              >
                <span>{s.valor}</span>
                {s.detalhe && <span className="sugestoes-detalhe">{s.detalhe}</span>}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </>
  );
}
