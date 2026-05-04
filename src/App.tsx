import { useState } from 'react';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import type { FlowMode } from '@/domain';

/**
 * Página de teste visual da Fase 4 — Header + Sidebar com handlers stub,
 * área central de placeholder onde o canvas (FlowCanvas) entra na Fase 6.
 *
 * O `flowMode` real virá da store; aqui é só state local para confirmar que
 * o toggle visual funciona.
 */
const NOOP = () => {};

export default function App() {
  const [planoNome, setPlanoNome] = useState('Plano sem título');
  const [flowMode, setFlowMode] = useState<FlowMode>('organic');

  return (
    <div className="flex flex-col h-screen">
      <Header
        planoNome={planoNome}
        onPlanoNomeChange={setPlanoNome}
        onNovo={NOOP}
        onImportar={NOOP}
        onExportar={NOOP}
        onChecklist={NOOP}
        flowMode={flowMode}
        onFlowModeChange={setFlowMode}
        stats={{ nodes: 0, edges: 0, pendentes: 0 }}
      />

      <div className="flex flex-1 min-h-0">
        <Sidebar onCreateNode={NOOP} />

        <main className="flex-1 relative bg-fundo flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="text-xs uppercase tracking-wider text-texto-3 font-semibold">
              Fase 4 · placeholder
            </div>
            <p className="text-sm text-texto-2 mt-2">
              O <code className="mono text-texto">FlowCanvas</code> entra aqui na Fase 6.
              Header e Sidebar usam handlers vazios temporários — todos eles serão
              conectados à store na Fase 5/6.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
