import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { cn } from '@/utils/cn';

const FecharMenu = createContext<() => void>(() => {});

interface MenuSuspensoProps {
  /** Conteúdo do botão que abre o menu. */
  gatilho: ReactNode;
  /** Nome acessível do botão, quando o conteúdo é só ícone. */
  ariaLabel?: string;
  title?: string;
  className?: string;
  /** De que lado o painel se apoia — à direita para os menus do fim da barra. */
  lado?: 'esquerda' | 'direita';
  largura?: number;
  children: ReactNode;
}

/**
 * Menu de cabeçalho: botão + painel com `ItemMenu`s. Fecha por clique fora,
 * Esc (devolvendo o foco ao botão) ou ao escolher um item; setas e Home/End
 * andam entre os itens, como pede o padrão de menu do WAI-ARIA.
 */
export function MenuSuspenso({
  gatilho,
  ariaLabel,
  title,
  className,
  lado = 'esquerda',
  largura = 260,
  children,
}: MenuSuspensoProps) {
  const [aberto, setAberto] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!aberto) return;
    const onDocPointer = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', onDocPointer);
    itensDe(painelRef.current)[0]?.focus();
    return () => document.removeEventListener('mousedown', onDocPointer);
  }, [aberto]);

  const fechar = () => setAberto(false);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setAberto(false);
      botaoRef.current?.focus();
      return;
    }
    const itens = itensDe(painelRef.current);
    if (itens.length === 0) return;
    const atual = itens.indexOf(document.activeElement as HTMLElement);
    const destino =
      e.key === 'ArrowDown'
        ? (atual + 1) % itens.length
        : e.key === 'ArrowUp'
          ? (atual - 1 + itens.length) % itens.length
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? itens.length - 1
              : null;
    if (destino === null) return;
    e.preventDefault();
    itens[destino]?.focus();
  };

  return (
    <div ref={wrapperRef} className="relative flex-shrink-0">
      <button
        ref={botaoRef}
        type="button"
        className={className ?? 'btn btn-sm btn-ghost'}
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? menuId : undefined}
        aria-label={ariaLabel}
        title={title}
      >
        {gatilho}
      </button>
      {aberto && (
        <div
          ref={painelRef}
          id={menuId}
          role="menu"
          onKeyDown={onKeyDown}
          className={cn(
            'absolute z-50 mt-1 p-1 bg-superficie border border-borda rounded-lg',
            lado === 'direita' ? 'right-0' : 'left-0',
          )}
          style={{ minWidth: largura, boxShadow: '0 8px 24px -8px rgba(var(--sombra-cor), 0.35)' }}
        >
          <FecharMenu.Provider value={fechar}>{children}</FecharMenu.Provider>
        </div>
      )}
    </div>
  );
}

function itensDe(painel: HTMLElement | null): HTMLElement[] {
  if (!painel) return [];
  return Array.from(painel.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)'));
}

interface ItemMenuProps {
  icone?: ReactNode;
  rotulo: ReactNode;
  /** Linha de apoio, em cinza, sob o rótulo. */
  descricao?: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  title?: string;
}

export function ItemMenu({ icone, rotulo, descricao, onSelect, disabled, title }: ItemMenuProps) {
  const fechar = useContext(FecharMenu);
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      title={title}
      onClick={() => {
        fechar();
        onSelect();
      }}
      className={cn(
        'w-full flex items-start gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[12.5px] text-texto border-0 bg-transparent cursor-pointer',
        'hover:bg-superficie-2 focus-visible:bg-superficie-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent',
      )}
    >
      {icone && (
        <span className="flex-shrink-0 mt-[2px] text-texto-3">
          {icone}
        </span>
      )}
      <span className="min-w-0">
        <span className="block font-medium">{rotulo}</span>
        {descricao && (
          <span className="block text-[11.5px] leading-snug text-texto-3">{descricao}</span>
        )}
      </span>
    </button>
  );
}

export function SeparadorMenu() {
  return <div role="separator" className="my-1 mx-1 h-px bg-borda" />;
}

export function TituloMenu({ children }: { children: ReactNode }) {
  return <div className="section-h px-2.5 pt-1.5 pb-0.5">{children}</div>;
}
