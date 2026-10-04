import { useState } from 'react';
import {
  situacaoNoSetor,
  type DefinicaoFlag,
  type FilaTrabalho,
  type LocalizadorDaUnidade,
  type PainelUnidade,
  type RecorteSetor,
  type Situacao,
} from '@/domain';
import { cn } from '@/utils/cn';
import { usePainelStore } from '../store';

interface CoberturaListaProps {
  locs: LocalizadorDaUnidade[];
  setorId: RecorteSetor;
  painel: PainelUnidade;
  /** Filas do setor, para o "Incluir em fila". */
  filas: FilaTrabalho[];
  setores: DefinicaoFlag[];
  somenteLeitura: boolean;
}

const ORDEM: Record<Situacao['tipo'], number> = { descoberto: 0, outroSetor: 1, coberto: 2, fora: 3 };

/** Os localizadores do setor, com o que precisa de atenção primeiro. */
export function CoberturaLista({ locs, setorId, painel, filas, setores, somenteLeitura }: CoberturaListaProps) {
  const linhas = locs
    .map((loc) => ({ loc, s: situacaoNoSetor(loc, setorId, painel) }))
    .sort((a, b) => ORDEM[a.s.tipo] - ORDEM[b.s.tipo]);

  if (linhas.length === 0) {
    return (
      <div className="bg-superficie border border-borda rounded-lg p-3 text-[12px] text-texto-3">
        Nenhum localizador com este setor nos planos da unidade.
      </div>
    );
  }

  return (
    <div className="bg-superficie border border-borda rounded-lg overflow-hidden divide-y divide-borda">
      {linhas.map(({ loc, s }) => (
        <LinhaCobertura
          key={loc.chave}
          loc={loc}
          s={s}
          setorId={setorId}
          filas={filas}
          setores={setores}
          somenteLeitura={somenteLeitura}
        />
      ))}
    </div>
  );
}

const ICONE: Record<Situacao['tipo'], string> = { coberto: '✓', outroSetor: '↔', fora: '⊘', descoberto: '!' };

interface LinhaProps {
  loc: LocalizadorDaUnidade;
  s: Situacao;
  setorId: RecorteSetor;
  filas: FilaTrabalho[];
  setores: DefinicaoFlag[];
  somenteLeitura: boolean;
}

function LinhaCobertura({ loc, s, setorId, filas, setores, somenteLeitura }: LinhaProps) {
  const incluir = usePainelStore((st) => st.incluirLocalizador);
  const deixarDeFora = usePainelStore((st) => st.deixarDeFora);
  const desfazerFora = usePainelStore((st) => st.desfazerFora);
  const [modo, setModo] = useState<'nada' | 'incluir' | 'motivo'>('nada');
  const [motivo, setMotivo] = useState('');

  const nomes = (fs: FilaTrabalho[]) => fs.map((f) => f.nome).join(', ');
  const outrosSetores = setores.filter((x) => x.id !== setorId && loc.setores.includes(x.id));

  return (
    <div
      className={cn(
        'grid grid-cols-[18px_minmax(0,1fr)] gap-x-2 gap-y-1 px-3 py-2',
        s.tipo === 'descoberto' && 'bg-aviso-suave',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'w-[18px] h-[18px] mt-px rounded-full grid place-items-center text-[10.5px] font-bold border',
          s.tipo === 'coberto' && 'bg-ok-suave text-ok border-ok-borda',
          s.tipo === 'outroSetor' && 'bg-destaque-suave text-destaque border-destaque-borda',
          s.tipo === 'fora' && 'bg-superficie-2 text-texto-3 border-borda-forte',
          s.tipo === 'descoberto' && 'bg-superficie text-aviso border-aviso',
        )}
      >
        {ICONE[s.tipo]}
      </span>
      <span
        className={cn(
          'text-[12.5px] font-medium break-words flex items-center gap-1.5 flex-wrap',
          s.tipo === 'fora' && 'text-texto-3 line-through decoration-borda-forte',
        )}
      >
        {loc.nome}
        {outrosSetores.map((x) => (
          <span key={x.id} className={`flag-chip flag-cor-${x.cor}`} title={x.label}>
            {x.code}
          </span>
        ))}
      </span>

      <div className="col-start-2 flex flex-wrap items-center gap-1.5 text-[11.5px] text-texto-2">
        {s.tipo === 'coberto' && (
          <>
            <span>{nomes(s.filas)}</span>
            {s.outras.length > 0 && <span className="text-texto-3">· também em {nomes(s.outras)}</span>}
          </>
        )}
        {s.tipo === 'outroSetor' && <span>Só em fila de outro setor: {nomes(s.filas)}</span>}
        {s.tipo === 'fora' && (
          <>
            <span className="text-texto-3">Fora de propósito: {s.motivo}</span>
            {!somenteLeitura && (
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => desfazerFora(loc.nome)}>
                Desfazer
              </button>
            )}
          </>
        )}
        {s.tipo === 'descoberto' && (
          <>
            <span>Nenhuma fila olha para ele.</span>
            {!somenteLeitura && modo === 'nada' && (
              <>
                {filas.length > 0 && (
                  <button type="button" className="btn btn-sm" onClick={() => setModo('incluir')}>
                    Incluir em fila
                  </button>
                )}
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setModo('motivo')}>
                  Deixar de fora
                </button>
              </>
            )}
            {modo === 'incluir' && (
              <select
                className="select"
                style={{ width: 'auto', height: 22, padding: '0 6px', fontSize: 11.5 }}
                aria-label={`Fila para ${loc.nome}`}
                autoFocus
                value=""
                onBlur={() => setModo('nada')}
                onChange={(e) => {
                  if (e.target.value) incluir(e.target.value, loc.nome);
                  setModo('nada');
                }}
              >
                <option value="">Escolha a fila…</option>
                {filas.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
            )}
          </>
        )}
      </div>

      {modo === 'motivo' && (
        <form
          className="col-start-2 flex flex-wrap gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!motivo.trim()) return;
            deixarDeFora(loc.nome, motivo);
            setModo('nada');
            setMotivo('');
          }}
        >
          <input
            className="input flex-1 min-w-[180px]"
            style={{ height: 26, padding: '2px 8px', fontSize: 12 }}
            autoFocus
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setModo('nada')}
            placeholder="Por que fica de fora?"
            aria-label={`Motivo para deixar ${loc.nome} de fora`}
          />
          <button type="submit" className="btn btn-sm btn-accent" disabled={!motivo.trim()}>
            Confirmar
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setModo('nada')}>
            Cancelar
          </button>
        </form>
      )}
    </div>
  );
}
