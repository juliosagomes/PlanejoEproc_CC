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
