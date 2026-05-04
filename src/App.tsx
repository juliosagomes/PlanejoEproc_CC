import { useEffect, useMemo, useState } from 'react';
import { ReactFlowProvider } from 'reactflow';

import { Header, type HeaderStats } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { EdgePanel } from '@/features/canvas/components/EdgePanel';
import { FlowCanvas } from '@/features/canvas/components/FlowCanvas';
import { NodePanel } from '@/features/canvas/components/NodePanel';
import { flushPersist, useCanvasStore } from '@/features/canvas/store';
import { ChecklistModal } from '@/features/checklist/components/ChecklistModal';
import { PlanoSchema, planoVazio } from '@/infra/storage';

/**
 * Composição principal do app — Header + Sidebar + canvas + painel direito
 * condicional + modal de checklist. Conecta todos os handlers à store e
 * implementa import/export JSON, atalho Delete e flush de persistência no
 * unload.
 */
export default function App() {
  const planoNome = useCanvasStore((s) => s.planoNome);
  const flowMode = useCanvasStore((s) => s.flowMode);
  const selectedId = useCanvasStore((s) => s.selectedId);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);

  const setPlanoNome = useCanvasStore((s) => s.setPlanoNome);
  const setFlowMode = useCanvasStore((s) => s.setFlowMode);
  const loadPlanoAcao = useCanvasStore((s) => s.loadPlano);
  const createNode = useCanvasStore((s) => s.createNode);

  const [showChecklist, setShowChecklist] = useState(false);

  const selectedNode = useMemo(
    () => (selectedId ? nodes.find((n) => n.id === selectedId) ?? null : null),
    [selectedId, nodes],
  );
  const selectedEdge = useMemo(
    () =>
      !selectedNode && selectedId
        ? edges.find((e) => e.id === selectedId) ?? null
        : null,
    [selectedId, edges, selectedNode],
  );

  const stats: HeaderStats = useMemo(() => {
    let pendentes = 0;
    for (const n of nodes) if (!n.data.ja_criado) pendentes += 1;
    for (const e of edges) {
      const subs = e.data?.subitems ?? [];
      for (const s of subs) if (!s.ja_criado) pendentes += 1;
    }
    return { nodes: nodes.length, edges: edges.length, pendentes };
  }, [nodes, edges]);

  // PjEdge lê o modo deste atributo do body (hack herdado do BETA_2 — ver
  // comentário em PjEdge.tsx).
  useEffect(() => {
    document.body.dataset.flowMode = flowMode;
  }, [flowMode]);

  // Garante que qualquer save pendente seja gravado antes do tab fechar.
  useEffect(() => {
    const onBeforeUnload = () => flushPersist();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  // Atalho Delete remove a seleção (a menos que o foco esteja em input).
  // Backspace fica fora — em Mac é a tecla "Delete" comum, e capturá-la
  // surpreenderia usuários acostumados a "voltar" do navegador.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Delete') return;
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const tag = t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable) return;
      const store = useCanvasStore.getState();
      const id = store.selectedId;
      if (!id) return;
      e.preventDefault();
      if (store.nodes.some((n) => n.id === id)) store.deleteNode(id);
      else if (store.edges.some((edge) => edge.id === id)) store.deleteEdge(id);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const onNovo = () => {
    const ok = window.confirm(
      'Limpar tudo e começar um novo plano?\n\nEsta ação não pode ser desfeita ' +
        '(mas você pode exportar antes).',
    );
    if (!ok) return;
    loadPlanoAcao(planoVazio());
  };

  const onImportar = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        const text = await f.text();
        const parsed: unknown = JSON.parse(text);
        const result = PlanoSchema.safeParse(parsed);
        if (!result.success) {
          window.alert(
            'JSON inválido: o arquivo não tem o formato esperado do PlanejoEproc v1.\n\n' +
              (result.error.issues[0]?.message ?? ''),
          );
          return;
        }
        const store = useCanvasStore.getState();
        const naoVazio = store.nodes.length > 0 || store.edges.length > 0;
        if (
          naoVazio &&
          !window.confirm('Importar substituirá o plano atual. Continuar?')
        )
          return;
        store.loadPlano(result.data);
      } catch (e) {
        window.alert('Falha ao importar: ' + (e as Error).message);
      }
    };
    input.click();
  };

  const onExportar = () => {
    const plano = {
      ...useCanvasStore.getState().getPlano(),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(plano, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const safeName =
      (plano.planoNome || 'plano')
        .replace(/[^\p{L}\p{N}_-]+/gu, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase() || 'plano';
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 0);
  };

  const criarNoCentro = () => {
    createNode({
      x: 200 + Math.random() * 80,
      y: 120 + Math.random() * 80,
    });
  };

  const painelAberto = !!(selectedNode || selectedEdge);

  return (
    <div className="flex flex-col h-screen">
      <Header
        planoNome={planoNome}
        onPlanoNomeChange={setPlanoNome}
        onNovo={onNovo}
        onImportar={onImportar}
        onExportar={onExportar}
        onChecklist={() => setShowChecklist(true)}
        flowMode={flowMode}
        onFlowModeChange={setFlowMode}
        stats={stats}
      />

      <div className="flex flex-1 min-h-0">
        <Sidebar onCreateNode={criarNoCentro} />

        <ReactFlowProvider>
          <FlowCanvas />
        </ReactFlowProvider>

        <aside
          className="no-print bg-superficie overflow-hidden flex-shrink-0"
          style={{
            width: painelAberto ? 380 : 0,
            borderLeft: painelAberto ? '1px solid var(--borda)' : 'none',
            transition: 'width .15s ease',
          }}
        >
          {selectedNode && <NodePanel key={selectedNode.id} node={selectedNode} />}
          {selectedEdge && <EdgePanel key={selectedEdge.id} edge={selectedEdge} />}
        </aside>
      </div>

      <ChecklistModal open={showChecklist} onClose={() => setShowChecklist(false)} />
    </div>
  );
}
