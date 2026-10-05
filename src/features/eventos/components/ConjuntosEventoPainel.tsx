import { useMemo, useState } from 'react';
import { CATEGORIAS_CONJUNTO, normalizarRotuloEvento, type ConjuntoEvento } from '@/domain';
import { Icon } from '@/components/Icon';
import { useCanvasStore } from '@/features/canvas/store';
import { IDS_EVENTOS } from '../conjuntos';
import { useConjuntosEventoStore } from '../store';

interface ConjuntosEventoPainelProps {
  selecionados: readonly string[];
  conjuntos: readonly ConjuntoEvento[];
  onIncluir: (ids: readonly string[]) => void;
  onExcluir: (ids: readonly string[]) => void;
  onTodos: () => void;
}

type Estado = 'todos' | 'parte' | 'nenhum';

/**
 * Lista dos conjuntos — os padrão, por categoria, e os criados pela unidade —
 * com "Incluir" e "Tirar" em cada um. É daqui que sai "todos, exceto mera
 * ciência": Selecionar todos, depois Tirar em Mera ciência.
 */
export function ConjuntosEventoPainel({
  selecionados,
  conjuntos,
  onIncluir,
  onExcluir,
  onTodos,
}: ConjuntosEventoPainelProps) {
  const somenteLeitura = useCanvasStore((s) => s.somenteLeitura);
  const criar = useConjuntosEventoStore((s) => s.criar);
  const atualizar = useConjuntosEventoStore((s) => s.atualizar);
  const remover = useConjuntosEventoStore((s) => s.remover);
  const [busca, setBusca] = useState('');

  const sel = useMemo(() => new Set(selecionados), [selecionados]);
  const estado = (c: ConjuntoEvento): Estado => {
    const n = c.ids.filter((id) => sel.has(id)).length;
    return n === 0 ? 'nenhum' : n === c.ids.length ? 'todos' : 'parte';
  };

  const q = normalizarRotuloEvento(busca.trim());
  const visivel = (c: ConjuntoEvento) =>
    !q || normalizarRotuloEvento(`${c.rotulo} ${c.descricao ?? ''}`).includes(q);
  const meus = conjuntos.filter((c) => c.personalizado && visivel(c));

  const salvarSelecao = () => {
    const nome = window.prompt(
      `Nome do conjunto com os ${selecionados.length} eventos selecionados:`,
    );
    if (nome) criar(nome, selecionados);
  };

  const linha = (c: ConjuntoEvento) => {
    const e = estado(c);
    return (
      <li key={c.id} className="conjunto-linha">
        <span className={`conjunto-estado ${e}`} aria-hidden>
          {e === 'todos' ? '✓' : e === 'parte' ? '–' : ''}
        </span>
        <span className="conjunto-nome" title={c.descricao}>
          {c.rotulo}
          <span className="conjunto-n mono">{c.ids.length}</span>
        </span>
        {!somenteLeitura && (
          <span className="conjunto-acoes">
            <button
              type="button"
              className="btn btn-sm"
              disabled={e === 'todos'}
              onClick={() => onIncluir(c.ids)}
              aria-label={`Incluir ${c.rotulo}`}
            >
              Incluir
            </button>
            <button
              type="button"
              className="btn btn-sm"
              disabled={e === 'nenhum'}
              onClick={() => onExcluir(c.ids)}
              aria-label={`Tirar ${c.rotulo}`}
            >
              Tirar
            </button>
            {c.personalizado && (
              <>
                <button
                  type="button"
                  className="btn btn-sm btn-icon btn-ghost"
                  title="Renomear"
                  aria-label={`Renomear ${c.rotulo}`}
                  onClick={() => {
                    const nome = window.prompt('Novo nome do conjunto:', c.rotulo);
                    if (nome) atualizar(c.id, { rotulo: nome });
                  }}
                >
                  <Icon.Pencil />
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-icon btn-ghost"
                  title="Substituir pelos eventos selecionados agora"
                  aria-label={`Substituir ${c.rotulo} pela seleção atual`}
                  disabled={selecionados.length === 0}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Trocar os ${c.ids.length} eventos de "${c.rotulo}" pelos ${selecionados.length} selecionados agora?`,
                      )
                    ) {
                      atualizar(c.id, { ids: [...selecionados] });
                    }
                  }}
                >
                  <Icon.Undo />
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-icon btn-ghost"
                  title="Apagar o conjunto"
                  aria-label={`Apagar ${c.rotulo}`}
                  onClick={() => {
                    if (window.confirm(`Apagar o conjunto "${c.rotulo}"? As regras que já usam esses eventos não mudam.`)) {
                      remover(c.id);
                    }
                  }}
                >
                  <Icon.Trash />
                </button>
              </>
            )}
          </span>
        )}
      </li>
    );
  };

  return (
    <div className="conjuntos-painel">
      <div className="flex items-center gap-1.5 mb-2">
        <input
          className="input"
          style={{ height: 28, fontSize: 12 }}
          placeholder="Buscar conjunto…"
          aria-label="Buscar conjunto de eventos"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        {!somenteLeitura && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={onTodos}
            disabled={selecionados.length === IDS_EVENTOS.length}
            title="Marca os 1.077 eventos; depois tire os conjuntos que não valem"
          >
            Selecionar todos
          </button>
        )}
      </div>

      <div className="conjuntos-secao">
        <div className="section-h flex items-center justify-between">
          <span>Meus conjuntos</span>
          {!somenteLeitura && (
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              disabled={selecionados.length === 0}
              onClick={salvarSelecao}
              title="Guarda a seleção atual como um conjunto desta unidade"
            >
              <Icon.Plus /> Salvar a seleção como conjunto
            </button>
          )}
        </div>
        {meus.length > 0 ? (
          <ul>{meus.map(linha)}</ul>
        ) : (
          <div className="text-[11.5px] text-texto-3 py-1">
            {q ? 'Nenhum conjunto seu com esse nome.' : 'Monte uma seleção e salve-a para reusar em outras regras.'}
          </div>
        )}
      </div>

      {CATEGORIAS_CONJUNTO.map((cat) => {
        const itens = conjuntos.filter((c) => !c.personalizado && c.categoria === cat && visivel(c));
        if (itens.length === 0) return null;
        return (
          <div key={cat} className="conjuntos-secao">
            <div className="section-h">{cat}</div>
            <ul>{itens.map(linha)}</ul>
          </div>
        );
      })}
    </div>
  );
}
