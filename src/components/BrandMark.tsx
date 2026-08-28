import type { SVGProps } from 'react';

/**
 * A marca do app: o mesmo desenho do ícone da extensão.
 *
 * A geometria é portada de `scripts/gen-icons.mjs` — dois nós ligados por uma
 * aresta, no quadrado com gradiente diagonal. Antes daqui o cabeçalho e a tela
 * de entrada mostravam as letras "eP", que não batiam com o ícone que o usuário
 * vê na barra do Chrome nem com o da aba. Uma marca só, em todo lugar.
 *
 * As coordenadas vêm do espaço [-1, 1] do gerador, mapeado para o viewBox 24:
 * `x24 = 12 + 12·x`. Mudou o glifo lá? Refaça a conta aqui, ou as duas versões
 * divergem em silêncio.
 */
export function GlifoMarca(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
      <path
        d="M7.92 7.92 16.08 16.08"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="7.92" cy="7.92" r="2.4" fill="currentColor" />
      <circle cx="16.08" cy="16.08" r="2.4" fill="currentColor" />
    </svg>
  );
}

interface BrandMarkProps {
  /** Lado do quadrado, em px. 26 no cabeçalho, 30 na tela de entrada. */
  tamanho?: number;
}

export function BrandMark({ tamanho = 26 }: BrandMarkProps) {
  return (
    <span className="brand-mark" style={{ width: tamanho, height: tamanho }}>
      <GlifoMarca width={tamanho * 0.66} height={tamanho * 0.66} />
    </span>
  );
}
