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
  content: ['./index.html', './popup.html', './src/**/*.{ts,tsx}'],
  /**
   * As classes de cor das flags são montadas em runtime (`flag-cor-${f.cor}`),
   * então o scanner do Tailwind nunca as encontra no código e as removia do
   * bundle — os chips saíam sem cor nenhuma, sem erro nenhum. A paleta é fixa
   * em oito (`CORES_FLAG` em `domain/flags.ts`); mexeu lá, mexa aqui.
   */
  safelist: [
    'flag-cor-1',
    'flag-cor-2',
    'flag-cor-3',
    'flag-cor-4',
    'flag-cor-5',
    'flag-cor-6',
    'flag-cor-7',
    'flag-cor-8',
  ],
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
