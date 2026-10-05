import {
  contarCobertura,
  localizadoresDoSetor,
  type DefinicaoFlag,
  type LocalizadorDaUnidade,
  type PainelUnidade,
  type RecorteSetor,
} from '@/domain';
import { cn } from '@/utils/cn';
import { BarraCobertura } from './BarraCobertura';

interface TrilhoSetoresProps {
  setores: DefinicaoFlag[];
  locs: LocalizadorDaUnidade[];
  painel: PainelUnidade;
  selecionado: RecorteSetor;
  onSelecionar: (id: RecorteSetor) => void;
}

/** Os setores da unidade, cada um com a sua cobertura; por último, "Sem setor". */
export function TrilhoSetores({ setores, locs, painel, selecionado, onSelecionar }: TrilhoSetoresProps) {
  const conhecidos = new Set(setores.map((s) => s.id));
  const itens: { id: RecorteSetor; rotulo: string; chip: JSX.Element }[] = [
    ...setores.map((s) => ({
      id: s.id,
      rotulo: s.label,
      chip: <span className={`flag-chip flag-cor-${s.cor}`}>{s.code}</span>,
    })),
    { id: null, rotulo: 'Sem setor', chip: <span className="flag-chip flag-cor-4">—</span> },
  ];

  return (
    <nav aria-label="Setores" className="flex flex-col gap-1">
      <div className="section-h px-2 pb-1">Setores</div>
      {itens.map((it) => {
        const c = contarCobertura(localizadoresDoSetor(locs, it.id, conhecidos), it.id, painel);
        const ativo = selecionado === it.id;
        return (
          <button
            key={it.id ?? 'sem'}
            type="button"
            onClick={() => onSelecionar(it.id)}
            aria-current={ativo}
            className={cn(
              'grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-1.5 text-left rounded-md px-2 py-2 border cursor-pointer',
              ativo
                ? 'bg-superficie border-borda shadow-sm'
                : 'bg-transparent border-transparent hover:bg-superficie-2',
            )}
          >
            {it.chip}
            <span className="text-[12.5px] font-medium truncate">{it.rotulo}</span>
            <span
              className={cn(
                'mono text-[11px]',
                c.descobertos > 0 ? 'text-aviso font-semibold' : 'text-texto-3',
              )}
            >
              {c.descobertos > 0 ? `${c.descobertos} desc.` : `${c.cobertos}/${c.total - c.fora}`}
            </span>
            <BarraCobertura c={c} className="col-start-2 col-span-2" />
          </button>
        );
      })}
    </nav>
  );
}
