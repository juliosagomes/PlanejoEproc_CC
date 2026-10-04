import { useState } from 'react';
import { chaveLocalizador, type DefinicaoFlag, type FilaTrabalho, type PainelUnidade } from '@/domain';
import { Icon } from '@/components/Icon';
import { useGruposDoEproc } from '../dados';
import { usePainelStore } from '../store';

interface GruposPreferenciasProps {
  painel: PainelUnidade;
  setores: DefinicaoFlag[];
  somenteLeitura: boolean;
}

/**
 * Os grupos de preferências e as filas de cada um. No Eproc toda consulta salva
 * das três telas pode estar num grupo (D-37); os grupos que a sincronização viu
 * e o painel ainda não tem aparecem para trazer com um clique.
 */
export function GruposPreferencias({ painel, setores, somenteLeitura }: GruposPreferenciasProps) {
  const criarGrupo = usePainelStore((s) => s.criarGrupo);
  const removerGrupo = usePainelStore((s) => s.removerGrupo);
  const definirGrupo = usePainelStore((s) => s.definirGrupo);
  const [novo, setNovo] = useState('');
  const conhecidos = new Set(painel.grupos.map((g) => chaveLocalizador(g.nome)));
  const doEproc = useGruposDoEproc().filter((n) => !conhecidos.has(chaveLocalizador(n)));

  const prefs = painel.filas;
  const semGrupo = prefs.filter((f) => !f.grupoId || !painel.grupos.some((g) => g.id === f.grupoId));
  const chip = (f: FilaTrabalho) => {
    const s = setores.find((x) => x.id === f.setorId);
    return s ? (
      <span className={`flag-chip flag-cor-${s.cor}`} title={s.label}>
        {s.code}
      </span>
    ) : null;
  };

  return (
    <div className="grid gap-3.5 items-start [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
      {painel.grupos.map((g) => {
        const membros = prefs.filter((f) => f.grupoId === g.id);
        return (
          <article key={g.id} className="bg-superficie border border-borda rounded-lg p-3.5 flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-[13.5px] flex-1 min-w-0 break-words">{g.nome}</h4>
              {!somenteLeitura && (
                <button
                  type="button"
                  className="btn btn-sm btn-ghost btn-icon"
                  style={{ width: 24 }}
                  aria-label={`Apagar o grupo ${g.nome}`}
                  title="Apagar grupo (as filas continuam, sem grupo)"
                  onClick={() => {
                    if (window.confirm(`Apagar o grupo "${g.nome}"? As filas continuam, sem grupo.`))
                      removerGrupo(g.id);
                  }}
                >
                  <Icon.Trash />
                </button>
              )}
            </div>
            <ul className="flex flex-col gap-1">
              {membros.map((f) => (
                <li key={f.id} className="flex items-center gap-2 rounded bg-superficie-2 px-2 py-1 text-[12.5px]">
                  {chip(f)}
                  <span className="flex-1 min-w-0 break-words">{f.nome}</span>
                  {!somenteLeitura && (
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => definirGrupo(f.id, null)}>
                      Tirar
                    </button>
                  )}
                </li>
              ))}
              {membros.length === 0 && <li className="text-[12px] text-texto-3">Vazio</li>}
            </ul>
            {!somenteLeitura && semGrupo.length > 0 && (
              <select
                className="select"
                style={{ height: 26, fontSize: 12, padding: '0 6px' }}
                aria-label={`Pôr fila no grupo ${g.nome}`}
                value=""
                onChange={(e) => e.target.value && definirGrupo(e.target.value, g.id)}
              >
                <option value="">+ pôr fila sem grupo</option>
                {semGrupo.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
            )}
          </article>
        );
      })}

      <article className="bg-superficie border border-borda rounded-lg p-3.5 flex flex-col gap-2.5">
        <h4 className="font-semibold text-[13.5px]">Sem grupo</h4>
        <ul className="flex flex-col gap-1">
          {semGrupo.map((f) => (
            <li key={f.id} className="flex items-center gap-2 rounded bg-superficie-2 px-2 py-1 text-[12.5px]">
              {chip(f)}
              <span className="flex-1 min-w-0 break-words">{f.nome}</span>
            </li>
          ))}
          {semGrupo.length === 0 && (
            <li className="text-[12px] text-texto-3">
              {prefs.length === 0 ? 'Nenhuma fila ainda.' : 'Todas as filas têm grupo.'}
            </li>
          )}
        </ul>
        {!somenteLeitura && doEproc.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-texto-2">
            <span>Do Eproc:</span>
            {doEproc.map((n) => (
              <button
                key={n}
                type="button"
                className="btn btn-sm"
                title="Trazer este grupo do Eproc para o painel"
                onClick={() => criarGrupo(n)}
              >
                <Icon.Plus /> {n}
              </button>
            ))}
          </div>
        )}
        {!somenteLeitura && (
          <form
            className="flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              criarGrupo(novo);
              setNovo('');
            }}
          >
            <input
              className="input flex-1 min-w-0"
              style={{ height: 26, padding: '2px 8px', fontSize: 12 }}
              value={novo}
              onChange={(e) => setNovo(e.target.value)}
              placeholder="Nome do novo grupo"
              aria-label="Nome do novo grupo"
            />
            <button type="submit" className="btn btn-sm" disabled={!novo.trim()}>
              Criar grupo
            </button>
          </form>
        )}
      </article>
    </div>
  );
}
