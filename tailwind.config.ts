import type { Config } from 'tailwindcss';

// Tokens visuais reais (cores portadas das variáveis :root do BETA_2.html) entram na Fase 3.
// Esta config mínima existe só para o pipeline rodar na Fase 0.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
