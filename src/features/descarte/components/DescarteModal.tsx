import { useMemo, useState } from 'react';
import { nomeInvisivel, rotuloDescarte, sugerirDescarte } from '@/domain';
import { Icon } from '@/components/Icon';
import { SugestoesInput } from '@/components/SugestoesInput';
import { useCanvasStore } from '@/features/canvas/store';
import { useSugestoesLocalizador } from '@/features/catalogo/sugestoes';
import { useDescarteStore } from '../store';

interface DescarteModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Destinos de descarte da unidade (decisoes.md#D-38): os localizadores que só
 * preenchem o destino de uma regra que não move. Regra pendurada num
 * localizador leva um deles como "destino no Eproc".
 */
export function DescarteModal({ open, onClose }: DescarteModalProps) {
  const nomes = useDescarteStore((s) => s.nomes);
  const adicionar = useDescarteStore((s) => s.adicionar);
  const remover = useDescarteStore((s) => s.remover);
  const somenteLeitura = useCanvasStore((s) => s.somenteLeitura);
  const catalogo = useSugestoesLocalizador();
  const [novo, setNovo] = useState('');

  const opcoes = useMemo(() => catalogo.map((l) => ({ valor: l.nome })), [catalogo]);
  const sugeridos = useMemo(
    () => sugerirDescarte(catalogo.map((l) => l.nome), nomes),
    [catalogo, nomes],
  );

  if (!open) return null;

  const incluir = (nome: string) => {
    if (adicionar(nome)) setNovo('');
  };

  return (
    <>
      <div className="scrim no-print" onClick={onClose} />
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Destinos de descarte"
        style={{ width: 'min(520px, 94vw)' }}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <div className="px-5 pt-4 pb-3 flex items-start gap-3" style={{ borderBottom: '1px solid var(--borda)' }}>
          <div className="flex-1">
            <div className="section-h">Destinos de descarte</div>
            <div className="text-[12px] text-texto-3 mt-0.5 leading-snug">
              Localizadores que só preenchem o destino que o Eproc exige, como “P”.
              Regra que termina neles não move o processo: fica pendurada no
              localizador de origem, em vez de virar seta.
            </div>
          </div>
          <button type="button" className="btn btn-icon btn-sm btn-ghost" onClick={onClose} aria-label="Fechar">
            <Icon.X />
          </button>
        </div>

        <fieldset disabled={somenteLeitura} className="contents">
          <div className="p-5 flex flex-col gap-3">
            {nomes.length === 0 ? (
              <div className="text-[12px] text-texto-3">Nenhum destino de descarte definido nesta unidade.</div>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {nomes.map((n) => (
                  <li key={n} className="descarte-membro">
                    <span className={nomeInvisivel(n) ? 'italic' : undefined}>
                      {rotuloDescarte(n)}
                    </span>
                    {!somenteLeitura && (
                      <button
                        type="button"
                        onClick={() => remover(n)}
                        aria-label={`Tirar ${rotuloDescarte(n)} dos destinos de descarte`}
                        title="Tirar da lista"
                      >
                        <Icon.X />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {!somenteLeitura && (
              <div className="flex gap-1.5">
                <SugestoesInput
                  className="input"
                  placeholder="Nome do localizador"
                  aria-label="Localizador a acrescentar"
                  autoFocus
                  value={novo}
                  sugestoes={opcoes}
                  onValueChange={setNovo}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      incluir(novo);
                    }
                  }}
                />
                <button type="button" className="btn" onClick={() => incluir(novo)} disabled={!novo.trim()}>
                  <Icon.Plus /> Adicionar
                </button>
              </div>
            )}

            {!somenteLeitura && sugeridos.length > 0 && (
              <div className="text-[11.5px] text-texto-3 flex flex-wrap items-center gap-1.5">
                Do catálogo da unidade:
                {sugeridos.map((n) => (
                  <button key={n} type="button" className="btn btn-sm" onClick={() => incluir(n)}>
                    <Icon.Plus /> {rotuloDescarte(n)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </fieldset>
      </div>
    </>
  );
}
