import {
  SUBITEM_CATS,
  ehRecursoRegra,
  estadoBlocosAtp,
  hasDetalheSubitem,
  type EstadoBloco,
  type Subitem,
  type SubitemCategoria,
} from '@/domain';
import { Icon } from '@/components/Icon';
import { SubitemNomeInput } from '@/features/catalogo/components/SubitemNomeInput';
import { cn } from '@/utils/cn';

interface RecursoCartaoProps {
  recurso: Subitem;
  somenteLeitura: boolean;
  onChange: (patch: Partial<Subitem>) => void;
  onRemover: () => void;
  onDetalhar: () => void;
}

const MARCA: Record<EstadoBloco, string> = { completo: '✓ ', parcial: '◐ ', vazio: '' };
const DIZ: Record<EstadoBloco, string> = { completo: 'completo', parcial: 'em parte', vazio: 'em branco' };

/**
 * O preenchimento dos três blocos da tela do Eproc, para ver sem abrir o
 * modal se a regra ainda está em branco (decisoes.md#D-44).
 */
function BlocosRegra({ recurso }: { recurso: Subitem }) {
  const e = estadoBlocosAtp(recurso.atp);
  const blocos: [string, EstadoBloco][] = [
    ['Regras', e.regras],
    ['Ação', e.acao],
    ['Filtros', e.filtros],
  ];
  return (
    <div
      className="blocos-regra"
      title={e.pendencias.length ? `Falta: ${e.pendencias.map((p) => p.texto).join('; ')}` : 'Bloco Regras completo'}
    >
      {blocos.map(([nome, est]) => (
        <span key={nome} className={est} aria-label={`${nome}: ${DIZ[est]}`}>
          {MARCA[est]}
          {nome}
        </span>
      ))}
    </div>
  );
}

/**
 * Um recurso da transição em cartão: nome inteiro, categoria, o estado da
 * regra e o "Detalhar" com rótulo (decisoes.md#D-44). O botão de detalhar fica
 * fora do `fieldset`: em visualização o modal abre travado, mas abre.
 */
export function RecursoCartao({ recurso: s, somenteLeitura, onChange, onRemover, onDetalhar }: RecursoCartaoProps) {
  const regra = ehRecursoRegra(s);
  const temDetalhe = hasDetalheSubitem(s);
  const oQue = s.categoria === 'Preferência' ? 'esta preferência' : 'esta regra';

  return (
    <div className={cn('recurso-cartao', s.ja_criado && 'created')}>
      <fieldset disabled={somenteLeitura} className="contents">
        <div className="flex flex-col gap-1 min-w-0">
          <select
            className="select self-start"
            style={{ height: 24, padding: '1px 6px', fontSize: 11, width: 'auto' }}
            value={s.categoria}
            onChange={(e) => onChange({ categoria: e.target.value as SubitemCategoria })}
            aria-label="Categoria do recurso"
          >
            {SUBITEM_CATS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <SubitemNomeInput
            value={s.nome}
            categoria={s.categoria}
            onChange={(nome, existeNaUnidade) =>
              // Só liga `ja_criado`, nunca desliga: bater com o catálogo prova
              // que o recurso existe, mas não bater não prova o contrário (pode
              // ser um nome livre para algo que o usuário já criou à mão).
              onChange({ nome, ...(existeNaUnidade ? { ja_criado: true } : {}) })
            }
          />
          <textarea
            className="input subitem-desc text-texto-2"
            rows={1}
            placeholder="descrição (opcional)"
            value={s.descricao ?? ''}
            onChange={(e) => onChange({ descricao: e.target.value })}
          />
        </div>
      </fieldset>

      {s.categoria === 'Regra de ATP' && <BlocosRegra recurso={s} />}

      <div className="flex items-center gap-1.5">
        <fieldset disabled={somenteLeitura} className="contents">
          <label className="flex items-center gap-1.5 text-[11.5px] text-texto-2 cursor-pointer">
            <input
              type="checkbox"
              className="pj-check"
              checked={s.ja_criado}
              onChange={(e) => onChange({ ja_criado: e.target.checked })}
            />
            Já criado no Eproc
          </label>
          <span className="flex-1" />
          <button
            type="button"
            className="btn btn-icon btn-sm btn-ghost"
            onClick={onRemover}
            title="Remover recurso"
            aria-label="Remover recurso"
          >
            <Icon.Trash />
          </button>
        </fieldset>
        {regra && (
          <button
            type="button"
            className={cn('btn btn-sm', temDetalhe && 'btn-primary')}
            onClick={onDetalhar}
            title={
              somenteLeitura
                ? `Ver o detalhamento d${oQue}`
                : temDetalhe
                  ? 'Detalhamento preenchido — clique para editar'
                  : `Abrir o detalhamento d${oQue}`
            }
          >
            <Icon.Bolt /> {somenteLeitura ? 'Ver' : 'Detalhar'}
          </button>
        )}
      </div>
    </div>
  );
}
