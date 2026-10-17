import { useMemo, useState } from 'react';
import { normalizarRotuloCatalogo, type CatalogoConjunto, type Conjunto } from '@/domain';
import { Icon } from '@/components/Icon';
import { useCanvasStore } from '@/features/canvas/store';
import { CATALOGOS_CONJUNTO } from '../catalogos';
import { useConjuntosStore } from '../store';

interface ConjuntosPainelProps {
  catalogo: CatalogoConjunto;
  selecionados: readonly string[];
  conjuntos: readonly Conjunto[];
  onIncluir: (ids: readonly string[]) => void;
  onExcluir: (ids: readonly string[]) => void;
  onTodos: () => void;
}

type Estado = 'todos' | 'parte' | 'nenhum';

const fmt = new Intl.NumberFormat('pt-BR');

/**
 * Lista dos conjuntos — os padrão, por categoria quando o catálogo tem, e os
 * criados pela unidade — com "Incluir" e "Tirar" em cada um. É daqui que sai
 * "todos − mera ciência": Selecionar todos, depois Tirar em Mera ciência.
 */
export function ConjuntosPainel({
  catalogo,
  selecionados,
  conjuntos,
  onIncluir,
  onExcluir,
  onTodos,
}: ConjuntosPainelProps) {
  const cfg = CATALOGOS_CONJUNTO[catalogo];
  const somenteLeitura = useCanvasStore((s) => s.somenteLeitura);
  const criar = useConjuntosStore((s) => s.criar);
  const atualizar = useConjuntosStore((s) => s.atualizar);
  const remover = useConjuntosStore((s) => s.remover);
  const [busca, setBusca] = useState('');

  const sel = useMemo(() => new Set(selecionados), [selecionados]);
  const estado = (c: Conjunto): Estado => {
    const n = c.ids.filter((id) => sel.has(id)).length;
    return n === 0 ? 'nenhum' : n === c.ids.length ? 'todos' : 'parte';
  };

  const q = normalizarRotuloCatalogo(busca.trim());
  const visivel = (c: Conjunto) =>
    !q || normalizarRotuloCatalogo(`${c.rotulo} ${c.descricao ?? ''}`).includes(q);
  const meus = conjuntos.filter((c) => c.personalizado && visivel(c));
  const padrao = conjuntos.filter((c) => !c.personalizado && visivel(c));

  const salvarSelecao = () => {
    const nome = window.prompt(
      `Nome do conjunto com os ${selecionados.length} ${cfg.plural} selecionados:`,
    );
    if (nome) criar(catalogo, nome, selecionados);
  };

  const linha = (c: Conjunto) => {
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
                    if (nome) atualizar(catalogo, c.id, { rotulo: nome });
                  }}
                >
                  <Icon.Pencil />
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-icon btn-ghost"
                  title={`Substituir pelos ${cfg.plural} selecionados agora`}
                  aria-label={`Substituir ${c.rotulo} pela seleção atual`}
                  disabled={selecionados.length === 0}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Trocar os ${c.ids.length} ${cfg.plural} de "${c.rotulo}" pelos ${selecionados.length} selecionados agora?`,
                      )
                    ) {
                      atualizar(catalogo, c.id, { ids: [...selecionados] });
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
                    if (
                      window.confirm(
                        `Apagar o conjunto "${c.rotulo}"? As regras que já usam esses ${cfg.plural} não mudam.`,
                      )
                    ) {
                      remover(catalogo, c.id);
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
          aria-label={`Buscar conjunto de ${cfg.plural}`}
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        {!somenteLeitura && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={onTodos}
            disabled={selecionados.length === cfg.ids.length}
            title={`Marca os ${fmt.format(cfg.ids.length)} ${cfg.plural}; depois tire os conjuntos que não valem`}
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

      {cfg.categorias.length === 0
        ? padrao.length > 0 && (
            <div className="conjuntos-secao">
              <div className="section-h">Conjuntos padrão</div>
              <ul>{padrao.map(linha)}</ul>
            </div>
          )
        : cfg.categorias.map((cat) => {
            const itens = padrao.filter((c) => c.categoria === cat);
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
