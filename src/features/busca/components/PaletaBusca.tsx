import { useEffect, useMemo, useRef, useState, type KeyboardEvent as TeclaReact, type ReactNode } from 'react';
import { useReactFlow } from 'reactflow';

import { KIND_LABELS } from '@/domain';
import { Icon } from '@/components/Icon';
import { useIrParaNo } from '@/features/canvas/irParaNo';
import { useCanvasStore } from '@/features/canvas/store';
import { buscarNoQuadro, pontuar, trechoCasado, type ResultadosBusca } from '../buscar';
import { useBuscaStore } from '../store';

/** Comando que o App oferece: só ele conhece checklist, sincronização, menus. */
export interface ComandoBusca {
  id: string;
  rotulo: string;
  icone: ReactNode;
  executar: () => void;
}

interface Item {
  chave: string;
  grupo: string;
  icone: ReactNode;
  conteudo: ReactNode;
  direita?: ReactNode;
  executar: () => void;
}

interface PaletaBuscaProps {
  comandos: ComandoBusca[];
}

/**
 * A paleta do Ctrl+K (decisoes.md#D-43): localizadores, transições, setores e
 * comandos numa lista só. Mora dentro do `ReactFlowProvider` porque escolher
 * um resultado mexe na câmera.
 */
export function PaletaBusca({ comandos }: PaletaBuscaProps) {
  const aberta = useBuscaStore((s) => s.aberta);
  useAtalhosDeTeclado();
  if (!aberta) return null;
  return <Paleta comandos={comandos} />;
}

function ehCampoDeTexto(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
}

/**
 * Ctrl+K abre e fecha em qualquer lugar do quadro; "/" só fora de campo de
 * texto, onde a barra é um caractere como outro. Com outro diálogo na frente,
 * nenhum dos dois abre: a paleta empilharia em cima dele.
 */
function useAtalhosDeTeclado() {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const { aberta, abrir, alternar } = useBuscaStore.getState();
      const outroDialogo = !aberta && document.querySelector('[aria-modal="true"]') !== null;
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        if (outroDialogo) return;
        e.preventDefault();
        alternar();
        return;
      }
      if (e.key === '/' && !aberta && !outroDialogo && !ehCampoDeTexto(e.target) && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        abrir();
      }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);
}

function Destaque({ texto, consulta }: { texto: string; consulta: string }) {
  const t = trechoCasado(texto, consulta);
  if (!t) return <>{texto}</>;
  return (
    <>
      {texto.slice(0, t.inicio)}
      <mark>{texto.slice(t.inicio, t.fim)}</mark>
      {texto.slice(t.fim)}
    </>
  );
}

/** Onde nasce o localizador criado pela busca: no meio do que o usuário está vendo. */
function useCentroDaTela() {
  const { screenToFlowPosition } = useReactFlow();
  return () => {
    const r = document.querySelector('.react-flow')?.getBoundingClientRect();
    if (!r) return { x: 200, y: 120 };
    const p = screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    // O nó é posicionado pelo canto; meio nó para trás deixa o centro dele no centro da tela.
    return { x: p.x - 90, y: p.y - 25 };
  };
}

/** Os comandos que precisam da câmera ou da seleção — por isso moram aqui, e não no App. */
function useComandosDoQuadro(centroDaTela: () => { x: number; y: number }): ComandoBusca[] {
  const { fitView } = useReactFlow();
  const somenteLeitura = useCanvasStore((s) => s.somenteLeitura);
  const selecionados = useCanvasStore((s) => s.nodes).filter((n) => n.selected);
  const lista: ComandoBusca[] = [];
  if (!somenteLeitura) {
    lista.push({
      id: 'novo-localizador',
      rotulo: 'Novo localizador',
      icone: <Icon.Plus />,
      executar: () => void useCanvasStore.getState().createNode(centroDaTela()),
    });
  }
  lista.push({
    id: 'enquadrar',
    rotulo: 'Enquadrar o fluxo inteiro',
    icone: <Icon.Enquadrar />,
    executar: () => void fitView({ padding: 0.2, maxZoom: 1, duration: 400 }),
  });
  if (!somenteLeitura && selecionados.length > 0) {
    lista.push({
      id: 'agrupar',
      rotulo: `Agrupar a seleção numa moldura (${selecionados.length})`,
      icone: <Icon.Folder />,
      executar: () => void useCanvasStore.getState().criarGrupo(selecionados.map((n) => n.id)),
    });
  }
  return lista;
}

