import { useEffect, useMemo, useState } from 'react';
import { CORES_FLAG } from '@/domain';
import { Icon } from '@/components/Icon';
import { BadgeSistema } from '@/features/catalogo/components/BadgeSistema';
import { useCanvasStore } from '@/features/canvas/store';
import { getAtivoId, listPlanos, loadPlano } from '@/infra/storage';
import { cn } from '@/utils/cn';
import {
  agruparPorPlano,
  contarUso,
  inventarioPorSetor,
  type PlanoDaUnidade,
} from '../inventario';
import { useSetoresStore } from '../store';

interface SetoresModalProps {
  open: boolean;
  onClose: () => void;
}

function plural(n: number, singular: string, plural_: string): string {
  return `${n} ${n === 1 ? singular : plural_}`;
}

/**
 * Tela geral dos setores da unidade (decisoes.md#D-26).
 *
 * Duas colunas, porque são duas perguntas: à esquerda, **quem** recorta o
 * trabalho aqui (a lista, editável); à direita, **o que** o setor escolhido
 * trabalha — todos os localizadores marcados com ele, em todos os planos do
 * silo, e não só no que está aberto.
 *
 * Em sessão de visualização (D-19) continua abrindo: ver quem trabalha o quê é
 * inofensivo. O `fieldset[disabled]` desliga a edição de uma vez, como no
 * NodePanel.
 */
