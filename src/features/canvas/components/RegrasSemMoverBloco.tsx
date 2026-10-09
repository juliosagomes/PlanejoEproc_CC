import { useMemo, useState } from 'react';
import {
  EFEITOS_SEM_MOVER,
  EFEITO_SEM_MOVER_LABEL,
  hasAtpDetail,
  rotuloDescarte,
  type EfeitoSemMover,
  type RegraSemMover,
  type Subitem,
} from '@/domain';
import { Icon } from '@/components/Icon';
import { SugestoesInput } from '@/components/SugestoesInput';
import { useSugestoesLocalizador } from '@/features/catalogo/sugestoes';
import { useDescarteStore } from '@/features/descarte/store';
import { useCanvasStore, type FlowNode } from '../store';
import { EdgeDetailModal } from './EdgeDetailModal';

const ICONE: Record<EfeitoSemMover, string> = { automatica: '⚡', manual: '👆', limpeza: '🧹' };

const BOTAO: Record<EfeitoSemMover, string> = {
  automatica: 'Automática',
  manual: 'Manual',
  limpeza: 'Limpeza',
};

/**
 * Regras de ATP que não movem o processo, penduradas neste localizador
 * (decisoes.md#D-38): no lugar da seta para "P" ou para um nó sem nome.
 */
