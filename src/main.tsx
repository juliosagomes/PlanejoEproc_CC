import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Inter local — subset latin é suficiente para PT-BR. Mais subsets só se
// precisarmos de cirílico/grego/vietnamita (não é o caso). Pesos limitados
// aos quatro usados no protótipo.
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';

import App from '@/App';
import '@/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root não encontrado em index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
