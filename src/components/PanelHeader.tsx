import type { ReactNode } from 'react';

interface PanelHeaderProps {
  /** Pequena tag em maiúsculas acima do título (ex.: "Nó · Localizador"). */
  eyebrow: string;
  title: string;
  /** Conteúdo opcional alinhado à direita (geralmente um botão de remover). */
  right?: ReactNode;
  /** Linha inteira embaixo do título (a rota da transição, D-44). */
  children?: ReactNode;
}

/**
 * Cabeçalho compartilhado dos painéis laterais (NodePanel, EdgePanel,
 * ChecklistModal). Mantém uma faixa de "eyebrow" + título + ação à direita.
 */
export function PanelHeader({ eyebrow, title, right, children }: PanelHeaderProps) {
  return (
    <div className="px-4 pt-4 pb-3 border-b border-borda">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="section-h mb-0.5">{eyebrow}</div>
          <div className="truncate text-[14.5px] font-semibold text-texto">{title}</div>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}
