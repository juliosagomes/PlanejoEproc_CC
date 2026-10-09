import { useMemo } from 'react';
import { nomeDaPonta } from '@/domain';
import { EVENTOS } from '@/data';
import { Icon } from '@/components/Icon';
import { PanelHeader } from '@/components/PanelHeader';
import { SugestoesInput } from '@/components/SugestoesInput';
import type { EntradaFlow } from '../pecasQuadro';
import { useCanvasStore } from '../store';

const SUGESTOES_EVENTO = EVENTOS.map((e) => ({ valor: e.label }));

/**
 * Painel de uma entrada por evento (decisoes.md#D-38). A regra não mora aqui:
 * mora na seta que sai da entrada, e é lá que se detalha.
 */
export function EntradaPanel({ entrada }: { entrada: EntradaFlow }) {
  const atualizarEntrada = useCanvasStore((s) => s.atualizarEntrada);
  const removerPeca = useCanvasStore((s) => s.removerPeca);
  const setSelectedId = useCanvasStore((s) => s.setSelectedId);
  const somenteLeitura = useCanvasStore((s) => s.somenteLeitura);
  const edges = useCanvasStore((s) => s.edges);
  const nodes = useCanvasStore((s) => s.nodes);
  const grupos = useCanvasStore((s) => s.grupos);
  const saindo = useMemo(() => edges.filter((e) => e.source === entrada.id), [edges, entrada.id]);

  return (
    <div className="flex flex-col h-full">
      <PanelHeader
        eyebrow="Entrada por evento"
        title={entrada.rotulo.trim() || 'Evento?'}
        right={
          somenteLeitura ? undefined : (
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => removerPeca(entrada.id)}
              title="Remove a entrada e as setas que saem dela"
            >
              <Icon.Trash /> Remover
            </button>
          )
        }
      />
      <fieldset disabled={somenteLeitura} className="contents">
        <div className="flex-1 overflow-auto scroll p-4 flex flex-col gap-3.5">
          <p className="text-[12px] text-texto-2 leading-relaxed m-0">
            Para regra de origem “Nenhum”: o Eproc a dispara pelo evento, venha o
            processo de onde vier. Puxe a seta da alça direita até o localizador
            de destino e detalhe a regra na seta, como em qualquer transição.
          </p>
          <div>
            <label className="label" htmlFor={`entrada-${entrada.id}`}>
              Evento
            </label>
            <SugestoesInput
              id={`entrada-${entrada.id}`}
              className="input"
              value={entrada.rotulo}
              autoFocus={!somenteLeitura}
              sugestoes={SUGESTOES_EVENTO}
              onValueChange={(v) => atualizarEntrada(entrada.id, v)}
              placeholder="Ex.: Classe Processual Retificada"
            />
          </div>
          <div>
            <span className="label">
              Setas <span className="mono text-texto-3 normal-case tracking-normal">{saindo.length}</span>
            </span>
            {saindo.length === 0 ? (
              <div className="text-[11.5px] text-texto-3 leading-snug">
                Nenhuma ainda. Sem seta, a entrada não leva a lugar nenhum.
              </div>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {saindo.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      className="text-[12px] text-texto-2 hover:text-texto hover:underline text-left"
                      onClick={() => setSelectedId(e.id)}
                    >
                      → {nomeDaPonta(nodes, grupos, e.target) || 'sem nome'}
                      {(e.data?.subitems.length ?? 0) > 0 && (
                        <span className="text-texto-3"> · {e.data?.subitems.length} recurso(s)</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </fieldset>
    </div>
  );
}