export function RegrasSemMoverBloco({ node }: { node: FlowNode }) {
  const somenteLeitura = useCanvasStore((s) => s.somenteLeitura);
  const add = useCanvasStore((s) => s.addRegraSemMover);
  const regras = node.data.regrasSemMover ?? [];
  const [aberta, setAberta] = useState<string | null>(null);

  const criar = (efeito: EfeitoSemMover) => {
    const id = add(node.id, efeito);
    if (id) setAberta(id);
  };

  return (
    <div
      className="rounded-lg px-3 py-2.5"
      style={{ background: 'var(--superficie-2)', border: '1px solid var(--borda)' }}
    >
      <div className="label" style={{ marginBottom: 6 }}>
        Regras que não movem
        {regras.length > 0 && (
          <span className="mono ml-2 text-[10.5px] font-medium normal-case tracking-normal text-texto-3">
            {regras.length}
          </span>
        )}
      </div>

      {regras.length === 0 ? (
        <div className="text-[11.5px] text-texto-3 leading-snug">
          Regras que só executam ação (lembrete, dado complementar) ou tiram um
          localizador. No Eproc, o destino delas é um destino de descarte, como “P”.
        </div>
      ) : (
        EFEITOS_SEM_MOVER.map((efeito) => {
          const doGrupo = regras.filter((r) => r.efeito === efeito);
          if (doGrupo.length === 0) return null;
          return (
            <div key={efeito} className="mb-1.5">
              <div className="text-[11px] font-semibold text-texto-2 mt-1">
                {ICONE[efeito]} {EFEITO_SEM_MOVER_LABEL[efeito]}
              </div>
              <ul className="flex flex-col">
                {doGrupo.map((r) => (
                  <RegraLinha
                    key={r.id}
                    node={node}
                    regra={r}
                    aberta={aberta === r.id}
                    onAlternar={() => setAberta(aberta === r.id ? null : r.id)}
                  />
                ))}
              </ul>
            </div>
          );
        })
      )}

      {!somenteLeitura && (
        <div className="flex gap-1.5 mt-2">
          {EFEITOS_SEM_MOVER.map((efeito) => (
            <button
              key={efeito}
              type="button"
              className="btn btn-sm flex-1 justify-center"
              style={{ height: 24, fontSize: 11 }}
              onClick={() => criar(efeito)}
              title={`Pendurar uma regra: ${EFEITO_SEM_MOVER_LABEL[efeito].toLowerCase()}`}
            >
              <Icon.Plus /> {BOTAO[efeito]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface RegraLinhaProps {
  node: FlowNode;
  regra: RegraSemMover;
  aberta: boolean;
  onAlternar: () => void;
}

function RegraLinha({ node, regra, aberta, onAlternar }: RegraLinhaProps) {
  const somenteLeitura = useCanvasStore((s) => s.somenteLeitura);
  const update = useCanvasStore((s) => s.updateRegraSemMover);
  const remove = useCanvasStore((s) => s.removeRegraSemMover);
  const descarte = useDescarteStore((s) => s.nomes);
  const localizadores = useSugestoesLocalizador();
  const opcoesTira = useMemo(() => localizadores.map((l) => ({ valor: l.nome })), [localizadores]);
  const [detalhando, setDetalhando] = useState(false);

  const patch = (p: Partial<Omit<RegraSemMover, 'id' | 'categoria'>>) => update(node.id, regra.id, p);
  const destinoEfetivo = regra.destino ?? descarte[0];
  const resumo =
    regra.efeito === 'limpeza'
      ? regra.tira?.trim()
        ? `tira ${regra.tira.trim()}`
        : 'falta dizer o que tira'
      : destinoEfetivo
        ? `destino no Eproc: ${rotuloDescarte(destinoEfetivo)}`
        : 'sem destino de descarte na unidade';

  // O modal devolve patches de `Subitem`; categoria e id da regra pendurada são fixos.
  const aoMudarDetalhe = (p: Partial<Subitem>) => {
    const { categoria: _c, id: _i, ...resto } = p;
    patch(resto);
  };

  return (
    <li className="regra-sem-mover flex-col !items-stretch">
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          className="pj-check"
          style={{ marginTop: 2 }}
          checked={regra.ja_criado}
          onChange={(e) => patch({ ja_criado: e.target.checked })}
          aria-label={`${regra.nome || 'Regra sem nome'}: já criada no Eproc`}
          title="Já criada no Eproc"
        />
        <button type="button" className="flex-1 min-w-0 text-left" onClick={onAlternar} aria-expanded={aberta}>
          {regra.nome.trim() || <span className="italic text-texto-3">regra sem nome</span>}
          <small>{resumo}</small>
        </button>
        {hasAtpDetail(regra.atp) && (
          <span className="mono text-[10px] text-texto-3" title="Tem detalhamento">
            ATP
          </span>
        )}
      </div>

      {aberta && (
        <div className="flex flex-col gap-2 mt-2 pl-6">
          <input
            className="input"
            style={{ height: 26, fontSize: 12 }}
            value={regra.nome}
            autoFocus={!somenteLeitura}
            onChange={(e) => patch({ nome: e.target.value })}
            placeholder="Nome da regra (ex.: Regra 92 – lembrete de JG)"
            aria-label="Nome da regra"
          />
          <select
            className="select"
            style={{ fontSize: 12 }}
            value={regra.efeito}
            onChange={(e) => patch({ efeito: e.target.value as EfeitoSemMover })}
            aria-label="Grupo da regra"
          >
            {EFEITOS_SEM_MOVER.map((ef) => (
              <option key={ef} value={ef}>
                {EFEITO_SEM_MOVER_LABEL[ef]}
              </option>
            ))}
          </select>
          {regra.efeito === 'limpeza' ? (
            <SugestoesInput
              className="input"
              style={{ height: 26, fontSize: 12 }}
              value={regra.tira ?? ''}
              sugestoes={opcoesTira}
              onValueChange={(v) => patch({ tira: v })}
              placeholder="Localizador que a regra tira (ex.: PETIÇÃO)"
              aria-label="Localizador que a regra tira"
            />
          ) : (
            <select
              className="select"
              style={{ fontSize: 12 }}
              value={destinoEfetivo ?? ''}
              onChange={(e) => patch({ destino: e.target.value })}
              aria-label="Destino no Eproc"
              disabled={descarte.length === 0 && !regra.destino}
            >
              {descarte.length === 0 && !regra.destino && (
                <option value="">Defina os destinos em Unidade › Destinos de descarte</option>
              )}
              {regra.destino && !descarte.includes(regra.destino) && (
                <option value={regra.destino}>{rotuloDescarte(regra.destino)} (fora da lista)</option>
              )}
              {descarte.map((d) => (
                <option key={d} value={d}>
                  Destino no Eproc: {rotuloDescarte(d)}
                </option>
              ))}
            </select>
          )}
          <div className="flex gap-1.5">
            <button type="button" className="btn btn-sm flex-1 justify-center" onClick={() => setDetalhando(true)}>
              Detalhar regra
            </button>
            {!somenteLeitura && (
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => remove(node.id, regra.id)}
                aria-label={`Remover ${regra.nome || 'regra sem nome'}`}
              >
                <Icon.Trash /> Remover
              </button>
            )}
          </div>
        </div>
      )}

      <EdgeDetailModal
        open={detalhando}
        onClose={() => setDetalhando(false)}
        subitem={regra}
        resumo={EFEITO_SEM_MOVER_LABEL[regra.efeito]}
        origem={node.data.nome}
        destino={regra.efeito === 'limpeza' ? node.data.nome : rotuloDescarte(destinoEfetivo ?? '')}
        recursosComuns={0}
        outrasRegras={0}
        onChange={aoMudarDetalhe}
        pendurada
      />
    </li>
  );
}
