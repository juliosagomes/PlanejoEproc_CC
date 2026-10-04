import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import {
  getOrdemPlanos,
  setOrdemPlanos,
  type OrdemPlanos,
  type PlanIndexEntry,
} from '@/infra/storage';
import { cn } from '@/utils/cn';
import { ordenarPlanos } from './ordenarPlanos';

export interface PlanSwitcherProps {
  /** Lista de planos disponíveis. A ordem é escolha do usuário (recentes ou A–Z). */
  planos: PlanIndexEntry[];
  ativoId: string | null;
  /**
   * Nome do plano ativo "ao vivo" — preferido sobre o nome do índice para
   * evitar lag enquanto o usuário digita no input do header (índice só
   * atualiza quando o debounced save dispara).
   */
  ativoNomeLive: string;
  /** Sessão de visualização: trocar de plano continua, mexer neles não. */
  somenteLeitura?: boolean;
  onSwitch: (id: string) => void;
  onRenomear: (id: string) => void;
  onDuplicar: (id: string) => void;
  onExcluir: (id: string) => void;
  /**
   * Apaga o silo inteiro de uma vez. Só o modo local recebe este handler
   * (decisoes.md#D-18) — numa lotação, "todos" seria uma exclusão em massa
   * propagada ao servidor no próximo envio, e isso ninguém faz por engano.
   */
  onApagarTodos?: () => void;
}

/**
 * Dropdown de seleção de plano + ações por plano (renomear/duplicar/excluir).
 * Outside-click e Esc fecham. Ações de criar/abrir/exportar ficam nos botões
 * principais do Header — este componente só lida com o universo "qual plano
 * estou editando agora e o que quero fazer com cada um".
 */
export function PlanSwitcher({
  planos,
  ativoId,
  ativoNomeLive,
  somenteLeitura = false,
  onSwitch,
  onRenomear,
  onDuplicar,
  onExcluir,
  onApagarTodos,
}: PlanSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [ordem, setOrdem] = useState<OrdemPlanos>(getOrdemPlanos);
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

  const ordenados = ordenarPlanos(planos, ordem);
  const trocarOrdem = (nova: OrdemPlanos) => {
    setOrdem(nova);
    setOrdemPlanos(nova);
  };

  const labelBotao = ativoId
    ? ativoNomeLive || 'Plano sem título'
    : planos.length > 0
      ? 'Selecionar plano…'
      : 'Nenhum plano salvo';

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        className="btn btn-sm"
        style={{ minWidth: 200, maxWidth: 260, justifyContent: 'space-between' }}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        title={labelBotao}
      >
        <span className="flex items-center gap-1.5 min-w-0">
          <Icon.Folder />
          <span className="truncate">{labelBotao}</span>
        </span>
        <Icon.ChevronDown />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute z-50 mt-1 left-0 min-w-[280px] max-w-[360px] max-h-[60vh] overflow-auto bg-superficie border border-borda rounded-md shadow-lg scroll"
        >
          {ordenados.length > 1 && (
            <div
              className="flex items-center justify-between gap-2 px-2 pt-1.5 pb-1 border-b border-borda"
              role="group"
              aria-label="Ordem da lista"
            >
              <span className="section-h">Ordenar</span>
              <div className="flex gap-0.5">
                {(
                  [
                    ['recentes', 'Recentes'],
                    ['alfabetica', 'A–Z'],
                  ] as const
                ).map(([valor, rotulo]) => (
                  <button
                    key={valor}
                    type="button"
                    className={cn('btn btn-sm', ordem === valor ? 'btn-primary' : 'btn-ghost')}
                    style={{ height: 20, fontSize: 11, padding: '0 7px' }}
                    aria-pressed={ordem === valor}
                    onClick={() => trocarOrdem(valor)}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>
            </div>
          )}
          {ordenados.length === 0 ? (
            <div className="p-3 text-[12px] text-texto-3">
              Nenhum plano salvo ainda. Use{' '}
              <span className="text-texto-2 font-medium">Novo plano</span> ou{' '}
              <span className="text-texto-2 font-medium">Abrir arquivo</span>{' '}
              no cabeçalho.
            </div>
          ) : (
            <ul className="py-1">
              {ordenados.map((p) => {
                const ativo = p.id === ativoId;
                const nomeExibido = ativo ? ativoNomeLive || p.nome : p.nome;
                return (
                  <li
                    key={p.id}
                    className="group flex items-center gap-1 pl-2 pr-1.5 hover:bg-superficie-2"
                  >
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={ativo}
                      onClick={() => {
                        setOpen(false);
                        if (!ativo) onSwitch(p.id);
                      }}
                      className={cn(
                        'flex-1 min-w-0 text-left py-1.5 text-[12.5px] flex items-center gap-2',
                        ativo ? 'font-semibold text-texto' : 'text-texto-2',
                      )}
                      title={nomeExibido}
                    >
                      <span
                        className={cn(
                          'inline-block w-1.5 h-1.5 rounded-full flex-shrink-0',
                          ativo ? 'bg-destaque' : 'bg-transparent',
                        )}
                        aria-hidden
                      />
                      <span className="truncate">{nomeExibido}</span>
                    </button>
                    {!somenteLeitura && (
                      <>
                        <button
                          type="button"
                          className="btn btn-sm btn-icon btn-ghost opacity-0 group-hover:opacity-100 focus:opacity-100"
                          onClick={() => onRenomear(p.id)}
                          title="Renomear"
                          aria-label={`Renomear ${nomeExibido}`}
                        >
                          <Icon.Pencil />
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-icon btn-ghost opacity-0 group-hover:opacity-100 focus:opacity-100"
                          onClick={() => onDuplicar(p.id)}
                          title="Duplicar"
                          aria-label={`Duplicar ${nomeExibido}`}
                        >
                          <Icon.Copy />
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-icon btn-ghost opacity-0 group-hover:opacity-100 focus:opacity-100"
                          onClick={() => onExcluir(p.id)}
                          title="Excluir"
                          aria-label={`Excluir ${nomeExibido}`}
                        >
                          <Icon.Trash />
                        </button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {onApagarTodos && ordenados.length > 0 && !somenteLeitura && (
            <div className="border-t border-borda p-1">
              <button
                type="button"
                role="menuitem"
                className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-aviso hover:bg-aviso-suave border-0 bg-transparent cursor-pointer"
                onClick={() => {
                  setOpen(false);
                  onApagarTodos();
                }}
              >
                <Icon.Trash /> Apagar todos os planos
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
