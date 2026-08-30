import { useCallback, useEffect, useMemo, useState } from 'react';
import { ReactFlowProvider } from 'reactflow';

import { somenteVisualizacao } from '@/domain';
import { Header, type HeaderStats } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { useSincronizacaoExterna } from '@/extension/useSincronizacaoExterna';
import { EdgePanel } from '@/features/canvas/components/EdgePanel';
import { FlowCanvas } from '@/features/canvas/components/FlowCanvas';
import { NodePanel } from '@/features/canvas/components/NodePanel';
import { cancelPersist, flushPersist, useCanvasStore } from '@/features/canvas/store';
import { CatalogoOrgaoModal } from '@/features/catalogo/components/CatalogoOrgaoModal';
import { SincronizacaoUnidadeModal } from '@/features/catalogo/components/SincronizacaoUnidadeModal';
import { useCatalogoStore } from '@/features/catalogo/store';
import { useUnidadeStore } from '@/features/catalogo/storeUnidade';
import { ChecklistModal } from '@/features/checklist/components/ChecklistModal';
import { FlagsModal } from '@/features/flags/components/FlagsModal';
import { CodigosLotacaoModal } from '@/features/sessao/components/CodigosLotacaoModal';
import { TelaLogin } from '@/features/sessao/components/TelaLogin';
import { useSessaoStore } from '@/features/sessao/store';
import { SyncResultadoModal } from '@/features/sync/components/SyncResultadoModal';
import { useSyncStore } from '@/features/sync/store';
import { TutorialModal } from '@/features/tutorial/components/TutorialModal';
import { deveAbrirNaPrimeiraVez, podeAbrirAgora } from '@/features/tutorial/abertura';
import {
  PLANO_BUNDLE_VERSION,
  PlanoBundleSchema,
  PlanoSchema,
  type PlanIndexEntry,
  criarPlano,
  duplicarPlano,
  excluirTodosPlanos,
  getAtivoId,
  importarPlano,
  importarPlanos,
  listPlanos,
  loadPlano,
  planoVazio,
  renomearPlano,
  setAtivo,
} from '@/infra/storage';
import {
  TUTORIAL_VERSAO,
  getTutorialVisto,
  marcarTutorialVisto,
} from '@/infra/storage/tutorial';
import { downloadJson, hojeIso, safeFileName } from '@/utils/download';

/**
 * Composição principal do app — Header + Sidebar + canvas + painel direito
 * condicional + modais. Conecta todos os handlers à store, gerencia o universo
 * multi-plano (lista, ativo, criação, switch, renomear, duplicar, excluir,
 * importar/exportar via arquivo) e implementa atalho Delete e flush de
 * persistência no unload.
 *
 * Antes de tudo isso vem a escolha de sessão: sem ela não há silo de
 * armazenamento apontado, então o editor não teria de onde ler nem para onde
 * gravar. Daí o único ramo de tela do app.
 */
export default function App() {
  const sessao = useSessaoStore((s) => s.sessao);

  if (sessao === null) return <TelaLogin />;
  return <Editor />;
}

