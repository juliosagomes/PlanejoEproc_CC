import type { Config } from 'tailwindcss';

/**
 * Tokens visuais do PlanejoEproc.
 *
 * As cores e fontes apontam para as variáveis CSS definidas em `src/index.css`
 * (bloco `:root`). Tailwind aqui é só uma camada de utilitárias — os valores
 * vivem no CSS para permitir override em runtime no futuro.
 *
 * Convenção: nomes de tokens em PT-BR (`bg-fundo`, `border-borda-forte`,
 * `text-aresta-atp`) — casa com a UI do produto e os comentários de domínio.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        fundo: 'var(--fundo)',
        superficie: 'var(--superficie)',
        'superficie-2': 'var(--superficie-2)',

        borda: 'var(--borda)',
        'borda-forte': 'var(--borda-forte)',

        texto: 'var(--texto)',
        'texto-2': 'var(--texto-2)',
        'texto-3': 'var(--texto-3)',

        destaque: 'var(--destaque)',
        'destaque-suave': 'var(--destaque-suave)',
        'destaque-borda': 'var(--destaque-borda)',

        ok: 'var(--ok)',
        'ok-suave': 'var(--ok-suave)',
        'ok-borda': 'var(--ok-borda)',

        aviso: 'var(--aviso)',
        'aviso-suave': 'var(--aviso-suave)',

        'aresta-atp': 'var(--aresta-atp)',
        'aresta-pref': 'var(--aresta-pref)',
        'aresta-manual': 'var(--aresta-manual)',

        'grade-ponto': 'var(--grade-ponto)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
