import { useMemo, useState } from 'react';
import { CORES_FLAG } from '@/domain';
import { Icon } from '@/components/Icon';
import { cn } from '@/utils/cn';
import { useCanvasStore } from '@/features/canvas/store';

interface FlagsModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Gestão dos marcadores do plano — setores ou servidores, conforme a unidade
 * preferir recortar o trabalho (decisoes.md#D-22).
 *
 * A lista pertence ao plano, então tudo aqui passa pela store do canvas e é
 * gravado com o resto do plano; não há botão de salvar. Em sessão de
 * visualização o modal continua abrindo — ver quem trabalha o quê é inofensivo
 * —, mas o `fieldset[disabled]` desliga a edição de uma vez, como no NodePanel.
 */
export function FlagsModal({ open, onClose }: FlagsModalProps) {
  const flags = useCanvasStore((s) => s.flags);
  const nodes = useCanvasStore((s) => s.nodes);
  const somenteLeitura = useCanvasStore((s) => s.somenteLeitura);
  const criarFlag = useCanvasStore((s) => s.criarFlag);
  const atualizarFlag = useCanvasStore((s) => s.atualizarFlag);
  const removerFlag = useCanvasStore((s) => s.removerFlag);

  const [novo, setNovo] = useState('');

  // Quantos localizadores usam cada flag — é o que a confirmação de remoção
  // precisa dizer para o clique não ser às cegas.
  const usoPorFlag = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const n of nodes) {
      for (const id of n.data.flags) {
        contagem.set(id, (contagem.get(id) ?? 0) + 1);
      }
    }
    return contagem;
  }, [nodes]);

  if (!open) return null;

  const adicionar = () => {
    if (!novo.trim()) return;
    criarFlag(novo);
    setNovo('');
  };

  const remover = (id: string, label: string) => {
    const emUso = usoPorFlag.get(id) ?? 0;
    const aviso =
      emUso > 0
        ? `\n\nEle está marcado em ${emUso} localizador${emUso === 1 ? '' : 'es'}, e a marcação será removida.`
        : '';
    if (!window.confirm(`Remover o marcador "${label}"?${aviso}`)) return;
    removerFlag(id);
  };

  return (
    <>
      <div className="scrim no-print" onClick={onClose} />
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Setores e marcadores"
        style={{ width: 'min(560px, 92vw)' }}
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
            <div className="section-h">Setores e marcadores</div>
            <div className="text-[12px] text-texto-3 mt-0.5">
              Quem trabalha cada localizador. A lista é deste plano e viaja com ele.
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

        <fieldset disabled={somenteLeitura} className="contents">
          <div className="flex-1 overflow-auto scroll p-5 flex flex-col gap-4">
            {flags.length === 0 ? (
              <div
                className="px-4 py-5 rounded-lg text-center"
                style={{
                  border: '1px dashed var(--borda-forte)',
                  background: 'var(--superficie-2)',
                }}
              >
                <div className="font-semibold text-[14px] mb-1">
                  Nenhum marcador neste plano
                </div>
                <div className="text-[12px] text-texto-3 leading-snug">
                  Crie um por setor (&ldquo;Setor de Cálculo&rdquo;) ou por servidor
                  (&ldquo;Joana Silva&rdquo;), como a sua unidade se organiza.
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {flags.map((f) => {
                  const emUso = usoPorFlag.get(f.id) ?? 0;
                  return (
                    <div
                      key={f.id}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg"
                      style={{
                        background: 'var(--superficie-2)',
                        border: '1px solid var(--borda)',
                      }}
                    >
                      <input
                        className="input mono text-center"
                        style={{ width: 46, flexShrink: 0 }}
                        value={f.code}
                        maxLength={2}
                        aria-label={`Sigla de ${f.label}`}
                        onChange={(e) =>
                          atualizarFlag(f.id, { code: e.target.value.toUpperCase() })
                        }
                      />
                      <input
                        className="input flex-1 min-w-0"
                        value={f.label}
                        aria-label="Nome do marcador"
                        onChange={(e) => atualizarFlag(f.id, { label: e.target.value })}
                      />
                      <div
                        className="flex gap-1 flex-shrink-0"
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
                            onClick={() => atualizarFlag(f.id, { cor: c })}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-icon btn-ghost flex-shrink-0"
                        onClick={() => remover(f.id, f.label)}
                        aria-label={`Remover ${f.label}`}
                        title={
                          emUso > 0
                            ? `Em uso em ${emUso} localizador${emUso === 1 ? '' : 'es'}`
                            : 'Não está em uso'
                        }
                      >
                        <Icon.Trash />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="text-[11.5px] text-texto-3 leading-snug">
              A sigla aparece no chip do localizador; o nome, na dica ao passar o
              mouse. Renomear ou trocar a cor não desfaz nenhuma marcação — só
              remover o marcador faz isso.
            </div>
          </div>

          <div
            className="px-5 py-3 flex items-center gap-2"
            style={{ borderTop: '1px solid var(--borda)', background: 'var(--fundo)' }}
          >
            <input
              className="input flex-1"
              placeholder="Novo setor ou servidor…"
              value={novo}
              aria-label="Nome do novo marcador"
              onChange={(e) => setNovo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                adicionar();
              }}
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={adicionar}
              disabled={!novo.trim()}
            >
              <Icon.Plus /> Adicionar
            </button>
          </div>
        </fieldset>
      </div>
    </>
  );
}
