import { useEffect, useRef } from 'react';
import { TIPO_MENCAO_ROTULO, type TipoMencao } from '@/domain';
import { cn } from '@/utils/cn';
import type { FiltroMencao, ItemMencao } from '../mencoes';

const FILTROS: ReadonlyArray<{ id: FiltroMencao; rotulo: string }> = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'loc', rotulo: 'Localizadores' },
  { id: 'pref', rotulo: 'Preferências' },
  { id: 'atp', rotulo: 'Regras de ATP' },
];

const GRUPO: Record<TipoMencao, string> = {
  loc: 'Localizadores',
  pref: 'Preferências',
  atp: 'Regras de ATP',
};

interface Props {
  itens: ItemMencao[];
  consulta: string;
  filtro: FiltroMencao;
  ativo: number;
  pos: { left: number; top: number; acima: boolean };
  largura: number;
  onFiltro: (f: FiltroMencao) => void;
  onEscolher: (item: ItemMencao) => void;
}

/** A lista do @. O foco fica no texto: tudo aqui é por `mousedown` com `preventDefault`. */
export function MenuMencao({ itens, consulta, filtro, ativo, pos, largura, onFiltro, onEscolher }: Props) {
  const listaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listaRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [ativo, itens]);

  return (
    <div
      className="menu-mencao"
      role="listbox"
      aria-label="Mencionar"
      style={{
        left: pos.left,
        width: largura,
        ...(pos.acima ? { bottom: window.innerHeight - pos.top + 26 } : { top: pos.top + 6 }),
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="menu-mencao-filtros">
        {FILTROS.map((f) => (
          <button key={f.id} type="button" aria-pressed={filtro === f.id} onMouseDown={() => onFiltro(f.id)}>
            {f.rotulo}
          </button>
        ))}
      </div>
      <div className="menu-mencao-lista" ref={listaRef}>
        {itens.length === 0 && (
          <div className="menu-mencao-vazio">
            Nada encontrado para “{consulta}”. Continue digitando ou apague o @.
          </div>
        )}
        {itens.map((it, i) => {
          const novoGrupo = i === 0 || itens[i - 1]?.ref.tipo !== it.ref.tipo;
          return (
            <div key={`${it.ref.tipo}:${it.ref.chave}`}>
              {novoGrupo && filtro === 'todos' && <div className="menu-mencao-grupo">{GRUPO[it.ref.tipo]}</div>}
              <div
                role="option"
                aria-selected={i === ativo}
                className={cn('menu-mencao-item', i === ativo && 'ativo')}
                onMouseDown={() => onEscolher(it)}
                title={TIPO_MENCAO_ROTULO[it.ref.tipo]}
              >
                <span className={`mencao-marca m-${it.ref.tipo}`} aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate">{it.nome}</span>
                  <small className="block truncate">{it.sub}</small>
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="menu-mencao-pe">
        <span><kbd>↑</kbd> <kbd>↓</kbd> escolher</span>
        <span><kbd>Enter</kbd> inserir</span>
        <span><kbd>Esc</kbd> fechar</span>
      </div>
    </div>
  );
}
