import { useCallback, useEffect, useMemo, useState } from 'react';
import { ReactFlowProvider } from 'reactflow';

import { Header, type HeaderStats } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { EdgePanel } from '@/features/canvas/components/EdgePanel';
import { FlowCanvas } from '@/features/canvas/components/FlowCanvas';
import { NodePanel } from '@/features/canvas/components/NodePanel';
import { cancelPersist, flushPersist, useCanvasStore } from '@/features/canvas/store';
import { CatalogoOrgaoModal } from '@/features/catalogo/components/CatalogoOrgaoModal';
import { ChecklistModal } from '@/features/checklist/components/ChecklistModal';
import {
  PLANO_BUNDLE_VERSION,
  PlanoBundleSchema,
  PlanoSchema,
  type PlanIndexEntry,
  criarPlano,
  duplicarPlano,
  excluirPlano,
  getAtivoId,
  importarPlano,
  importarPlanos,
  listPlanos,
  loadPlano,
  planoVazio,
  renomearPlano,
  setAtivo,
} from '@/infra/storage';

/**
 * Composição principal do app — Header + Sidebar + canvas + painel direito
 * condicional + modal de checklist. Conecta todos os handlers à store, gerencia
 * o universo multi-plano (lista, ativo, criação, switch, renomear, duplicar,
 * excluir, importar/exportar via arquivo) e implementa atalho Delete e flush
 * de persistência no unload.
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
  const [showCatalogoOrgao, setShowCatalogoOrgao] = useState(false);

  // Espelha o índice de planos do storage. Atualizamos via refreshPlanos()
  // após cada operação de criar/abrir/duplicar/renomear/excluir/switch.
  // O nome do ativo pode estar 300ms defasado (debounce), mas o switcher
  // exibe `planoNome` (ao vivo) para o ativo e o nome do índice para o resto.
  const [planos, setPlanos] = useState<PlanIndexEntry[]>([]);
  const [ativoId, setAtivoId] = useState<string | null>(null);

  const refreshPlanos = useCallback(() => {
    setPlanos(listPlanos());
    setAtivoId(getAtivoId());
  }, []);

  useEffect(() => {
    refreshPlanos();
  }, [refreshPlanos]);

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

  /* ============================================================================
   * Ações de plano
   *
   * Padrão: flushPersist() antes de qualquer operação que troque o ativo, para
   * garantir que o estado do plano que está saindo de cena seja gravado no
   * slot certo. Para excluir o ativo, usamos cancelPersist() — não queremos
   * gravar lixo no slot recém-criado pela troca de ACTIVE.
   * ========================================================================== */

  const onNovo = () => {
    flushPersist();
    const { plano } = criarPlano();
    loadPlanoAcao(plano);
    refreshPlanos();
  };

  const onSwitchPlano = (id: string) => {
    if (id === ativoId) return;
    flushPersist();
    setAtivo(id);
    loadPlanoAcao(loadPlano(id));
    refreshPlanos();
  };

  const onRenomearPlano = (id: string) => {
    const entry = planos.find((p) => p.id === id);
    if (!entry) return;
    const nomeAtual = id === ativoId ? planoNome : entry.nome;
    const novo = window.prompt('Renomear plano:', nomeAtual);
    if (novo === null) return;
    const nomeFinal = novo.trim();
    if (!nomeFinal || nomeFinal === nomeAtual) return;

    if (id === ativoId) {
      // Para o ativo, a fonte da verdade do nome é a store; flushPersist
      // garante que o índice reflita imediatamente para o switcher.
      setPlanoNome(nomeFinal);
      flushPersist();
    } else {
      renomearPlano(id, nomeFinal);
    }
    refreshPlanos();
  };

  const onDuplicarPlano = (id: string) => {
    flushPersist();
    const result = duplicarPlano(id);
    if (!result) return;
    loadPlanoAcao(loadPlano(result.id));
    refreshPlanos();
  };

  const onExcluirPlano = (id: string) => {
    const entry = planos.find((p) => p.id === id);
    if (!entry) return;
    const nome = id === ativoId ? planoNome : entry.nome;
    const ok = window.confirm(
      `Excluir o plano "${nome}"?\n\nEsta ação não pode ser desfeita.`,
    );
    if (!ok) return;

    const eraAtivo = id === ativoId;
    // Quando excluímos o ativo, descartamos qualquer save pendente — caso
    // contrário ele seria gravado no slot do próximo ativo (corrupção).
    if (eraAtivo) cancelPersist();

    excluirPlano(id);

    if (eraAtivo) {
      const novoAtivoId = getAtivoId();
      loadPlanoAcao(
        novoAtivoId !== null ? loadPlano(novoAtivoId) : planoVazio(),
      );
    }
    refreshPlanos();
  };

  const onAbrirArquivo = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        const text = await f.text();
        const parsed: unknown = JSON.parse(text);

        // Tenta bundle antes do plano único: o discriminador `kind` evita
        // ambiguidade (planos individuais não têm esse campo).
        const bundleResult = PlanoBundleSchema.safeParse(parsed);
        if (bundleResult.success) {
          if (bundleResult.data.plans.length === 0) {
            window.alert('O bundle está vazio — nenhum plano para importar.');
            return;
          }
          flushPersist();
          importarPlanos(bundleResult.data.plans);
          const novoAtivoId = getAtivoId();
          loadPlanoAcao(
            novoAtivoId !== null ? loadPlano(novoAtivoId) : planoVazio(),
          );
          refreshPlanos();
          return;
        }

        const planoResult = PlanoSchema.safeParse(parsed);
        if (planoResult.success) {
          flushPersist();
          importarPlano(planoResult.data);
          loadPlanoAcao(planoResult.data);
          refreshPlanos();
          return;
        }

        window.alert(
          'JSON inválido: o arquivo não tem o formato esperado do PlanejoEproc v1 (plano único nem bundle).\n\n' +
            (planoResult.error.issues[0]?.message ?? ''),
        );
      } catch (e) {
        window.alert('Falha ao importar: ' + (e as Error).message);
      }
    };
    input.click();
  };

  // Helpers de download — extraídos para evitar duplicação entre o caminho
  // de plano único e o de bundle. `safeFileName` produz um slug ASCII que
  // sobrevive a sistemas de arquivo restritivos.
  const safeFileName = (raw: string, fallback: string): string => {
    const slug = raw
      .replace(/[^\p{L}\p{N}_-]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
    return slug || fallback;
  };

  const downloadJson = (filename: string, payload: unknown) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 0);
  };

  const onSalvarCopiaAtivo = () => {
    const plano = {
      ...useCanvasStore.getState().getPlano(),
      exportedAt: new Date().toISOString(),
    };
    const today = new Date().toISOString().slice(0, 10);
    const nome = safeFileName(plano.planoNome || 'plano', 'plano');
    downloadJson(`${nome}-${today}.json`, plano);
  };

  const onSalvarTodos = () => {
    // flushPersist garante que o ativo, que pode ter saves pendentes, esteja
    // gravado antes de lermos do storage.
    flushPersist();
    const entries = listPlanos();
    if (entries.length === 0) {
      window.alert('Nenhum plano salvo no navegador.');
      return;
    }
    const plans = entries.map((e) => loadPlano(e.id));
    const bundle = {
      kind: 'planejoeproc-bundle' as const,
      version: PLANO_BUNDLE_VERSION,
      exportedAt: new Date().toISOString(),
      plans,
    };
    const today = new Date().toISOString().slice(0, 10);
    downloadJson(`planejoeproc-bundle-${today}.json`, bundle);
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
        planos={planos}
        ativoId={ativoId}
        onSwitchPlano={onSwitchPlano}
        onRenomearPlano={onRenomearPlano}
        onDuplicarPlano={onDuplicarPlano}
        onExcluirPlano={onExcluirPlano}
        onNovo={onNovo}
        onAbrirArquivo={onAbrirArquivo}
        onSalvarCopiaAtivo={onSalvarCopiaAtivo}
        onSalvarTodos={onSalvarTodos}
        onCatalogoOrgao={() => setShowCatalogoOrgao(true)}
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

      <CatalogoOrgaoModal
        open={showCatalogoOrgao}
        onClose={() => setShowCatalogoOrgao(false)}
      />
      <ChecklistModal open={showChecklist} onClose={() => setShowChecklist(false)} />
    </div>
  );
}
