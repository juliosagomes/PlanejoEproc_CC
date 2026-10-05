import { useMemo } from 'react';
import Select from 'react-select';
import {
  FILTROS_DEF,
  GRUPOS_FILTRO,
  filtroDef,
  type AtpFiltros,
  type FiltroDef,
} from '@/domain';
import { Icon } from '@/components/Icon';
import { ParametrosForm } from './CampoDinamico';

/* ============================================================================
 * Bloco "Filtros Opcionais".
 *
 * A tela do Eproc mostra os mais de 40 filtros de uma vez. Aqui o bloco começa
 * vazio e o usuário adiciona só os que a regra usa (decisoes.md#D-27): o plano
 * é lido por quem vai cadastrar, e trinta e tantos campos em branco entre os
 * três que importam é ruído.
 * ========================================================================== */

interface FiltrosBlocoProps {
  filtros: AtpFiltros;
  setFiltros: (filtros: AtpFiltros) => void;
}

interface OpcaoFiltro {
  value: string;
  label: string;
}

export function FiltrosBloco({ filtros, setFiltros }: FiltrosBlocoProps) {
  const chaves = Object.keys(filtros);

  const disponiveis = useMemo(
    () =>
      GRUPOS_FILTRO.map((grupo) => ({
        label: grupo,
        options: FILTROS_DEF.filter((f) => f.grupo === grupo && !(f.chave in filtros)).map(
          (f): OpcaoFiltro => ({ value: f.chave, label: f.rotulo }),
        ),
      })).filter((g) => g.options.length > 0),
    [filtros],
  );

  const remover = (chave: string) => {
    const { [chave]: _removido, ...resto } = filtros;
    setFiltros(resto);
  };

  return (
    <div className="flex flex-col gap-2.5">
      {chaves.map((chave) => {
        const def = filtroDef(chave);
        return (
          <div
            key={chave}
            style={{
              padding: '8px 10px 10px',
              border: '1px solid var(--borda)',
              borderRadius: 8,
              background: 'var(--superficie-2)',
            }}
          >
            <div className="flex items-start gap-2 mb-1.5">
              <div className="flex-1 min-w-0">
                <div className="label" style={{ marginBottom: 0 }}>
                  {def?.rotulo ?? chave}
                </div>
                {def?.ajuda && <div className="text-[11px] text-texto-3">{def.ajuda}</div>}
              </div>
              <button
                type="button"
                className="btn btn-icon btn-sm btn-ghost"
                onClick={() => remover(chave)}
                title="Remover filtro"
                aria-label={`Remover filtro ${def?.rotulo ?? chave}`}
              >
                <Icon.X />
              </button>
            </div>
            {def ? (
              <ParametrosForm
                campos={def.campos}
                valores={filtros[chave] ?? {}}
                onChange={(valores) => setFiltros({ ...filtros, [chave]: valores })}
                semRotulo={ehDeCampoUnico(def)}
              />
            ) : (
              // Filtro que este build não conhece — plano feito numa versão
              // mais nova. Mostra o que está gravado; editar exigiria saber os
              // campos.
              <div className="mono text-[11px] text-texto-2 break-all">
                {JSON.stringify(filtros[chave])}
              </div>
            )}
          </div>
        );
      })}

      {disponiveis.length > 0 && (
        <Select<OpcaoFiltro, false>
          options={disponiveis}
          // Controlado em `null`: o select é um botão de adicionar com busca,
          // não guarda escolha.
          value={null}
          onChange={(opcao) => {
            if (opcao) setFiltros({ ...filtros, [opcao.value]: {} });
          }}
          placeholder="Adicionar filtro…"
          noOptionsMessage={() => 'Nenhum filtro com esse nome'}
          aria-label="Adicionar filtro"
          classNamePrefix="rs"
          menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
          menuPosition="fixed"
          menuPlacement="auto"
          styles={{
            control: (base, state) => ({
              ...base,
              minHeight: 32,
              backgroundColor: 'var(--superficie)',
              borderColor: state.isFocused ? 'var(--destaque)' : 'var(--borda-forte)',
              borderStyle: 'dashed',
              boxShadow: 'none',
              borderRadius: 6,
              fontSize: 13,
            }),
            placeholder: (base) => ({ ...base, color: 'var(--texto-2)' }),
            input: (base) => ({ ...base, color: 'var(--texto)' }),
            menuPortal: (base) => ({ ...base, zIndex: 60 }),
            menu: (base) => ({
              ...base,
              background: 'var(--superficie)',
              border: '1px solid var(--borda)',
            }),
            groupHeading: (base) => ({
              ...base,
              color: 'var(--texto-3)',
              fontSize: 10.5,
              letterSpacing: '0.06em',
            }),
            option: (base, state) => ({
              ...base,
              background: state.isFocused ? 'var(--superficie-2)' : 'var(--superficie)',
              color: 'var(--texto)',
              fontSize: 12.5,
              cursor: 'pointer',
            }),
          }}
        />
      )}
    </div>
  );
}

/** O título do cartão já diz o que o campo é; repetir o rótulo seria eco. */
function ehDeCampoUnico(def: FiltroDef): boolean {
  return def.campos.length === 1 && def.campos[0]?.tipo !== 'lista';
}