function useItens(consulta: string, resultados: ResultadosBusca, comandos: ComandoBusca[]): Item[] {
  const irParaNo = useIrParaNo();
  const { getNode, setCenter, getZoom } = useReactFlow();
  const setFiltroFlags = useCanvasStore((s) => s.setFiltroFlags);

  const irParaAresta = (id: string, source: string, target: string) => {
    const a = getNode(source);
    const b = getNode(target);
    const centro = (n: typeof a) =>
      n ? { x: (n.positionAbsolute?.x ?? n.position.x) + (n.width ?? 180) / 2, y: (n.positionAbsolute?.y ?? n.position.y) + (n.height ?? 50) / 2 } : null;
    const ca = centro(a);
    const cb = centro(b);
    const alvo = ca && cb ? { x: (ca.x + cb.x) / 2, y: (ca.y + cb.y) / 2 } : ca ?? cb;
    if (alvo) setCenter(alvo.x, alvo.y, { zoom: Math.max(getZoom(), 0.9), duration: 400 });
    useCanvasStore.getState().setSelectedId(id);
  };

  const itens: Item[] = [];
  for (const l of resultados.localizadores) {
    itens.push({
      chave: `l:${l.id}`,
      grupo: 'Localizadores',
      icone: <Icon.Alvo />,
      conteudo: (
        <>
          <Destaque texto={l.nome} consulta={consulta} />
          {l.grupoRecolhido && <span className="busca-sub">no grupo recolhido "{l.grupoRecolhido.rotulo}"</span>}
        </>
      ),
      direita: (
        <>
          {l.setores.map((s) => (
            <span key={s.id} className={`flag-chip flag-cor-${s.cor}`} title={s.label}>
              {s.code}
            </span>
          ))}
          <span title={`${l.entradas} transições chegam, ${l.saidas} saem`}>
            {l.entradas}↘ {l.saidas}↗
          </span>
        </>
      ),
      executar: () => irParaNo(l.grupoRecolhido?.id ?? l.id),
    });
  }
  for (const t of resultados.transicoes) {
    itens.push({
      chave: `t:${t.id}`,
      grupo: 'Transições',
      icone: <Icon.Seta />,
      conteudo: (
        <>
          <Destaque texto={t.titulo} consulta={consulta} />
          {t.recursoCasado && (
            <span className="busca-sub">
              recurso <Destaque texto={t.recursoCasado} consulta={consulta} />
            </span>
          )}
          <span className="busca-sub">
            {t.origem} → {t.destino}
          </span>
        </>
      ),
      direita: <span className={`busca-selo busca-selo-${t.kind}`}>{KIND_LABELS[t.kind]}</span>,
      executar: () => irParaAresta(t.id, t.source, t.target),
    });
  }
  for (const s of resultados.setores) {
    itens.push({
      chave: `s:${s.setor.id}`,
      grupo: 'Setores',
      icone: <span className={`flag-chip flag-cor-${s.setor.cor}`}>{s.setor.code}</span>,
      conteudo: (
        <>
          Realçar <Destaque texto={s.setor.label} consulta={consulta} /> no quadro
        </>
      ),
      direita: <span>{s.total === 1 ? '1 localizador' : `${s.total} localizadores`}</span>,
      executar: () => setFiltroFlags([s.setor.id]),
    });
  }
  for (const c of comandos) {
    if (pontuar(c.rotulo, consulta) === null) continue;
    itens.push({
      chave: `c:${c.id}`,
      grupo: 'Comandos',
      icone: c.icone,
      conteudo: <Destaque texto={c.rotulo} consulta={consulta} />,
      executar: c.executar,
    });
  }
  return itens;
}

