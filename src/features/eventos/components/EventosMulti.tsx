import { useMemo, useState } from 'react';
import { EVENTOS } from '@/data';
import type { ConjuntoEvento } from '@/domain';
import { CatalogMulti } from '@/components/CatalogMulti';
import { useCanvasStore } from '@/features/canvas/store';
import { cn } from '@/utils/cn';
import { IDS_EVENTOS, frasePorResumo, resumirEventos } from '../conjuntos';
import { useConjuntosEvento } from '../store';
import { ConjuntosEventoPainel } from './ConjuntosEventoPainel';

/** Até aqui, a lista de chips ainda se lê; acima disso, o resumo toma o lugar. */
const LIMITE_CHIPS = 12;

interface EventosMultiProps {
  values: string[];
  onChange: (ids: string[]) => void;
  ariaLabel: string;
}

/**
 * Seletor de eventos com conjuntos (decisoes.md#D-29). O valor continua sendo a
 * lista explícita de ids — é o que se marca no Eproc —, mas a tela mostra o
 * resumo ("Todos os eventos, exceto Mera ciência") em vez de mil chips, e o
 * painel de conjuntos monta a seleção em dois cliques.
 *
 * Quando a seleção é "tudo menos alguns", a edição um a um passa a ser da lista
 * de **exceções**: é ela que tem tamanho humano.
 */
export function EventosMulti({ values, onChange, ariaLabel }: EventosMultiProps) {
  const conjuntos = useConjuntosEvento();
  const somenteLeitura = useCanvasStore((s) => s.somenteLeitura);
  const [painelAberto, setPainelAberto] = useState(false);
  const [editando, setEditando] = useState(false);

  const resumo = useMemo(
    () => resumirEventos(values, conjuntos),
    [values, conjuntos],
  );
  const porExcecao = resumo.modo === 'exclusao' || resumo.modo === 'todos';
  const mostrarResumo =
    resumo.modo !== 'vazio' &&
    (porExcecao || values.length > LIMITE_CHIPS || resumo.conjuntos.length > 0);

  const sel = new Set(values);
  const excluidos = porExcecao ? IDS_EVENTOS.filter((id) => !sel.has(id)) : [];

  const incluir = (ids: readonly string[]) => onChange([...new Set([...values, ...ids])]);
  const tirar = (ids: readonly string[], manterDe: readonly ConjuntoEvento[] = []) => {
    const fora = new Set(ids);
    // Tirar um conjunto da inclusão não pode levar junto o que pertence a outro
    // conjunto que continua escolhido.
    for (const c of manterDe) for (const id of c.ids) fora.delete(id);
    onChange(values.filter((id) => !fora.has(id)));
  };

  return (
    <div className="eventos-multi">
      {mostrarResumo && (
        <div className="eventos-resumo" aria-label={`${ariaLabel}: ${frasePorResumo(resumo)}`}>
          {resumo.modo === 'todos' || resumo.modo === 'exclusao' ? (
            <>
              <Chip tom="conjunto" onRemover={somenteLeitura ? undefined : () => onChange([])} rotuloRemover="Limpar todos">
                Todos os eventos
              </Chip>
              {resumo.modo === 'exclusao' &&
                resumo.conjuntos.map((c) => (
                  <Chip
                    key={c.id}
                    tom="excecao"
                    titulo={c.descricao}
                    onRemover={somenteLeitura ? undefined : () => incluir(c.ids)}
                    rotuloRemover={`Incluir de volta ${c.rotulo}`}
                  >
                    exceto {c.rotulo} <span className="eventos-chip-n">{c.ids.length}</span>
                  </Chip>
                ))}
              {resumo.modo === 'exclusao' && resumo.avulsos.length > 0 && (
                <button type="button" className="eventos-chip excecao" onClick={() => setEditando(true)}>
                  exceto {resumo.avulsos.length} avulso{resumo.avulsos.length > 1 ? 's' : ''}
                </button>
              )}
            </>
          ) : (
            resumo.modo === 'inclusao' && (
              <>
                {resumo.conjuntos.map((c) => (
                  <Chip
                    key={c.id}
                    tom="conjunto"
                    titulo={c.descricao}
                    onRemover={
                      somenteLeitura
                        ? undefined
                        : () => tirar(c.ids, resumo.conjuntos.filter((o) => o.id !== c.id))
                    }
                    rotuloRemover={`Tirar ${c.rotulo}`}
                  >
                    {c.rotulo} <span className="eventos-chip-n">{c.ids.length}</span>
                  </Chip>
                ))}
                {resumo.avulsos.length > 0 && (
                  <button type="button" className="eventos-chip avulso" onClick={() => setEditando(true)}>
                    {resumo.conjuntos.length > 0 ? '+ ' : ''}
                    {resumo.avulsos.length} evento{resumo.avulsos.length > 1 ? 's' : ''}
                  </button>
                )}
              </>
            )
          )}
          <span className="eventos-total mono">
            {values.length} de {IDS_EVENTOS.length}
          </span>
        </div>
      )}

      {(!mostrarResumo || editando) && (
        <div className={cn(mostrarResumo && 'mt-1.5')}>
          {porExcecao && mostrarResumo && (
            <div className="text-[11px] text-texto-3 mb-1">
              Eventos que ficam de fora — todos os outros estão marcados.
            </div>
          )}
          <CatalogMulti
            values={porExcecao && mostrarResumo ? excluidos : values}
            options={EVENTOS}
            onChange={(ids) =>
              porExcecao && mostrarResumo
                ? onChange(IDS_EVENTOS.filter((id) => !ids.includes(id)))
                : onChange(ids)
            }
            placeholder={porExcecao && mostrarResumo ? 'Buscar evento para deixar de fora…' : 'Buscar evento…'}
            ariaLabel={porExcecao && mostrarResumo ? `${ariaLabel} — exceções` : ariaLabel}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
        <button
          type="button"
          className={cn('btn btn-sm', painelAberto && 'btn-primary')}
          aria-expanded={painelAberto}
          onClick={() => setPainelAberto((v) => !v)}
        >
          Conjuntos de eventos
        </button>
        {mostrarResumo && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditando((v) => !v)}>
            {editando ? 'Fechar a lista' : porExcecao ? 'Editar exceções' : 'Editar um a um'}
          </button>
        )}
      </div>

      {painelAberto && (
        <ConjuntosEventoPainel
          selecionados={values}
          conjuntos={conjuntos}
          onIncluir={incluir}
          onExcluir={(ids) => tirar(ids)}
          onTodos={() => onChange([...IDS_EVENTOS])}
        />
      )}
    </div>
  );
}

interface ChipProps {
  tom: 'conjunto' | 'excecao';
  titulo?: string;
  onRemover?: () => void;
  rotuloRemover: string;
  children: React.ReactNode;
}

function Chip({ tom, titulo, onRemover, rotuloRemover, children }: ChipProps) {
  return (
    <span className={cn('eventos-chip', tom)} title={titulo}>
      <span>{children}</span>
      {onRemover && (
        <button type="button" onClick={onRemover} aria-label={rotuloRemover} title={rotuloRemover}>
          ×
        </button>
      )}
    </span>
  );
}
