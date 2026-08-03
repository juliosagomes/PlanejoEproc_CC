import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import type { Sessao } from '@/domain';
import { SeloPermissao } from './SeloPermissao';

interface SessaoBadgeProps {
  sessao: Sessao;
  onTrocar: () => void;
}

/**
 * Indicador do contexto atual no cabeçalho: modo local ou lotação (com a
 * permissão). Responde "de quem são os planos que estou vendo" sem o usuário
 * precisar clicar em nada, e abre o menu para voltar à tela de entrada.
 *
 * Mesmo padrão de dropdown do `PlanSwitcher` — outside-click + Esc fecham.
 */
export function SessaoBadge({ sessao, onTrocar }: SessaoBadgeProps) {
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

  const local = sessao.tipo === 'local';
  const rotulo = local ? 'Modo local' : sessao.nome;

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        className="btn btn-sm"
        style={{ maxWidth: 220 }}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        title={local ? 'Planos guardados só neste navegador' : `Lotação: ${sessao.nome}`}
      >
        {local ? <Icon.Cadeado /> : <Icon.Predio />}
        <span className="truncate">{rotulo}</span>
        <Icon.ChevronDown />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute z-50 mt-1 rounded-lg bg-superficie border border-borda overflow-hidden"
          style={{ minWidth: 260, boxShadow: '0 4px 14px rgba(20, 22, 28, 0.12)' }}
        >
          <div className="px-3 py-2.5" style={{ borderBottom: '1px solid var(--borda)' }}>
            <div className="section-h mb-1">
              {local ? 'Modo local' : 'Lotação'}
            </div>
            <div className="text-[12.5px] font-medium leading-snug">{rotulo}</div>
            {local ? (
              <div className="text-[11.5px] text-texto-3 leading-snug mt-1">
                Os planos ficam só neste navegador. Nenhuma conexão é usada.
              </div>
            ) : (
              <div className="mt-1.5">
                <SeloPermissao permissao={sessao.permissao} />
                {sessao.permissao === 'leitura' && (
                  <div className="text-[11.5px] text-texto-3 leading-snug mt-1.5">
                    Você pode editar à vontade aqui, mas não enviar ao servidor.
                    Para isso, é preciso o código de edição.
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            role="menuitem"
            className="w-full flex items-center gap-2 px-3 py-2 text-[12.5px] text-texto-2 hover:bg-superficie-2 border-0 bg-transparent cursor-pointer text-left"
            onClick={() => {
              setOpen(false);
              onTrocar();
            }}
          >
            <Icon.Logout /> Trocar de lotação
          </button>
        </div>
      )}
    </div>
  );
}
