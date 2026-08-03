import type { SVGProps } from 'react';

/**
 * Conjunto de ícones SVG inline portado do BETA_2. Usa `currentColor` para
 * herdar a cor do contexto (botões, chips, etc.).
 *
 * Mantido em `src/components/` (e não em `features/canvas/`) porque é usado
 * por Header, Sidebar e painéis — divergência consciente do briefing.
 */

type IconProps = SVGProps<SVGSVGElement>;

const baseProps = {
  width: 14,
  height: 14,
  viewBox: '0 0 14 14',
  fill: 'none',
  'aria-hidden': true,
} as const;

export const Icon = {
  Plus: (p: IconProps) => (
    <svg {...baseProps} {...p}>
      <path
        d="M7 2.5v9M2.5 7h9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  ),
  X: (p: IconProps) => (
    <svg {...baseProps} {...p}>
      <path
        d="m3.5 3.5 7 7M10.5 3.5l-7 7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  ),
  Trash: (p: IconProps) => (
    <svg {...baseProps} {...p}>
      <path
        d="M3 4h8M5.5 4V2.5h3V4M4 4l.6 7.5h4.8L10 4M6 6.5v3.5M8 6.5v3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Bolt: (p: IconProps) => (
    <svg {...baseProps} {...p}>
      <path d="M7.5 1 3 8h3.2L6 13l4.5-7H7.3z" fill="currentColor" />
    </svg>
  ),
  Download: (p: IconProps) => (
    <svg {...baseProps} {...p}>
      <path
        d="M7 1.5v8m0 0L4 7m3 2.5L10 7M2 11.5h10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Upload: (p: IconProps) => (
    <svg {...baseProps} {...p}>
      <path
        d="M7 9.5v-8m0 0L4 4m3-2.5L10 4M2 11.5h10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  File: (p: IconProps) => (
    <svg {...baseProps} {...p}>
      <path
        d="M3 1.5h5l3 3v8H3v-11Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M8 1.5v3h3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Copy: (p: IconProps) => (
    <svg {...baseProps} {...p}>
      <rect
        x="2.5"
        y="4.5"
        width="7"
        height="8"
        rx="1.2"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M4.5 4.5v-2a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  ),
  Print: (p: IconProps) => (
    <svg {...baseProps} {...p}>
      <rect
        x="3"
        y="6"
        width="8"
        height="5"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M4 6V2.5h6V6M4.5 11v1.5h5V11"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Pencil: (p: IconProps) => (
    <svg {...baseProps} {...p}>
      <path
        d="M2 12 1.5 12.5 2 10l7-7 2 2-7 7L2 12Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="m8.5 3.5 2 2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  ),
  ChevronDown: (p: IconProps) => (
    <svg {...baseProps} {...p}>
      <path
        d="m3.5 5.5 3.5 3.5 3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Folder: (p: IconProps) => (
    <svg {...baseProps} {...p}>
      <path
        d="M1.5 3.5h4l1.2 1.2h5.8v7.3a.5.5 0 0 1-.5.5H2a.5.5 0 0 1-.5-.5v-8.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  ),
  /** Lombadas de livros enfileiradas — usado para o catálogo do órgão. */
  Library: (p: IconProps) => (
    <svg {...baseProps} {...p}>
      <rect
        x="2"
        y="2"
        width="2.4"
        height="10"
        rx="0.5"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <rect
        x="5.4"
        y="2"
        width="2.4"
        height="10"
        rx="0.5"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <rect
        x="8.8"
        y="3"
        width="2.4"
        height="9"
        rx="0.5"
        stroke="currentColor"
        strokeWidth="1.3"
        transform="rotate(-10 10 7.5)"
      />
    </svg>
  ),
  /** Três nós conectados — usado para compartilhar/sincronizar planos. */
  Share: (p: IconProps) => (
    <svg {...baseProps} {...p}>
      <circle cx="3" cy="7" r="1.6" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="10.5" cy="2.8" r="1.6" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="10.5" cy="11.2" r="1.6" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="m4.4 6.2 4.6-2.7M4.4 7.8l4.6 2.7"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  ),
  /** Nuvem com seta para baixo — "Baixar do servidor" (pull). */
  CloudDown: (p: IconProps) => (
    <svg {...baseProps} {...p}>
      <path
        d="M4 9.5a2.5 2.5 0 0 1 .3-5A3.2 3.2 0 0 1 10.3 5a2.3 2.3 0 0 1-.3 4.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 6.5v6m0 0L5.2 10.7M7 12.5l1.8-1.8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  /** Nuvem com seta para cima — "Enviar ao servidor" (push). */
  CloudUp: (p: IconProps) => (
    <svg {...baseProps} {...p}>
      <path
        d="M4 9.5a2.5 2.5 0 0 1 .3-5A3.2 3.2 0 0 1 10.3 5a2.3 2.3 0 0 1-.3 4.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 12.5v-6m0 0L5.2 8.3M7 6.5l1.8 1.8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  /** Porta com seta saindo — trocar de lotação / voltar à tela de entrada. */
  Logout: (p: IconProps) => (
    <svg {...baseProps} {...p}>
      <path
        d="M8.5 2.5h-5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 7h6m0 0-2-2m2 2-2 2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  /** Prédio — identifica a lotação (unidade) na barra superior. */
  Predio: (p: IconProps) => (
    <svg {...baseProps} {...p}>
      <path
        d="M2.5 12.5v-9L7 1.5l4.5 2v9M1.5 12.5h11"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 6h1.2M7.8 6H9M5 8.4h1.2M7.8 8.4H9M6 12.5v-2h2v2"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  ),
  /** Cadeado — modo local, sem rede. */
  Cadeado: (p: IconProps) => (
    <svg {...baseProps} {...p}>
      <rect
        x="2.8"
        y="6"
        width="8.4"
        height="6.5"
        rx="1.2"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M4.8 6V4.5a2.2 2.2 0 0 1 4.4 0V6"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  ),
  /** Check do canto direito superior do nó "já criado". 10×10. */
  CheckCorner: (p: IconProps) => (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden {...p}>
      <path
        d="m2 5.2 2 2 4-4.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
} as const;
