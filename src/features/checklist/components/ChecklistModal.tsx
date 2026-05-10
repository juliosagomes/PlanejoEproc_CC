import { useMemo, useState } from 'react';
import { Icon } from '@/components/Icon';
import { useCanvasStore } from '@/features/canvas/store';
import { cn } from '@/utils/cn';
import {
  CHECKLIST_GROUP_ORDER,
  checklistToMarkdown,
  contarChecklist,
  deriveChecklist,
} from '../derive';

interface ChecklistModalProps {
  open: boolean;
  onClose: () => void;
}

function dataBR(): string {
  return new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function ChecklistModal({ open, onClose }: ChecklistModalProps) {
  const planoNome = useCanvasStore((s) => s.planoNome);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const toggleNodeCreated = useCanvasStore((s) => s.toggleNodeCreated);
  const toggleSubitemCreated = useCanvasStore((s) => s.toggleSubitemCreated);
  const toggleEdgeRuleCreated = useCanvasStore((s) => s.toggleEdgeRuleCreated);

  const [copiado, setCopiado] = useState(false);

  // `deriveChecklist` aceita o shape estrutural — passamos `nodes/edges` direto.
  const groups = useMemo(() => deriveChecklist(nodes, edges), [nodes, edges]);
  const { total, done } = contarChecklist(groups);

  if (!open) return null;

  const copiarMd = async () => {
    const md = checklistToMarkdown(planoNome, groups);
    try {
      await navigator.clipboard.writeText(md);
    } catch {
      // Fallback para contextos sem clipboard API (file://, sem permissão).
      const ta = document.createElement('textarea');
      ta.value = md;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 1800);
  };

  const imprimir = () => window.print();

  return (
    <>
      <div className="scrim no-print" onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true">
        <div
          className="px-5 pt-4 pb-3 flex items-start gap-3 no-print"
          style={{ borderBottom: '1px solid var(--borda)' }}
        >
          <div
            className="flex items-center justify-center text-destaque"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'var(--destaque-suave)',
              border: '1px solid var(--destaque-borda)',
            }}
          >
            <Icon.Bolt />
          </div>
          <div className="flex-1">
            <div className="section-h">Checklist · {dataBR()}</div>
            <div className="text-[14.5px] font-semibold mt-0.5">{planoNome}</div>
            <div className="text-xs text-texto-3 mt-0.5">
              {done} de {total} criados · {total - done} pendentes
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-icon btn-ghost"
            onClick={onClose}
            aria-label="Fechar"
          >
            <Icon.X />
          </button>
        </div>

        <div className="flex-1 overflow-auto scroll p-5 flex flex-col gap-4">
          {total === 0 && (
            <div
              className="text-center text-texto-3"
              style={{
                padding: '24px',
                border: '1px dashed var(--borda-forte)',
                borderRadius: 8,
              }}
            >
              Nada para listar ainda. Adicione localizadores e recursos no canvas.
            </div>
          )}

          {CHECKLIST_GROUP_ORDER.map((cat) => {
            const items = groups[cat];
            if (items.length === 0) return null;
            const ownDone = items.filter((i) => i.ja_criado).length;
            const childTotal = items.reduce(
              (s, x) => s + (x.kind === 'rule' ? x.children.length : 0),
              0,
            );
            const childDone = items.reduce(
              (s, x) =>
                s + (x.kind === 'rule' ? x.children.filter((c) => c.ja_criado).length : 0),
              0,
            );
            const totalCat = items.length + childTotal;
            const doneCat = ownDone + childDone;
            const allDone = doneCat === totalCat;
            return (
              <div key={cat}>
                <div
                  className="flex items-center gap-2 mb-2 pb-1.5"
                  style={{ borderBottom: '1px solid var(--borda)' }}
                >
                  <span
                    className={cn('section-h', allDone && 'text-ok')}
                    style={{ color: allDone ? 'var(--ok)' : undefined }}
                  >
                    {cat}
                  </span>
                  <span
                    className="mono text-[11px]"
                    style={{ color: allDone ? 'var(--ok)' : 'var(--texto-3)' }}
                  >
                    {doneCat}/{totalCat}
                    {allDone ? ' ✓' : ''}
                  </span>
                </div>
                <div className="flex flex-col">
                  {items.map((it, i) => {
                    const isRule = it.kind === 'rule';
                    const childCount = isRule ? it.children.length : 0;
                    const childDoneCount = isRule
                      ? it.children.filter((c) => c.ja_criado).length
                      : 0;
                    const onToggle = () => {
                      if (it.kind === 'node') toggleNodeCreated(it.nodeId);
                      else if (it.kind === 'rule') toggleEdgeRuleCreated(it.edgeId);
                      else toggleSubitemCreated(it.edgeId, it.index);
                    };
                    return (
                      <div
                        key={`${cat}-${i}`}
                        style={{ borderBottom: '1px solid var(--borda)' }}
                      >
                        <label
                          className="flex items-start gap-3 cursor-pointer"
                          style={{
                            padding: '8px 6px',
                            opacity: it.ja_criado ? 0.65 : 1,
                            background: isRule ? 'var(--destaque-suave)' : 'transparent',
                          }}
                        >
                          <input
                            type="checkbox"
                            className="pj-check"
                            style={{ marginTop: 2 }}
                            checked={it.ja_criado}
                            onChange={onToggle}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <div
                                className={isRule ? 'font-semibold' : 'font-medium'}
                                style={{
                                  fontSize: 13,
                                  textDecoration: it.ja_criado ? 'line-through' : 'none',
                                  color: it.ja_criado ? 'var(--texto-3)' : 'var(--texto)',
                                }}
                              >
                                {it.nome}
                              </div>
                              {isRule && childCount > 0 && (
                                <span
                                  className="mono"
                                  style={{
                                    fontSize: 10.5,
                                    color:
                                      childDoneCount === childCount
                                        ? 'var(--ok)'
                                        : 'var(--texto-3)',
                                  }}
                                >
                                  {childDoneCount}/{childCount} subiten
                                  {childCount === 1 ? '' : 's'}
                                </span>
                              )}
                            </div>
                            {(it.descricao || (it.kind !== 'node' && it.contexto)) && (
                              <div
                                className="text-texto-3 mt-0.5"
                                style={{ fontSize: 11.5, lineHeight: 1.4 }}
                              >
                                {it.kind !== 'node' && it.contexto && (
                                  <span className="mono" style={{ fontSize: 10.5 }}>
                                    {it.contexto}
                                  </span>
                                )}
                                {it.kind !== 'node' && it.contexto && it.descricao && ' · '}
                                {it.descricao}
                              </div>
                            )}
                            {it.kind === 'rule' && it.detalhes.length > 0 && (
                              <div className="mt-1.5 flex flex-col gap-1">
                                {it.detalhes.map((d, di) => {
                                  const multilinha = d.valor.includes('\n');
                                  return (
                                    <div
                                      key={di}
                                      style={{ fontSize: 11.5, lineHeight: 1.45 }}
                                    >
                                      <span
                                        className="text-texto-2 font-semibold"
                                        style={{ fontSize: 11 }}
                                      >
                                        {d.label}:
                                      </span>{' '}
                                      {multilinha ? (
                                        <div
                                          className="text-texto mt-1"
                                          style={{
                                            whiteSpace: 'pre-wrap',
                                            background: 'var(--superficie)',
                                            border: '1px solid var(--borda)',
                                            borderRadius: 6,
                                            padding: '6px 8px',
                                            fontFamily:
                                              'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                                            fontSize: 11,
                                          }}
                                        >
                                          {d.valor}
                                        </div>
                                      ) : (
                                        <span className="text-texto">{d.valor}</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </label>
                        {isRule && childCount > 0 && (
                          <div
                            style={{
                              marginLeft: 28,
                              borderLeft: '2px solid var(--destaque-borda)',
                              paddingLeft: 10,
                              marginBottom: 4,
                            }}
                          >
                            {it.children.map((ch, ci) => (
                              <label
                                key={`${cat}-${i}-c-${ci}`}
                                className="flex items-start gap-3 cursor-pointer"
                                style={{
                                  padding: '6px',
                                  opacity: ch.ja_criado ? 0.6 : 1,
                                }}
                              >
                                <input
                                  type="checkbox"
                                  className="pj-check"
                                  style={{ marginTop: 2 }}
                                  checked={ch.ja_criado}
                                  onChange={() =>
                                    toggleSubitemCreated(ch.edgeId, ch.index)
                                  }
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-baseline gap-2 flex-wrap">
                                    {ch.categoria && (
                                      <span
                                        className="mono text-texto-3"
                                        style={{
                                          fontSize: 10,
                                          border: '1px solid var(--borda-forte)',
                                          borderRadius: 4,
                                          padding: '0 5px',
                                          lineHeight: '15px',
                                        }}
                                      >
                                        {ch.categoria}
                                      </span>
                                    )}
                                    <div
                                      className="font-medium"
                                      style={{
                                        fontSize: 12.5,
                                        textDecoration: ch.ja_criado
                                          ? 'line-through'
                                          : 'none',
                                        color: ch.ja_criado
                                          ? 'var(--texto-3)'
                                          : 'var(--texto)',
                                      }}
                                    >
                                      {ch.nome}
                                    </div>
                                  </div>
                                  {ch.descricao && (
                                    <div
                                      className="text-texto-3 mt-px"
                                      style={{ fontSize: 11, lineHeight: 1.4 }}
                                    >
                                      {ch.descricao}
                                    </div>
                                  )}
                                </div>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div
          className="px-5 py-3 flex items-center gap-3 no-print"
          style={{ borderTop: '1px solid var(--borda)', background: 'var(--fundo)' }}
        >
          <div className="flex-1 text-[11.5px] text-texto-3">
            Marcações persistem no quadro.
          </div>
          <button type="button" className="btn" onClick={imprimir}>
            <Icon.Print /> Imprimir
          </button>
          <button type="button" className="btn" onClick={copiarMd}>
            <Icon.Copy /> {copiado ? 'Copiado!' : 'Copiar como Markdown'}
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </>
  );
}
