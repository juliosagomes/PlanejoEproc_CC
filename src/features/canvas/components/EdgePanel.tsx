import { useState } from 'react';
import {
  FLOW_MODE_DESENHO,
  KIND_CATEGORIA,
  KIND_LABELS,
  ehRecursoRegra,
  hasDetalheSubitem,
  nomeDaPonta,
  type EdgeData,
  type EdgeKind,
  type Subitem,
} from '@/domain';
import { Icon } from '@/components/Icon';
import { PanelHeader } from '@/components/PanelHeader';
import { cn } from '@/utils/cn';
import { uid } from '@/utils/uid';
import { temDobraManual } from '../dobra';
import { useIrParaNo } from '../irParaNo';
import {
  defaultAtpRule,
  defaultEdgeData,
  defaultPrefRule,
  useCanvasStore,
  type FlowEdge,
} from '../store';
import { EdgeDetailModal } from './EdgeDetailModal';
import { RecursoCartao } from './RecursoCartao';

interface EdgePanelProps {
  edge: FlowEdge;
}

export function EdgePanel({ edge }: EdgePanelProps) {
  const updateEdge = useCanvasStore((s) => s.updateEdge);
  const deleteEdge = useCanvasStore((s) => s.deleteEdge);
  const setDobra = useCanvasStore((s) => s.setDobra);
  const somenteLeitura = useCanvasStore((s) => s.somenteLeitura);
  // As pontas da aresta são a origem e o destino da regra de ATP: o modal de
  // detalhamento as mostra em vez de pedi-las de novo.
  const origem = useCanvasStore(
    (s) => nomeDaPonta(s.nodes, s.grupos, edge.source, s.entradas),
  );
  const destino = useCanvasStore(
    (s) => nomeDaPonta(s.nodes, s.grupos, edge.target),
  );

  const irParaNo = useIrParaNo();

  const data: EdgeData = edge.data ?? defaultEdgeData();
  const kind = data.kind;
  const subitems = data.subitems;

  const [detalheAbertoId, setDetalheAbertoId] = useState<string | null>(null);
  const emDetalhe = subitems.find((s) => s.id === detalheAbertoId);

  const setKind = (novo: EdgeKind) => {
    if (novo !== 'manual') {
      updateEdge(edge.id, { kind: novo });
      return;
    }
    // Virar manual descarta os recursos — e, desde que a regra passou a ser um
    // deles (decisoes.md#D-24), isso apaga modelagem de verdade, não só
    // esconde. Daí a confirmação, que antes não fazia falta.
    if (subitems.some(hasDetalheSubitem)) {
      const ok = window.confirm(
        'Esta transição tem regra detalhada.\n\nVirar Manual remove os recursos atrelados, com o detalhamento junto. Continuar?',
      );
      if (!ok) return;
    }
    updateEdge(edge.id, { kind: 'manual', subitems: [] });
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

  /**
   * Cria a regra correspondente ao tipo da aresta e já abre o detalhamento —
   * o mesmo clique único que existia quando a regra morava na aresta. Só
   * aparece enquanto não houver nenhuma; a partir daí, quem quer uma segunda
   * usa "Adicionar" e escolhe a categoria.
   */
  const addRegraDoKind = () => {
    if (kind === 'manual') return;
    const categoria = KIND_CATEGORIA[kind];
    const novo: Subitem = {
      id: uid('si'),
      categoria,
      nome: '',
      ja_criado: false,
      ...(kind === 'atp' ? { atp: defaultAtpRule() } : { pref: defaultPrefRule() }),
    };
    updateEdge(edge.id, { subitems: [...subitems, novo] });
    setDetalheAbertoId(novo.id);
  };

  const temRegraDoKind =
    kind !== 'manual' && subitems.some((s) => s.categoria === KIND_CATEGORIA[kind]);

  return (
    <>
      <div className="flex flex-col h-full">
        <PanelHeader
          eyebrow="Transição"
          title={KIND_LABELS[kind]}
          right={
            somenteLeitura ? undefined : (
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => deleteEdge(edge.id)}
              >
                <Icon.Trash /> Remover
              </button>
            )
          }
        >
          {/* De onde para onde: antes só a seta no quadro dizia (decisoes.md#D-44). */}
          <div className="rota-aresta">
            <button type="button" className="ponta" onClick={() => irParaNo(edge.source)} title="Ir até a origem">
              <small>De</small>
              {origem.trim() || '(sem nome)'}
            </button>
            <span className="seta" aria-hidden>
              <Icon.Seta />
            </span>
            <button type="button" className="ponta" onClick={() => irParaNo(edge.target)} title="Ir até o destino">
              <small>Para</small>
              {destino.trim() || '(sem nome)'}
            </button>
          </div>
        </PanelHeader>
        <div className="flex-1 overflow-auto scroll p-4 flex flex-col gap-3.5">
          {/* Dois fieldsets em vez de um: o botão "Detalhar" fica entre eles e
              precisa continuar clicável em visualização — o detalhamento é
              conteúdo do plano, e o modal já abre com os campos travados.
              `display: contents` some da caixa, então o gap do flex não muda. */}
          <fieldset disabled={somenteLeitura} className="contents">
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
          </fieldset>

          {kind !== 'manual' && !temRegraDoKind && (
            <fieldset disabled={somenteLeitura} className="contents">
              <button
                type="button"
                className="btn btn-sm w-full justify-center"
                onClick={addRegraDoKind}
                title={`Cria a ${kind === 'pref' ? 'preferência' : 'regra de ATP'} desta transição e abre o detalhamento`}
              >
                <Icon.Bolt /> Detalhar {kind === 'pref' ? 'Preferência' : 'ATP'}
              </button>
            </fieldset>
          )}

          <fieldset disabled={somenteLeitura} className="contents">
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
          </fieldset>

          {/* Fora do `fieldset`: o "Detalhar" de cada cartão continua valendo
              em visualização. Cada cartão desliga os próprios campos. */}
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
                <fieldset disabled={somenteLeitura} className="contents">
                  <button type="button" className="btn btn-sm" onClick={addSub}>
                    <Icon.Plus /> Adicionar
                  </button>
                </fieldset>
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
                  Liste aqui os recursos do Eproc que esta transição precisa —
                  inclusive mais de uma regra de ATP, ou uma ATP e uma
                  preferência. Marque ✓ conforme criar cada um.
                </div>
              )}
              <div>
                {subitems.map((s, i) => (
                  <RecursoCartao
                    key={s.id}
                    recurso={s}
                    somenteLeitura={somenteLeitura}
                    onChange={(patch) => updateSub(i, patch)}
                    onRemover={() => removeSub(i)}
                    onDetalhar={() => setDetalheAbertoId(s.id)}
                  />
                ))}
              </div>
            </div>
          )}

          <fieldset disabled={somenteLeitura} className="contents">
          {/* Só aparece quando há o que restaurar. O gesto de reset é o duplo
              clique na alça; este botão é a descoberta dele — sem ele, quem
              arrastou a dobra por engano não tem como saber que dá para voltar. */}
          {FLOW_MODE_DESENHO === 'sharp' && temDobraManual(data.dobra) && (
            <button
              type="button"
              className="btn btn-sm w-full justify-center"
              onClick={() => setDobra(edge.id)}
              title="Devolve a dobra desta seta ao ponto calculado automaticamente"
            >
              <Icon.Undo /> Restaurar dobra automática
            </button>
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
          </fieldset>
        </div>
      </div>

      {emDetalhe && (
        <EdgeDetailModal
          open
          onClose={() => setDetalheAbertoId(null)}
          subitem={emDetalhe}
          resumo={data.resumo}
          origem={origem}
          destino={destino}
          recursosComuns={subitems.filter((s) => !ehRecursoRegra(s)).length}
          outrasRegras={
            subitems.filter((s) => ehRecursoRegra(s) && s.id !== emDetalhe.id).length
          }
          onChange={(patch) =>
            updateEdge(edge.id, {
              subitems: subitems.map((s) =>
                s.id === emDetalhe.id ? { ...s, ...patch } : s,
              ),
            })
          }
        />
      )}
    </>
  );
}
