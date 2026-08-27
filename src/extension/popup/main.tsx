import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';

import '@/index.css';
import { Popup } from './Popup';

/**
 * O popup não hidrata o espelho do `chrome.storage`: todo o seu estado vem do
 * service worker por mensagem (ver `Popup.tsx`). Ler o storage aqui também
 * criaria uma segunda resposta possível para "qual é a lotação corrente".
 */
const root = document.getElementById('root');
if (!root) throw new Error('#root não encontrado em popup.html');

createRoot(root).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);
