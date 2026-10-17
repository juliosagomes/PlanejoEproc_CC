import { useMemo, useState } from 'react';
import { Icon } from '@/components/Icon';
import { ehAtalho, type BlocoFluxo } from '@/domain';
import { useSetoresStore } from '@/features/setores/store';
import { getAtivoId, listPlanos } from '@/infra/storage';
import { desenharBloco, nomeDoNo } from '../fluxoPapel';
import { planoPorId } from '../planos';

interface Props {
  onInserir: (bloco: BlocoFluxo) => void;
  onFechar: () => void;
}

/** Escolher plano e localizadores para pôr o desenho dentro de um mapa. */
export function DialogoInserirFluxo({ onInserir, onFechar }: Props) {
  const setores = useSetoresStore((s) => s.setores);
  const planos = useMemo(() => listPlanos(), []);
  const [planoId, setPlanoId] = useState(() => getAtivoId() ?? planos[0]?.id ?? '');
  const plano = useMemo(() => (planoId ? planoPorId(planoId) : null), [planoId]);
  const locs = useMemo(
    () => (plano ? plano.nodes.filter((n) => !ehAtalho(n)).sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y) : []),
    [plano],
  );
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [fora, setFora] = useState(false);

  const trocarPlano = (id: string) => {
    setPlanoId(id);
    setMarcados(new Set());
  };
  const alternar = (id: string) =>
    setMarcados((m) => {
      const n = new Set(m);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const inserir = () => {
    if (!plano || marcados.size === 0) return;
    onInserir(desenharBloco(plano, planoId, [...marcados], fora, setores, new Date().toISOString()));
  };

  return (
    <>
      <div className="scrim no-print" onClick={onFechar} />
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Inserir desenho do fluxo"
        style={{ width: 'min(520px, 94vw)' }}
        onKeyDown={(e) => e.key === 'Escape' && onFechar()}
      >
        <div className="px-5 pt-4 pb-3 flex items-start gap-3" style={{ borderBottom: '1px solid var(--borda)' }}>
          <div className="flex-1">
            <div className="section-h">Inserir desenho do fluxo</div>
            <div className="text-[12px] text-texto-3 mt-0.5 leading-snug">
              O desenho entra como um bloco, e o resto do mapa continua seu. Se o plano mudar, o bloco
              avisa e oferece atualizar.
            </div>
          </div>
          <button type="button" className="btn btn-icon btn-sm btn-ghost" onClick={onFechar} aria-label="Fechar">
            <Icon.X />
          </button>
        </div>
        <div className="p-5 flex flex-col gap-3 overflow-auto">
          <label className="flex flex-col gap-1">
            <span className="section-h">Plano</span>
            <select className="input" value={planoId} onChange={(e) => trocarPlano(e.target.value)}>
              {planos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-1">
            <div className="flex items-center">
              <span className="section-h flex-1">Localizadores</span>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setMarcados(new Set(locs.map((n) => n.id)))}>
                Todos
              </button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setMarcados(new Set())}>
                Nenhum
              </button>
            </div>
            <div className="mapa-lista-locs">
              {locs.length === 0 && <div className="text-[12px] text-texto-3">Este plano não tem localizadores.</div>}
              {locs.map((n) => (
                <label key={n.id} className="mapa-chk">
                  <input type="checkbox" checked={marcados.has(n.id)} onChange={() => alternar(n.id)} />
                  <span>{plano ? nomeDoNo(plano, n.id) : ''}</span>
                </label>
              ))}
            </div>
          </div>
          <label className="mapa-chk">
            <input type="checkbox" checked={fora} onChange={(e) => setFora(e.target.checked)} />
            <span>
              Mostrar o que entra e sai da seleção
              <small>Os localizadores de fora aparecem esmaecidos</small>
            </span>
          </label>
        </div>
        <div className="px-5 py-3 flex justify-end gap-2" style={{ borderTop: '1px solid var(--borda)' }}>
          <button type="button" className="btn" onClick={onFechar}>
            Cancelar
          </button>
          <button type="button" className="btn btn-accent" onClick={inserir} disabled={marcados.size === 0}>
            Inserir {marcados.size > 0 ? `(${marcados.size})` : ''}
          </button>
        </div>
      </div>
    </>
  );
}