export function SetoresModal({ open, onClose }: SetoresModalProps) {
  const setores = useSetoresStore((s) => s.setores);
  const criar = useSetoresStore((s) => s.criar);
  const atualizar = useSetoresStore((s) => s.atualizar);
  const remover = useSetoresStore((s) => s.remover);
  const somenteLeitura = useCanvasStore((s) => s.somenteLeitura);
  // Nós e nome do ativo entram como dependência para o inventário reagir à
  // edição em curso — marcar um setor no painel muda a contagem aqui na hora.
  const nodes = useCanvasStore((s) => s.nodes);
  const planoNomeAtivo = useCanvasStore((s) => s.planoNome);

  const [novo, setNovo] = useState('');
  const [selecionado, setSelecionado] = useState<string | null>(null);

  /**
   * Os planos do silo, com o **ativo trocado pela versão viva** da store: o
   * gravado pode estar até 300 ms atrás (debounce) e não conhece a edição que
   * o usuário acabou de fazer.
   */
  const planos: PlanoDaUnidade[] = useMemo(() => {
    if (!open) return [];
    const ativoId = getAtivoId();
    return listPlanos().map((e) =>
      e.id === ativoId
        ? { id: e.id, nome: planoNomeAtivo, plano: useCanvasStore.getState().getPlano() }
        : { id: e.id, nome: e.nome, plano: loadPlano(e.id) },
    );
    // `nodes` não é lido aqui, mas é o que muda quando uma marcação muda.
  }, [open, nodes, planoNomeAtivo]);

  const inventario = useMemo(() => inventarioPorSetor(planos), [planos]);
  const uso = useMemo(() => contarUso(inventario), [inventario]);

  // Seleção default: o primeiro setor da lista, e nunca um id que sumiu.
  useEffect(() => {
    if (!open) return;
    if (selecionado !== null && setores.some((f) => f.id === selecionado)) return;
    setSelecionado(setores[0]?.id ?? null);
  }, [open, setores, selecionado]);

  if (!open) return null;

  const setorSelecionado = setores.find((f) => f.id === selecionado) ?? null;
  const grupos = agruparPorPlano(
    selecionado === null ? [] : inventario.get(selecionado) ?? [],
  );

  const adicionar = () => {
    if (!novo.trim()) return;
    const id = criar(novo);
    setNovo('');
    if (id) setSelecionado(id);
  };

  const confirmarRemocao = (id: string, label: string) => {
    const emUso = uso.get(id);
    const aviso = emUso
      ? `\n\nEle está marcado em ${plural(emUso.localizadores, 'localizador', 'localizadores')}, em ${plural(emUso.planos, 'plano', 'planos')}, e a marcação será removida de todos.`
      : '';
    if (!window.confirm(`Remover o setor "${label}"?${aviso}`)) return;
    remover(id);
  };

  return (
    <>
      <div className="scrim no-print" onClick={onClose} />
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Setores da unidade"
        style={{ width: 'min(920px, 94vw)' }}
      >
        <div
          className="px-5 pt-4 pb-3 flex items-start gap-3"
          style={{ borderBottom: '1px solid var(--borda)' }}
        >
          <div
            className="flex items-center justify-center text-destaque"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'var(--destaque-suave)',
              border: '1px solid var(--destaque-borda)',
            }}
          >
            <Icon.Etiqueta />
          </div>
          <div className="flex-1">
            <div className="section-h">Setores da unidade</div>
            <div className="text-[12px] text-texto-3 mt-0.5">
              Quem trabalha cada localizador. A lista vale para todos os planos desta
              unidade, e cada plano leva uma cópia dela quando é exportado.
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-icon btn-ghost"
            onClick={onClose}
            aria-label="Fechar"
          >
            <Icon.X />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex">
          {/* ---------- Coluna da lista ---------- */}
          <fieldset
            disabled={somenteLeitura}
            className="flex flex-col min-h-0"
            style={{ width: 380, borderRight: '1px solid var(--borda)' }}
          >
            <div className="flex-1 overflow-auto scroll p-4 flex flex-col gap-2">
              {setores.length === 0 ? (
                <div
                  className="px-4 py-5 rounded-lg text-center"
                  style={{
                    border: '1px dashed var(--borda-forte)',
                    background: 'var(--superficie-2)',
                  }}
                >
                  <div className="font-semibold text-[14px] mb-1">
                    Nenhum setor nesta unidade
                  </div>
                  <div className="text-[12px] text-texto-3 leading-snug">
                    Crie um por setor (&ldquo;Setor de Cálculo&rdquo;) ou por servidor
                    (&ldquo;Joana Silva&rdquo;), como a sua unidade se organiza.
                  </div>
                </div>
              ) : (
                setores.map((f) => {
                  const emUso = uso.get(f.id);
                  const ativo = f.id === selecionado;
                  return (
                    <div
                      key={f.id}
                      className="rounded-lg px-2.5 py-2 flex flex-col gap-1.5"
                      style={{
                        background: ativo
                          ? 'var(--destaque-suave)'
                          : 'var(--superficie-2)',
                        border: `1px solid ${
                          ativo ? 'var(--destaque-borda)' : 'var(--borda)'
                        }`,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          className="input mono text-center"
                          style={{ width: 54, flexShrink: 0 }}
                          value={f.code}
                          maxLength={3}
                          aria-label={`Sigla de ${f.label}`}
                          onChange={(e) =>
                            atualizar(f.id, { code: e.target.value.toUpperCase() })
                          }
                        />
                        <input
                          className="input flex-1 min-w-0"
                          value={f.label}
                          aria-label="Nome do setor"
                          onFocus={() => setSelecionado(f.id)}
                          onChange={(e) => atualizar(f.id, { label: e.target.value })}
                        />
                        <button
                          type="button"
                          className="btn btn-sm btn-icon btn-ghost flex-shrink-0"
                          onClick={() => confirmarRemocao(f.id, f.label)}
                          aria-label={`Remover ${f.label}`}
                        >
                          <Icon.Trash />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className="flex gap-1"
                          role="group"
                          aria-label={`Cor de ${f.label}`}
                        >
                          {CORES_FLAG.map((c) => (
                            <button
                              key={c}
                              type="button"
                              className={cn(
                                `flag-chip flag-cor-${c}`,
                                'cursor-pointer',
                                f.cor === c && 'ring-2 ring-destaque',
                              )}
                              style={{ width: 16 }}
                              aria-label={`Cor ${c}`}
                              aria-pressed={f.cor === c}
                              onClick={() => atualizar(f.id, { cor: c })}
                            />
                          ))}
                        </div>
                        <span className="ml-auto text-[10.5px] text-texto-3">
                          {emUso
                            ? `${plural(emUso.localizadores, 'localizador', 'localizadores')} · ${plural(emUso.planos, 'plano', 'planos')}`
                            : 'sem uso'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div
              className="px-4 py-3 flex items-center gap-2"
              style={{ borderTop: '1px solid var(--borda)', background: 'var(--fundo)' }}
            >
              <input
                className="input flex-1 min-w-0"
                placeholder="Novo setor ou servidor…"
                value={novo}
                aria-label="Nome do novo setor"
                onChange={(e) => setNovo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  adicionar();
                }}
              />
              <button
                type="button"
                className="btn btn-primary flex-shrink-0"
                onClick={adicionar}
                disabled={!novo.trim()}
              >
                <Icon.Plus /> Adicionar
              </button>
            </div>
          </fieldset>

          {/* ---------- Coluna do inventário ----------
              Fora do fieldset de propósito: escolher qual setor inspecionar é
              leitura, e precisa continuar funcionando em visualização. */}
          <div className="flex-1 min-w-0 flex flex-col min-h-0">
            {setorSelecionado === null ? (
              <div className="flex-1 flex items-center justify-center p-6 text-[12px] text-texto-3 text-center">
                Crie um setor à esquerda para ver o que ele trabalha.
              </div>
            ) : (
              <>
                <div
                  className="px-5 py-3 flex items-center gap-2 flex-wrap"
                  style={{ borderBottom: '1px solid var(--borda)' }}
                >
                  <span className={`flag-chip flag-cor-${setorSelecionado.cor}`}>
                    {setorSelecionado.code}
                  </span>
                  <span className="font-semibold text-[13.5px]">
                    {setorSelecionado.label || 'Sem nome'}
                  </span>
                  <span className="mono text-[11px] text-texto-3">
                    {plural(
                      uso.get(setorSelecionado.id)?.localizadores ?? 0,
                      'localizador',
                      'localizadores',
                    )}{' '}
                    em{' '}
                    {plural(uso.get(setorSelecionado.id)?.planos ?? 0, 'plano', 'planos')}
                  </span>
                </div>

                <div className="flex-1 overflow-auto scroll p-5 flex flex-col gap-4">
                  {grupos.length === 0 ? (
                    <div
                      className="text-center text-texto-3 text-[12px] leading-snug"
                      style={{
                        padding: 24,
                        border: '1px dashed var(--borda-forte)',
                        borderRadius: 8,
                      }}
                    >
                      Nenhum localizador marcado com este setor ainda. Marque no painel
                      do localizador, à direita do canvas.
                    </div>
                  ) : (
                    grupos.map((g) => (
                      <div key={g.planoId}>
                        <div
                          className="flex items-baseline gap-2 mb-1.5 pb-1.5"
                          style={{ borderBottom: '1px solid var(--borda)' }}
                        >
                          <span className="section-h">{g.planoNome}</span>
                          <span className="mono text-[11px] text-texto-3">
                            {g.localizadores.length}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          {g.localizadores.map((l) => (
                            <div
                              key={`${g.planoId}-${l.nodeId}`}
                              className="flex items-center gap-2 py-1.5"
                              style={{ borderBottom: '1px solid var(--borda)' }}
                            >
                              <span
                                className="flex-1 min-w-0 truncate text-[12.5px]"
                                style={{
                                  color: l.nome ? 'var(--texto)' : 'var(--texto-3)',
                                }}
                              >
                                {l.nome || 'Sem nome'}
                              </span>
                              {l.sistema && <BadgeSistema />}
                              {!l.sistema && l.jaCriado && (
                                <span
                                  className="mono flex-shrink-0"
                                  style={{ fontSize: 10.5, color: 'var(--ok)' }}
                                  title="Já existe no Eproc"
                                >
                                  ✓ no Eproc
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div
          className="px-5 py-3 flex items-center gap-3"
          style={{ borderTop: '1px solid var(--borda)', background: 'var(--fundo)' }}
        >
          <div className="flex-1 text-[11.5px] text-texto-3 leading-snug">
            Renomear ou trocar a cor não desfaz nenhuma marcação — só remover o setor
            faz isso, e aí em todos os planos.
          </div>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </>
  );
}
