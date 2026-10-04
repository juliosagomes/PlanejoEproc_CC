import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { useCanvasStore } from '../store';
import { confirmarApagarSelecao } from '../selecao';

/**
 * Barra que substitui o painel de detalhes quando há dois ou mais itens
 * selecionados no canvas (Card 7). Só aparece com seleção múltipla: com um item,
 * o painel lateral é o lugar de editar.
 */
export function SelecaoLoteBar() {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const flags = useCanvasStore((s) => s.flags);
  const somenteLeitura = useCanvasStore((s) => s.somenteLeitura);
  const setSelectedId = useCanvasStore((s) => s.setSelectedId);
  const moverNos = useCanvasStore((s) => s.moverNos);
  const marcarFlagEmLote = useCanvasStore((s) => s.marcarFlagEmLote);
  const deleteSelecao = useCanvasStore((s) => s.deleteSelecao);
  const criarGrupo = useCanvasStore((s) => s.criarGrupo);

  const [setoresAberto, setSetoresAberto] = useState(false);
  const setoresRef = useRef<HTMLDivElement>(null);

  const nos = nodes.filter((n) => n.selected);
  const arestas = edges.filter((e) => e.selected);
  const total = nos.length + arestas.length;

  useEffect(() => {
    if (!setoresAberto) return;
    const fechar = (e: MouseEvent) => {
      if (!setoresRef.current?.contains(e.target as Node)) setSetoresAberto(false);
    };
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, [setoresAberto]);

  if (total < 2) return null;

  const alinhar = (eixo: 'x' | 'y') => {
    const alvo = Math.min(...nos.map((n) => n.position[eixo]));
    moverNos(
      Object.fromEntries(nos.map((n) => [n.id, { ...n.position, [eixo]: alvo }])),
    );
  };

  const rotulo = [
    nos.length > 0 && `${nos.length} localizador${nos.length > 1 ? 'es' : ''}`,
    arestas.length > 0 && `${arestas.length} transiç${arestas.length > 1 ? 'ões' : 'ão'}`,
  ]
    .filter(Boolean)
    .join(' e ');

  return (
    <div className="selecao-lote no-print" role="toolbar" aria-label="Ações na seleção">
      <span className="selecao-lote-n">{rotulo}</span>
      {!somenteLeitura && nos.length >= 2 && (
        <>
          <button type="button" className="selecao-lote-btn" onClick={() => alinhar('x')} title="Alinhar à esquerda, em coluna">
            Alinhar em coluna
          </button>
          <button type="button" className="selecao-lote-btn" onClick={() => alinhar('y')} title="Alinhar pelo topo, em linha">
            Alinhar em linha
          </button>
        </>
      )}
      {!somenteLeitura && nos.length >= 1 && (
        <button
          type="button"
          className="selecao-lote-btn"
          onClick={() => criarGrupo(nos.map((n) => n.id))}
          title="Cria uma moldura em volta dos localizadores selecionados"
        >
          Agrupar
        </button>
      )}
      {!somenteLeitura && nos.length >= 1 && flags.length > 0 && (
        <div className="relative" ref={setoresRef}>
          <button
            type="button"
            className="selecao-lote-btn"
            aria-haspopup="menu"
            aria-expanded={setoresAberto}
            onClick={() => setSetoresAberto((v) => !v)}
          >
            Setor <Icon.ChevronDown />
          </button>
          {setoresAberto && (
            <div role="menu" className="selecao-lote-menu">
              {flags.map((f) => {
                const comFlag = nos.filter((n) => n.data.flags.includes(f.id)).length;
                const todos = comFlag === nos.length;
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={todos ? true : comFlag > 0 ? 'mixed' : false}
                    className="selecao-lote-menu-item"
                    onClick={() => marcarFlagEmLote(nos.map((n) => n.id), f.id, !todos)}
                  >
                    <span className="selecao-lote-check" aria-hidden>
                      {todos ? '✓' : comFlag > 0 ? '–' : ''}
                    </span>
                    <span className={`flag-chip flag-cor-${f.cor}`}>{f.code}</span>
                    <span className="truncate">{f.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
      {!somenteLeitura && (
        <button
          type="button"
          className="selecao-lote-btn selecao-lote-perigo"
          onClick={() => {
            if (confirmarApagarSelecao(nos.length, arestas.length)) deleteSelecao();
          }}
          title="Apagar a seleção (Delete)"
        >
          <Icon.Trash /> Apagar
        </button>
      )}
      <button
        type="button"
        className="selecao-lote-btn"
        onClick={() => setSelectedId(null)}
        title="Limpar seleção"
        aria-label="Limpar seleção"
      >
        <Icon.X />
      </button>
    </div>
  );
}
