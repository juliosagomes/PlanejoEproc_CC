import { regrasCitadas } from '@/domain';
import { Icon } from '@/components/Icon';
import { PanelHeader } from '@/components/PanelHeader';
import type { NotaFlow } from '../pecasQuadro';
import { useCanvasStore } from '../store';

/** Painel de uma nota do quadro (decisoes.md#D-38). */
export function NotaPanel({ nota }: { nota: NotaFlow }) {
  const atualizarNota = useCanvasStore((s) => s.atualizarNota);
  const removerPeca = useCanvasStore((s) => s.removerPeca);
  const somenteLeitura = useCanvasStore((s) => s.somenteLeitura);
  const refs = regrasCitadas(nota.texto);

  return (
    <div className="flex flex-col h-full">
      <PanelHeader
        eyebrow="Nota"
        title="Anotação do quadro"
        right={
          somenteLeitura ? undefined : (
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => removerPeca(nota.id)}>
              <Icon.Trash /> Remover
            </button>
          )
        }
      />
      <fieldset disabled={somenteLeitura} className="contents">
        <div className="flex-1 overflow-auto scroll p-4 flex flex-col gap-3.5">
          <p className="text-[12px] text-texto-2 leading-relaxed m-0">
            Texto livre no quadro. Não é localizador: não vai ao Eproc nem ao
            checklist. Cite regras como “Regra 54 e 55” e elas aparecem em
            destaque na nota.
          </p>
          <div>
            <label className="label" htmlFor={`nota-${nota.id}`}>
              Texto
            </label>
            <textarea
              id={`nota-${nota.id}`}
              className="textarea"
              rows={6}
              value={nota.texto}
              autoFocus={!somenteLeitura}
              onChange={(e) => atualizarNota(nota.id, e.target.value)}
              placeholder="Ex.: Toda triagem nova precisa entrar nas regras 54 e 55."
            />
          </div>
          {refs.length > 0 && (
            <div>
              <span className="label">Regras citadas</span>
              <div className="flex flex-wrap gap-1">
                {refs.map((n) => (
                  <span key={n} className="regra-ref">
                    Regra {n}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </fieldset>
    </div>
  );
}
