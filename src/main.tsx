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
import { inicializarPlataforma } from '@/infra/plataforma';
import '@/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root não encontrado em index.html');

function render(): void {
  createRoot(root!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

// A hidratação precisa vir antes do primeiro render: na extensão, o espelho do
// `chrome.storage` nasce vazio e só depois dela devolve os planos e as lotações
// conhecidas. Renderizar antes mostraria a tela de login sem os atalhos de
// reentrada. Fora da extensão é no-op e resolve no mesmo tick.
//
// `then` em vez de top-level await porque o alvo de build do Vite inclui
// navegadores anteriores ao suporte a TLA — e uma falha aqui deve degradar para
// "app sem dados salvos", nunca para tela branca.
inicializarPlataforma()
  .catch((err: unknown) => {
    console.error('[main] falha ao inicializar a plataforma de armazenamento', err);
  })
  .finally(render);