function Editor() {
  const sessao = useSessaoStore((s) => s.sessao);
  const sairDaSessao = useSessaoStore((s) => s.sair);

  const sincronizando = useSyncStore((s) => s.sincronizando);
  const publicando = useSyncStore((s) => s.publicando);
  const baixarDoServidor = useSyncStore((s) => s.baixarDoServidor);
  const enviarAoServidor = useSyncStore((s) => s.enviarAoServidor);
  const excluirPlanoDaSessao = useSyncStore((s) => s.excluirPlanoDaSessao);
  const resetMensagensSync = useSyncStore((s) => s.resetMensagens);

  const planoNome = useCanvasStore((s) => s.planoNome);
  const flowMode = useCanvasStore((s) => s.flowMode);
  const selectedId = useCanvasStore((s) => s.selectedId);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const flags = useCanvasStore((s) => s.flags);
  const filtroFlags = useCanvasStore((s) => s.filtroFlags);

  const setPlanoNome = useCanvasStore((s) => s.setPlanoNome);
  const setFlowMode = useCanvasStore((s) => s.setFlowMode);
  const setFiltroFlags = useCanvasStore((s) => s.setFiltroFlags);
  const loadPlanoAcao = useCanvasStore((s) => s.loadPlano);
  const createNode = useCanvasStore((s) => s.createNode);

  const [showChecklist, setShowChecklist] = useState(false);
  const [showCatalogoOrgao, setShowCatalogoOrgao] = useState(false);
  const [showFlags, setShowFlags] = useState(false);
  // Barra lateral fica visível por padrão; a marca do cabeçalho alterna. Só
  // estado de tela: quem trabalha em monitor apertado esconde e segue.
  const [sidebarVisivel, setSidebarVisivel] = useState(true);

  /* ==========================================================================
   * Tutorial (decisoes.md#D-20)
   *
   * A decisão de abrir é tomada no **inicializador preguiçoso**, não num
   * `useEffect`. `main.tsx` só renderiza depois de `inicializarPlataforma()` e
   * `getStorage()` é síncrono, então a flag já está legível no primeiro render.
   * Um efeito desenharia o editor por um quadro e jogaria os slides na tela
   * depois — o piscar que se quer evitar.
   * ======================================================================== */
  const somenteLeitura = sessao !== null && somenteVisualizacao(sessao);
  const [tutorialPendente, setTutorialPendente] = useState(() =>
    deveAbrirNaPrimeiraVez({
      vistoVersao: getTutorialVisto(),
      versaoAtual: TUTORIAL_VERSAO,
      somenteLeitura,
    }),
  );
  const [tutorialManual, setTutorialManual] = useState(false);
  const codigosPendentes = useSessaoStore((s) => s.codigosNovaLotacao) !== null;

  const tutorialAberto =
    tutorialManual || podeAbrirAgora({ pendente: tutorialPendente, codigosPendentes });

  // Fechar por qualquer via marca como visto. Marcar só ao concluir faria de
  // "Pular" uma promessa quebrada no boot seguinte.
  const fecharTutorial = useCallback(() => {
    marcarTutorialVisto();
    setTutorialPendente(false);
    setTutorialManual(false);
  }, []);

  const hidratarCatalogoOrgao = useCatalogoStore((s) => s.hidratar);
  const hidratarCatalogoUnidade = useUnidadeStore((s) => s.hidratar);
  const sincronizarUnidade = useUnidadeStore((s) => s.sincronizar);
  const sincronizandoUnidade = useUnidadeStore((s) => s.sincronizando);
  const resetMensagensUnidade = useUnidadeStore((s) => s.resetMensagens);

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

  // Os dois catálogos só podem ser lidos DEPOIS que `main.tsx` hidratou a
  // plataforma — na extensão, o espelho do `chrome.storage` nasce vazio, e
  // qualquer leitura em tempo de módulo cairia no localStorage.
  useEffect(() => {
    hidratarCatalogoOrgao();
    hidratarCatalogoUnidade();
  }, [hidratarCatalogoOrgao, hidratarCatalogoUnidade]);

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
      if (useCanvasStore.getState().somenteLeitura) return;
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

    // Passa pela store de sync (e não pelo `excluirPlano` do storage) porque,
    // numa lotação, a exclusão precisa ficar marcada para propagar ao servidor
    // no próximo envio.
    excluirPlanoDaSessao(id);

    if (eraAtivo) {
      const novoAtivoId = getAtivoId();
      loadPlanoAcao(
        novoAtivoId !== null ? loadPlano(novoAtivoId) : planoVazio(),
      );
    }
    refreshPlanos();
  };

  /**
   * Esvazia o silo do modo local de uma vez.
   *
   * Só existe aqui (decisoes.md#D-18): numa lotação, "todos" viraria uma
   * exclusão em massa propagada ao servidor no envio seguinte, e a diferença
   * entre limpar o próprio navegador e limpar o trabalho da unidade inteira é
   * grande demais para caber no mesmo botão.
   *
   * A confirmação exige digitar APAGAR — `window.confirm` é um Enter distraído
   * de distância, e daqui não há desfazer.
   */
  const onApagarTodosPlanos = () => {
    flushPersist();
    const total = listPlanos().length;
    if (total === 0) return;

    const resposta = window.prompt(
      `Apagar ${total} plano(s) deste navegador?\n\n` +
        'Isto não pode ser desfeito, e não há cópia no servidor — o modo local ' +
        'nunca envia nada.\n\n' +
        'Para confirmar, digite APAGAR:',
    );
    if (resposta === null || resposta.trim().toUpperCase() !== 'APAGAR') return;

    // Sem cancelPersist(), o save pendente do canvas recriaria, no slot novo, o
    // plano que acabamos de apagar.
    cancelPersist();
    excluirTodosPlanos();
    const { plano } = criarPlano();
    loadPlanoAcao(plano);
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

  const onSalvarCopiaAtivo = () => {
    const plano = {
      ...useCanvasStore.getState().getPlano(),
      exportedAt: new Date().toISOString(),
    };
    const nome = safeFileName(plano.planoNome || 'plano', 'plano');
    downloadJson(`${nome}-${hojeIso()}.json`, plano);
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
    downloadJson(`planejoeproc-bundle-${hojeIso()}.json`, bundle);
  };

  /* ============================================================================
   * Sincronização
   *
   * Pull e push gravam direto no storage, fora da store do canvas — podem
   * afetar planos diferentes do ativo, ou o próprio ativo. Daí o flush antes
   * (para não perder uma edição pendente) e, no caso do pull, o recarregar
   * depois: o plano aberto no canvas pode ter sido sobrescrito ou excluído.
   * ========================================================================== */

  const onPull = useCallback(async () => {
    flushPersist();
    await baixarDoServidor();
    refreshPlanos();
    const atual = getAtivoId();
    loadPlanoAcao(atual !== null ? loadPlano(atual) : planoVazio());
  }, [baixarDoServidor, refreshPlanos, loadPlanoAcao]);

  const onPush = async () => {
    flushPersist();
    await enviarAoServidor();
    refreshPlanos();
  };

  /* ==========================================================================
   * Mundo de fora (só na extensão)
   *
   * Outra aba do editor gravou. Não há rede envolvida: só recarregar o que
   * está na tela. O service worker não escreve mais nada (decisoes.md#D-17),
   * então ele não aparece aqui.
   * ======================================================================== */

  const recarregarDoStorage = useCallback(() => {
    refreshPlanos();
    const atual = getAtivoId();
    loadPlanoAcao(atual !== null ? loadPlano(atual) : planoVazio());
  }, [refreshPlanos, loadPlanoAcao]);

  useSincronizacaoExterna({ aoMudarPlanos: recarregarDoStorage });

  const alternarFiltroFlag = useCallback(
    (id: string) => {
      const atual = useCanvasStore.getState().filtroFlags;
      setFiltroFlags(
        atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id],
      );
    },
    [setFiltroFlags],
  );

  const criarNoCentro = () => {
    createNode({
      x: 200 + Math.random() * 80,
      y: 120 + Math.random() * 80,
    });
  };

  const painelAberto = !!(selectedNode || selectedEdge);

  // `Editor` só é montado com sessão ativa (ver `App`), mas o seletor devolve
  // o tipo anulável — este guarda mantém o Header com prop não-anulável.
  if (sessao === null) return null;

  return (
    <div className="flex flex-col h-screen">
      <Header
        planoNome={planoNome}
        onPlanoNomeChange={setPlanoNome}
        sidebarVisivel={sidebarVisivel}
        onAlternarSidebar={() => setSidebarVisivel((v) => !v)}
        sessao={sessao}
        onTrocarSessao={sairDaSessao}
        somenteLeitura={somenteLeitura}
        onPull={() => void onPull()}
        onPush={() => void onPush()}
        sincronizando={sincronizando}
        publicando={publicando}
        planos={planos}
        ativoId={ativoId}
        onSwitchPlano={onSwitchPlano}
        onRenomearPlano={onRenomearPlano}
        onDuplicarPlano={onDuplicarPlano}
        onExcluirPlano={onExcluirPlano}
        onApagarTodosPlanos={
          sessao.tipo === 'local' ? onApagarTodosPlanos : undefined
        }
        onNovo={onNovo}
        onAbrirArquivo={onAbrirArquivo}
        onSalvarCopiaAtivo={onSalvarCopiaAtivo}
        onSalvarTodos={onSalvarTodos}
        onCatalogoOrgao={() => setShowCatalogoOrgao(true)}
        onSincronizarUnidade={() => void sincronizarUnidade()}
        sincronizandoUnidade={sincronizandoUnidade}
        onChecklist={() => setShowChecklist(true)}
        flowMode={flowMode}
        onFlowModeChange={setFlowMode}
        stats={stats}
      />

      <div className="flex flex-1 min-h-0">
        {sidebarVisivel && (
          <Sidebar
            onCreateNode={criarNoCentro}
            somenteLeitura={somenteLeitura}
            onVerTutorial={() => setTutorialManual(true)}
            flags={flags}
            filtroFlags={filtroFlags}
            onAlternarFiltroFlag={alternarFiltroFlag}
            onGerenciarFlags={() => setShowFlags(true)}
          />
        )}

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
          {selectedNode && (
            <NodePanel
              key={selectedNode.id}
              node={selectedNode}
              onGerenciarFlags={() => setShowFlags(true)}
            />
          )}
          {selectedEdge && <EdgePanel key={selectedEdge.id} edge={selectedEdge} />}
        </aside>
      </div>

      <CatalogoOrgaoModal
        open={showCatalogoOrgao}
        onClose={() => setShowCatalogoOrgao(false)}
      />
      <SincronizacaoUnidadeModal onFechar={resetMensagensUnidade} />
      <ChecklistModal open={showChecklist} onClose={() => setShowChecklist(false)} />
      <FlagsModal open={showFlags} onClose={() => setShowFlags(false)} />
      <SyncResultadoModal onFechar={resetMensagensSync} />
      <CodigosLotacaoModal />
      <TutorialModal open={tutorialAberto} onFechar={fecharTutorial} />
    </div>
  );
}
