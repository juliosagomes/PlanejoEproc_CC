import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';

export interface SalvarCopiaButtonProps {
  /** Total de planos no storage. Define se "Todos os planos" fica habilitado. */
  totalPlanos: number;
  onSalvarAtivo: () => void;
  onSalvarTodos: () => void;
}

/**
 * Botão "Salvar cópia" com dropdown de duas opções: exportar só o plano ativo
 * ou exportar todos os planos do storage como bundle único. Outside-click e
 * Esc fecham. Quando há 0 ou 1 plano no storage, "Todos os planos" fica
 * desabilitado (o caminho de plano único já cobre o caso).
 */
export function SalvarCopiaButton({
  totalPlanos,
  onSalvarAtivo,
  onSalvarTodos,
}: SalvarCopiaButtonProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onDocPointer(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const todosDisabled = totalPlanos <= 1;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        className="btn btn-sm"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        title="Baixa o plano ativo ou todos os planos como JSON"
      >
        <Icon.Download /> Salvar cópia <Icon.ChevronDown />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute z-50 mt-1 right-0 min-w-[240px] bg-superficie border border-borda rounded-md shadow-lg"
        >
          <ul className="py-1">
            <li>
              <button
                type="button"
                role="menuitem"
                className="w-full text-left px-3 py-1.5 text-[12.5px] text-texto-2 hover:bg-superficie-2"
                onClick={() => {
                  setOpen(false);
                  onSalvarAtivo();
                }}
                title="Baixa apenas o plano ativo (sugerido: salvar em /planos)"
              >
                Apenas este plano
              </button>
            </li>
            <li>
              <button
                type="button"
                role="menuitem"
                disabled={todosDisabled}
                className="w-full text-left px-3 py-1.5 text-[12.5px] text-texto-2 hover:bg-superficie-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                onClick={() => {
                  setOpen(false);
                  onSalvarTodos();
                }}
                title={
                  todosDisabled
                    ? 'Não há outros planos no navegador para incluir no bundle'
                    : `Exporta os ${totalPlanos} planos do navegador num único arquivo bundle`
                }
              >
                Todos os planos ({totalPlanos})
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
