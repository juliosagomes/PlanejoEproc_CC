import {
  ACOES_PROGRAMADAS,
  acaoProgramadaDef,
  parametrosVazios,
  type AcaoProgramada,
  type Parametros,
} from '@/domain';
import { Icon } from '@/components/Icon';
import { uid } from '@/utils/uid';
import { ParametrosForm } from './CampoDinamico';
import { Field } from './pecas';

/* ============================================================================
 * Bloco "Executar Ação" — a ação programada depois que a regra move o processo.
 *
 * No Eproc é uma caixa ("Programar ação após execução da regra") que abre um
 * formulário, e outra ("Múltiplas ações") que o transforma em lista com ordem.
 * Aqui a lista é o modelo desde o início: uma ação é a lista de um item.
 * ========================================================================== */

interface AcoesBlocoProps {
  acoes: AcaoProgramada[];
  setAcoes: (acoes: AcaoProgramada[]) => void;
}

function temConteudo(a: AcaoProgramada): boolean {
  return Boolean(
    a.tipo ||
      a.descricao?.trim() ||
      a.localizadorErro?.trim() ||
      !parametrosVazios(a.parametros),
  );
}

/**
 * Ao trocar o tipo, sobrevive só o que o tipo novo também tem — o modelo da
 * minuta entre as citações, por exemplo. O resto seria parâmetro órfão,
 * gravado no plano e invisível no modal.
 */
function parametrosCompativeis(atuais: Parametros | undefined, tipo: string): Parametros {
  const chaves = new Set(acaoProgramadaDef(tipo)?.campos.map((c) => c.chave));
  return Object.fromEntries(Object.entries(atuais ?? {}).filter(([k]) => chaves.has(k)));
}

export function AcoesBloco({ acoes, setAcoes }: AcoesBlocoProps) {
  const programar = acoes.length > 0;
  const multiplas = acoes.length > 1;

  const alternar = (ligar: boolean) => {
    if (ligar) {
      setAcoes([{ id: uid('ac') }]);
      return;
    }
    if (acoes.some(temConteudo)) {
      const ok = window.confirm(
        'Desmarcar remove as ações programadas desta regra, com os parâmetros junto. Continuar?',
      );
      if (!ok) return;
    }
    setAcoes([]);
  };

  const trocar = (id: string, patch: Partial<AcaoProgramada>) =>
    setAcoes(acoes.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  const mover = (i: number, delta: -1 | 1) => {
    const j = i + delta;
    const a = acoes[i];
    const b = acoes[j];
    if (!a || !b) return;
    const next = [...acoes];
    next[i] = b;
    next[j] = a;
    setAcoes(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 cursor-pointer text-[12.5px]">
        <input
          type="checkbox"
          className="pj-check"
          checked={programar}
          onChange={(e) => alternar(e.target.checked)}
        />
        Programar ação após execução da regra
      </label>

      {acoes.map((acao, i) => {
        const def = acaoProgramadaDef(acao.tipo);
        return (
          <div
            key={acao.id}
            className="flex flex-col gap-2.5"
            style={{
              padding: '10px 12px',
              border: '1px solid var(--borda)',
              borderRadius: 8,
              background: 'var(--superficie-2)',
            }}
          >
            <div className="flex items-end gap-2">
              {multiplas && (
                <span className="mono text-[11px] text-texto-3 pb-2" title="Ordem de execução">
                  #{i + 1}
                </span>
              )}
              <Field label="Tipo de Ação" className="flex-1 min-w-0">
                <select
                  className="select"
                  value={acao.tipo ?? ''}
                  onChange={(e) => {
                    const tipo = e.target.value;
                    trocar(acao.id, {
                      tipo: tipo || undefined,
                      parametros: tipo ? parametrosCompativeis(acao.parametros, tipo) : {},
                    });
                  }}
                >
                  <option value="">— selecione —</option>
                  {/* Código de um Eproc mais novo que este build. */}
                  {acao.tipo && !def && <option value={acao.tipo}>{acao.tipo}</option>}
                  {ACOES_PROGRAMADAS.map((a) => (
                    <option key={a.codigo} value={a.codigo}>
                      {a.rotulo}
                    </option>
                  ))}
                </select>
              </Field>
              {multiplas && (
                <>
                  <button
                    type="button"
                    className="btn btn-icon btn-sm btn-ghost"
                    onClick={() => mover(i, -1)}
                    disabled={i === 0}
                    title="Executar antes"
                    aria-label="Executar antes"
                  >
                    <span style={{ transform: 'rotate(180deg)', display: 'inline-flex' }}>
                      <Icon.ChevronDown />
                    </span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-icon btn-sm btn-ghost"
                    onClick={() => mover(i, 1)}
                    disabled={i === acoes.length - 1}
                    title="Executar depois"
                    aria-label="Executar depois"
                  >
                    <Icon.ChevronDown />
                  </button>
                  <button
                    type="button"
                    className="btn btn-icon btn-sm btn-ghost"
                    onClick={() => setAcoes(acoes.filter((a) => a.id !== acao.id))}
                    title="Remover ação"
                    aria-label="Remover ação"
                  >
                    <Icon.X />
                  </button>
                </>
              )}
            </div>

            {/* No Eproc a descrição só existe com "Múltiplas ações": é o nome
                que distingue uma da outra na lista. */}
            {multiplas && (
              <Field label="Descrição">
                <input
                  className="input"
                  value={acao.descricao ?? ''}
                  onChange={(e) => trocar(acao.id, { descricao: e.target.value })}
                />
              </Field>
            )}

            {def && (
              <ParametrosForm
                campos={def.campos}
                valores={acao.parametros ?? {}}
                onChange={(parametros) => trocar(acao.id, { parametros })}
              />
            )}

            {acao.tipo && (
              <ParametrosForm
                campos={[
                  {
                    chave: 'localizadorErro',
                    rotulo: 'Localizador de Erro',
                    ajuda: 'Para onde o processo vai se a ação falhar.',
                    tipo: 'texto',
                    sugestao: 'localizador',
                  },
                ]}
                valores={acao.localizadorErro ? { localizadorErro: acao.localizadorErro } : {}}
                onChange={(p) =>
                  trocar(acao.id, {
                    localizadorErro:
                      typeof p.localizadorErro === 'string' ? p.localizadorErro : undefined,
                  })
                }
              />
            )}
          </div>
        );
      })}

      {programar && (
        <div>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setAcoes([...acoes, { id: uid('ac') }])}
            title="No Eproc: caixa “Múltiplas ações”"
          >
            <Icon.Plus /> Adicionar outra ação
          </button>
        </div>
      )}
    </div>
  );
}