function Paleta({ comandos }: PaletaBuscaProps) {
  const fechar = useBuscaStore((s) => s.fechar);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const grupos = useCanvasStore((s) => s.grupos);
  const setores = useCanvasStore((s) => s.flags);
  const somenteLeitura = useCanvasStore((s) => s.somenteLeitura);
  const centroDaTela = useCentroDaTela();

  const [consulta, setConsulta] = useState('');
  const [sel, setSel] = useState(0);
  const listaRef = useRef<HTMLDivElement>(null);
  const paletaRef = useRef<HTMLDivElement>(null);
  const entradaRef = useRef<HTMLInputElement>(null);

  // Prende o foco na paleta. Sem isto, o seletor de nome do painel do
  // localizador (react-select) toma o foco de volta assim que o perde, e o que
  // se digita na busca vai renomear o localizador.
  useEffect(() => {
    const prender = (e: FocusEvent) => {
      if (paletaRef.current && !paletaRef.current.contains(e.target as Node)) entradaRef.current?.focus();
    };
    document.addEventListener('focusin', prender);
    entradaRef.current?.focus();
    return () => document.removeEventListener('focusin', prender);
  }, []);

  // Quem tinha o foco antes recebe de volta ao fechar sem escolher nada.
  const focoAnterior = useRef<Element | null>(document.activeElement);
  useEffect(() => {
    const anterior = focoAnterior.current;
    return () => {
      if (anterior instanceof HTMLElement && anterior.isConnected) anterior.focus();
    };
  }, []);

  const resultados = useMemo(
    () => buscarNoQuadro({ nodes, edges: edges.map(arestaDeBusca), grupos, setores }, consulta),
    [nodes, edges, grupos, setores, consulta],
  );
  const doQuadro = useComandosDoQuadro(centroDaTela);
  const itens = useItens(consulta, resultados, [...doQuadro, ...comandos]);
  const atual = Math.min(sel, Math.max(0, itens.length - 1));

  useEffect(() => {
    listaRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [atual]);

  const executar = (item: Item | undefined) => {
    if (!item) return;
    fechar();
    item.executar();
  };

  const criarComNome = () => {
    const nome = consulta.trim();
    fechar();
    const store = useCanvasStore.getState();
    const id = store.createNode(centroDaTela());
    if (id) store.updateNode(id, { nome });
  };

  const onKeyDown = (e: TeclaReact) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      fechar();
    } else if (e.key === 'ArrowDown' && itens.length > 0) {
      e.preventDefault();
      setSel((atual + 1) % itens.length);
    } else if (e.key === 'ArrowUp' && itens.length > 0) {
      e.preventDefault();
      setSel((atual - 1 + itens.length) % itens.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (itens.length > 0) executar(itens[atual]);
      else if (!somenteLeitura && consulta.trim()) criarComNome();
    }
  };

  return (
    <div className="scrim busca-scrim" onMouseDown={(e) => e.target === e.currentTarget && fechar()}>
      <div className="busca-paleta" role="dialog" aria-modal="true" aria-label="Busca e comandos" ref={paletaRef}>
        <div className="busca-entrada">
          <Icon.Busca width={16} height={16} />
          <input
            ref={entradaRef}
            value={consulta}
            onChange={(e) => {
              setConsulta(e.target.value);
              setSel(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Buscar localizador, transição, setor ou comando…"
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded="true"
            aria-controls="busca-lista"
            aria-activedescendant={itens.length > 0 ? `busca-op-${atual}` : undefined}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="busca-lista" id="busca-lista" role="listbox" ref={listaRef} aria-label="Resultados">
          {itens.length === 0 ? (
            <Vazio consulta={consulta} podeCriar={!somenteLeitura} onCriar={criarComNome} />
          ) : (
            itens.map((item, i) => (
              <div key={item.chave}>
                {item.grupo !== itens[i - 1]?.grupo && (
                  <div className="busca-grupo" role="presentation">
                    {item.grupo}
                  </div>
                )}
                <div
                  id={`busca-op-${i}`}
                  className="busca-item"
                  role="option"
                  aria-selected={i === atual}
                  onMouseMove={() => i !== atual && setSel(i)}
                  onClick={() => executar(item)}
                >
                  <span className="busca-ico">{item.icone}</span>
                  <span className="busca-texto">{item.conteudo}</span>
                  {item.direita && <span className="busca-dir">{item.direita}</span>}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="busca-rodape" aria-hidden>
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> navegar
          </span>
          <span>
            <kbd>Enter</kbd> abrir
          </span>
          <span>
            <kbd>Esc</kbd> fechar
          </span>
        </div>
      </div>
    </div>
  );
}

function Vazio({ consulta, podeCriar, onCriar }: { consulta: string; podeCriar: boolean; onCriar: () => void }) {
  const nome = consulta.trim();
  return (
    <div className="busca-vazio">
      Nada encontrado para "{consulta}".
      {podeCriar && nome && (
        <div>
          <button type="button" className="btn btn-sm mt-2.5" onClick={onCriar}>
            <Icon.Plus /> Criar localizador "{nome}"
          </button>
        </div>
      )}
    </div>
  );
}

// O `data` da aresta é opcional no tipo do ReactFlow; a busca só lê três campos.
function arestaDeBusca(e: ReturnType<typeof useCanvasStore.getState>['edges'][number]) {
  return { id: e.id, source: e.source, target: e.target, ...(e.data ? { data: e.data } : {}) };
}
