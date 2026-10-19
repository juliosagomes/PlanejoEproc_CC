import type { ReactNode, Ref } from 'react';
import { Icon } from '@/components/Icon';

interface ModalShellProps {
  titulo: string;
  subtitulo: 'ATP' | 'Preferência';
  somenteLeitura: boolean;
  /**
   * O detalhamento de ATP tem três blocos e campos lado a lado, como a tela do
   * Eproc; nos 720px do modal padrão viraria uma coluna interminável.
   */
  largo?: boolean;
  onClose: () => void;
  /** Linha abaixo do título: a rota da regra, origem → destino. */
  rota?: ReactNode;
  /** Faixa entre o cabeçalho e o corpo, fora da rolagem (a frase da ATP, D-45). */
  faixa?: ReactNode;
  /** Coluna à esquerda do corpo, fora da rolagem e do `fieldset`. */
  nav?: ReactNode;
  /** Botões do rodapé, antes do "Concluído". */
  rodape?: ReactNode;
  /** O elemento que rola, para quem precisa rolar até um campo. */
  corpoRef?: Ref<HTMLFieldSetElement>;
  children: ReactNode;
}

export function ModalShell({
  titulo,
  subtitulo,
  somenteLeitura,
  largo = false,
  onClose,
  rota,
  faixa,
  nav,
  rodape,
  corpoRef,
  children,
}: ModalShellProps) {
  const corpo = (
    // `fieldset[disabled]` alcança todo controle aninhado, inclusive os
    // `react-select` dos catálogos — um lugar só para desligar o modal.
    <fieldset
      ref={corpoRef}
      disabled={somenteLeitura}
      className="px-5 py-4 flex flex-col gap-3.5 overflow-auto border-0 m-0 min-w-0"
      // A frase da ATP ocupa altura fora da rolagem; sem descontá-la o rodapé sai da tela.
      style={{ maxHeight: largo ? (faixa ? '58vh' : '68vh') : '60vh' }}
    >
      {children}
    </fieldset>
  );

  return (
    <>
      <div className="scrim no-print" onClick={onClose} />
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        style={largo ? { width: 'min(940px, 94vw)' } : undefined}
      >
        <div
          className="px-5 pt-4 pb-3 flex items-start gap-3 no-print"
          style={{ borderBottom: '1px solid var(--borda)' }}
        >
          <div
            className="flex items-center justify-center text-destaque"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'var(--destaque-suave)',
              border: '1px solid var(--destaque-borda)',
            }}
          >
            <Icon.Bolt />
          </div>
          <div className="flex-1">
            <div className="section-h">Detalhamento de {subtitulo}</div>
            <div className="text-[14.5px] font-semibold">{titulo}</div>
            {rota}
            <div className="text-[11.5px] text-texto-3 mt-1">
              {somenteLeitura ? (
                <>
                  Sessão de visualização — os campos abaixo mostram como esta{' '}
                  {subtitulo === 'Preferência' ? 'preferência' : 'regra'} foi
                  modelada, mas não aceitam alteração.
                </>
              ) : (
                <>
                  Marque <span className="mono">Implantar no checklist</span> para que
                  esta {subtitulo === 'Preferência' ? 'preferência' : 'regra'} apareça
                  como item a ser criado no Eproc.
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-icon btn-ghost"
            onClick={onClose}
            aria-label="Fechar"
          >
            <Icon.X />
          </button>
        </div>

        {faixa}
        {nav ? (
          <div className="grid min-h-0" style={{ gridTemplateColumns: '190px minmax(0, 1fr)' }}>
            {nav}
            {corpo}
          </div>
        ) : (
          corpo
        )}

        <div
          className="px-5 py-3 flex items-center gap-2 no-print"
          style={{ borderTop: '1px solid var(--borda)' }}
        >
          <div className="text-xs text-texto-3">
            {somenteLeitura
              ? 'Somente leitura — nada aqui altera o plano.'
              : 'As alterações são salvas automaticamente no quadro.'}
          </div>
          <div className="ml-auto flex gap-2">
            {rodape}
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Concluído
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
