import { useEffect, useMemo, useState } from 'react';
import {
  contarCobertura,
  localizadoresDoSetor,
  type RecorteSetor,
} from '@/domain';
import { useCanvasStore } from '@/features/canvas/store';
import { useSetoresStore } from '@/features/setores/store';
import { cn } from '@/utils/cn';
import { useLocalizadoresDaUnidade } from '../dados';
import { usePainelStore } from '../store';
import { CoberturaLista } from './CoberturaLista';
import { FilaCard } from './FilaCard';
import { GruposPreferencias } from './GruposPreferencias';
import { NovaFilaForm } from './NovaFilaForm';
import { TrilhoSetores } from './TrilhoSetores';

type Aba = 'setor' | 'grupos';

/**
 * Painel da unidade (decisoes.md#D-33): as filas de trabalho de cada setor e a
 * cobertura dos localizadores. Ocupa o lugar do canvas; o cabeçalho alterna.
 */
export function PainelUnidade() {
  const setores = useSetoresStore((s) => s.setores);
  const painel = usePainelStore((s) => s.painel);
  const somenteLeitura = useCanvasStore((s) => s.somenteLeitura);
  const locs = useLocalizadoresDaUnidade();

  const [aba, setAba] = useState<Aba>('setor');
  const [setorId, setSetorId] = useState<RecorteSetor>(() => setores[0]?.id ?? null);

  // Setor apagado enquanto selecionado: volta para o primeiro.
  useEffect(() => {
    if (setorId !== null && !setores.some((s) => s.id === setorId)) setSetorId(setores[0]?.id ?? null);
  }, [setores, setorId]);

  const conhecidos = useMemo(() => new Set(setores.map((s) => s.id)), [setores]);
  const doSetor = useMemo(
    () => localizadoresDoSetor(locs, setorId, conhecidos),
    [locs, setorId, conhecidos],
  );
  const chavesDoSetor = useMemo(() => new Set(doSetor.map((l) => l.chave)), [doSetor]);
  // Em "Sem setor" aparecem as filas cujo setor foi apagado, para não sumirem.
  const filas = painel.filas.filter((f) =>
    setorId === null ? !conhecidos.has(f.setorId) : f.setorId === setorId,
  );
  const setor = setores.find((s) => s.id === setorId);
  const c = contarCobertura(doSetor, setorId, painel);

  return (
    <div className="flex-1 min-w-0 overflow-auto bg-fundo">
      <div className="max-w-[1280px] mx-auto px-5 py-4 flex flex-col gap-4">
        <div role="tablist" aria-label="Visões do painel" className="flex gap-1 border-b border-borda">
          {(
            [
              ['setor', 'Por setor'],
              ['grupos', 'Grupos de preferências'],
            ] as const
          ).map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={aba === id}
              onClick={() => setAba(id)}
              className={cn(
                'px-3 py-2 text-[13px] -mb-px border-b-2 bg-transparent cursor-pointer',
                aba === id ? 'border-destaque text-texto font-semibold' : 'border-transparent text-texto-2',
              )}
            >
              {rotulo}
            </button>
          ))}
        </div>

        {aba === 'grupos' ? (
          <GruposPreferencias painel={painel} setores={setores} somenteLeitura={somenteLeitura} />
        ) : (
          <div className="grid grid-cols-[230px_minmax(0,1fr)] gap-5 items-start">
            <div className="sticky top-0">
              <TrilhoSetores
                setores={setores}
                locs={locs}
                painel={painel}
                selecionado={setorId}
                onSelecionar={setSetorId}
              />
            </div>

            <div className="flex flex-col gap-3.5 min-w-0">
              <div className="flex items-baseline gap-2.5 flex-wrap">
                {setor && <span className={`flag-chip flag-cor-${setor.cor}`}>{setor.code}</span>}
                <h2 className="text-[17px] font-semibold tracking-tight">{setor?.label ?? 'Sem setor'}</h2>
                <span className="text-[12px] text-texto-2">
                  {doSetor.length} localizadores · {filas.length} filas ·{' '}
                  {c.descobertos > 0 ? (
                    <b className="text-aviso">{c.descobertos} descobertos</b>
                  ) : (
                    'todos cobertos ou justificados'
                  )}
                </span>
              </div>

              <div className="grid gap-5 items-start grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                <section className="flex flex-col gap-2.5 min-w-0" aria-labelledby="painel-filas">
                  <h3 id="painel-filas" className="section-h">
                    Filas de trabalho do setor
                  </h3>
                  {filas.map((f) => (
                    <FilaCard
                      key={f.id}
                      fila={f}
                      doSetor={chavesDoSetor}
                      locs={locs}
                      grupos={painel.grupos}
                      somenteLeitura={somenteLeitura}
                      {...(setorId === null ? { setoresParaMover: setores } : {})}
                    />
                  ))}
                  {setorId !== null && !somenteLeitura && (
                    <NovaFilaForm key={setorId} setorId={setorId} grupos={painel.grupos} />
                  )}
                  {setorId === null && filas.length === 0 && (
                    <p className="text-[12px] text-texto-3">Localizadores sem setor não têm filas próprias.</p>
                  )}
                </section>

                <section className="flex flex-col gap-2.5 min-w-0" aria-labelledby="painel-cobertura">
                  <h3 id="painel-cobertura" className="section-h">
                    Cobertura dos localizadores
                  </h3>
                  <CoberturaLista
                    locs={doSetor}
                    setorId={setorId}
                    painel={painel}
                    filas={filas}
                    setores={setores}
                    somenteLeitura={somenteLeitura}
                  />
                </section>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
