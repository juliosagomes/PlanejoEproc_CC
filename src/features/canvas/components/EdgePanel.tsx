import { useState } from 'react';
import {
  KIND_LABELS,
  SUBITEM_CATS,
  type EdgeData,
  type EdgeKind,
  type Subitem,
  type SubitemCategoria,
} from '@/domain';
import { Icon } from '@/components/Icon';
import { PanelHeader } from '@/components/PanelHeader';
import { cn } from '@/utils/cn';
import { uid } from '@/utils/uid';
import { defaultEdgeData, useCanvasStore, type FlowEdge } from '../store';
import { EdgeDetailModal } from './EdgeDetailModal';

interface EdgePanelProps {
  edge: FlowEdge;
}

export function EdgePanel({ edge }: EdgePanelProps) {
  const updateEdge = useCanvasStore((s) => s.updateEdge);
  const deleteEdge = useCanvasStore((s) => s.deleteEdge);

  const data: EdgeData = edge.data ?? defaultEdgeData();
  const kind = data.kind;
  const subitems = data.subitems;

  const [detalheAberto, setDetalheAberto] = useState(false);

  const setKind = (novo: EdgeKind) => {
    if (novo === 'manual') {
      updateEdge(edge.id, { kind: 'manual', subitems: [] });
    } else {
      updateEdge(edge.id, { kind: novo });
    }
  };

  const updateSub = (idx: number, patch: Partial<Subitem>) => {
    const next = subitems.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    updateEdge(edge.id, { subitems: next });
  };
  const addSub = () => {
    const novo: Subitem = {
      id: uid('si'),
      categoria: 'Modelo',
      nome: '',
      ja_criado: false,
    };
    updateEdge(edge.id, { subitems: [...subitems, novo] });
  };
  const removeSub = (idx: number) =>
    updateEdge(edge.id, { subitems: subitems.filter((_, i) => i !== idx) });

  return (
    <>
      <div className="flex flex-col h-full">
        <PanelHeader
          eyebrow="Aresta · Transição"
          title={KIND_LABELS[kind]}
          right={
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => deleteEdge(edge.id)}
            >
              <Icon.Trash /> Remover
            </button>
          }
        />
        <div className="flex-1 overflow-auto scroll p-4 flex flex-col gap-3.5">
          <div>
            <label className="label">Tipo</label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                className={cn('edge-swatch atp', kind === 'atp' && 'active')}
                onClick={() => setKind('atp')}
                aria-pressed={kind === 'atp'}
              >
                <span className="line" />
                <span>ATP</span>
              </button>
              <button
                type="button"
                className={cn('edge-swatch pref', kind === 'pref' && 'active')}
                onClick={() => setKind('pref')}
                aria-pressed={kind === 'pref'}
              >
                <span className="line" />
                <span>Preferência</span>
              </button>
              <button
                type="button"
                className={cn('edge-swatch manual', kind === 'manual' && 'active')}
                onClick={() => setKind('manual')}
                aria-pressed={kind === 'manual'}
              >
                <span className="line" />
                <span>Manual</span>
              </button>
            </div>
          </div>

          {kind !== 'manual' && (
            <button
              type="button"
              className="btn btn-sm w-full justify-center"
              onClick={() => setDetalheAberto(true)}
              title={`Abrir detalhamento da ${kind === 'pref' ? 'preferência' : 'ATP'}`}
            >
              <Icon.Bolt /> Detalhar {kind === 'pref' ? 'Preferência' : 'ATP'}
            </button>
          )}

          <div>
            <label className="label">Resumo</label>
            <textarea
              className="textarea"
              rows={2}
              placeholder="Em uma frase: o que esta transição faz…"
              value={data.resumo}
              onChange={(e) => updateEdge(edge.id, { resumo: e.target.value })}
            />
          </div>

          {kind !== 'manual' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label" style={{ marginBottom: 0 }}>
                  Recursos atrelados
                  {subitems.length > 0 && (
                    <span
                      className="mono ml-2 text-[10.5px] font-medium normal-case tracking-normal text-texto-3"
                    >
                      {subitems.filter((s) => s.ja_criado).length} de {subitems.length}{' '}
                      criados
                    </span>
                  )}
                </label>
                <button type="button" className="btn btn-sm" onClick={addSub}>
                  <Icon.Plus /> Adicionar
                </button>
              </div>
              {subitems.length === 0 && (
                <div
                  className="text-center text-texto-3"
                  style={{
                    padding: '10px 12px',
                    border: '1px dashed var(--borda-forte)',
                    borderRadius: 8,
                    fontSize: 12,
                    background: 'var(--superficie-2)',
                  }}
                >
                  Liste aqui os recursos do Eproc que esta transição precisa. Marque ✓
                  conforme criar cada um.
                </div>
              )}
              <div>
                {subitems.map((s, i) => (
                  <div key={s.id} className={cn('subitem', s.ja_criado && 'created')}>
                    <input
                      type="checkbox"
                      className="pj-check"
                      checked={s.ja_criado}
                      onChange={(e) => updateSub(i, { ja_criado: e.target.checked })}
                      title="Marcar como criado no Eproc"
                    />
                    <select
                      className="select"
                      style={{ height: 26, padding: '2px 6px', fontSize: 11.5 }}
                      value={s.categoria}
                      onChange={(e) =>
                        updateSub(i, { categoria: e.target.value as SubitemCategoria })
                      }
                    >
                      {SUBITEM_CATS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <input
                        className="input"
                        style={{ height: 26, padding: '2px 6px', fontSize: 12 }}
                        placeholder="Nome do recurso"
                        value={s.nome}
                        onChange={(e) => updateSub(i, { nome: e.target.value })}
                      />
                      <input
                        className="input text-texto-2"
                        style={{ height: 22, padding: '2px 6px', fontSize: 11 }}
                        placeholder="descrição (opcional)"
                        value={s.descricao ?? ''}
                        onChange={(e) => updateSub(i, { descricao: e.target.value })}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn-icon btn-sm btn-ghost"
                      onClick={() => removeSub(i)}
                      title="Remover"
                    >
                      <Icon.X />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="label">Observação</label>
            <textarea
              className="textarea"
              rows={3}
              value={data.observacao}
              onChange={(e) => updateEdge(edge.id, { observacao: e.target.value })}
              placeholder="Notas livres sobre esta transição…"
            />
          </div>
        </div>
      </div>

      <EdgeDetailModal
        open={detalheAberto && kind !== 'manual'}
        onClose={() => setDetalheAberto(false)}
        edgeData={data}
        onChange={(patch) => updateEdge(edge.id, patch)}
      />
    </>
  );
}
