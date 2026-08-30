import type { LocalizadorOrgao } from '@/domain';
import { Icon } from '@/components/Icon';
import { PanelHeader } from '@/components/PanelHeader';
import { AcoesPreferenciaisNoEproc } from '@/features/catalogo/components/AcoesPreferenciaisNoEproc';
import { LocalizadorNomeInput } from '@/features/catalogo/components/LocalizadorNomeInput';
import { useSugestoesLocalizador } from '@/features/catalogo/sugestoes';
import { cn } from '@/utils/cn';
import { useCanvasStore, type FlowNode } from '../store';

interface NodePanelProps {
  node: FlowNode;
  /** Abre o modal de gerenciamento das flags do plano. */
  onGerenciarFlags: () => void;
}

export function NodePanel({ node, onGerenciarFlags }: NodePanelProps) {
  const updateNode = useCanvasStore((s) => s.updateNode);
  const deleteNode = useCanvasStore((s) => s.deleteNode);
  const somenteLeitura = useCanvasStore((s) => s.somenteLeitura);
  const flags = useCanvasStore((s) => s.flags);
  const toggleFlagNoNo = useCanvasStore((s) => s.toggleFlagNoNo);
  const itensCatalogo = useSugestoesLocalizador();
  const data = node.data;

  const onPickFromCatalogo = (item: LocalizadorOrgao) =>
    updateNode(node.id, { nome: item.nome, ja_criado: true });

  return (
    <div className="flex flex-col h-full">
      <PanelHeader
        eyebrow="Nó · Localizador"
        title={data.nome || 'Sem nome'}
        right={
          somenteLeitura ? undefined : (
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => deleteNode(node.id)}
            >
              <Icon.Trash /> Remover
            </button>
          )
        }
      />
      {/* Um `fieldset[disabled]` desliga todo controle aninhado de uma vez. É
          a diferença entre um lugar para acertar e trinta — e o guarda do store
          continua embaixo, para o que não é controle de formulário.
          `display: contents` mantém o layout: o fieldset desaparece da caixa,
          só a semântica fica. */}
      <fieldset disabled={somenteLeitura} className="contents">
      <div className="flex-1 overflow-auto scroll p-4 flex flex-col gap-3.5">
        <div>
          <label className="label">Nome do localizador</label>
          <LocalizadorNomeInput
            value={data.nome}
            itens={itensCatalogo}
            autoFocus={!somenteLeitura}
            onChangeNome={(nome) => updateNode(node.id, { nome })}
            onPickFromCatalogo={onPickFromCatalogo}
            onDeleteEmpty={() => deleteNode(node.id)}
          />
        </div>

        <AcoesPreferenciaisNoEproc nome={data.nome} />

        <div>
          <label className="label">Descrição</label>
          <textarea
            className="textarea"
            rows={2}
            value={data.descricao ?? ''}
            onChange={(e) => updateNode(node.id, { descricao: e.target.value })}
            placeholder="Para que serve esta etapa…"
          />
        </div>

        <div
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg"
          style={{
            background: data.ja_criado ? 'var(--ok-suave)' : 'var(--superficie-2)',
            border: `1px solid ${data.ja_criado ? 'var(--ok-borda)' : 'var(--borda)'}`,
          }}
        >
          <input
            type="checkbox"
            className="pj-check"
            checked={data.ja_criado}
            onChange={(e) => updateNode(node.id, { ja_criado: e.target.checked })}
            id={`chk-${node.id}`}
          />
          <label
            htmlFor={`chk-${node.id}`}
            className="flex-1 text-[12.5px] font-medium cursor-pointer"
          >
            Já existe no Eproc
            <div className="text-[11px] text-texto-3 font-normal mt-px">
              Marque quando o localizador estiver criado.
            </div>
          </label>
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-2">
            <label className="label">Setores e marcadores (opcional)</label>
            {!somenteLeitura && (
              <button
                type="button"
                className="text-[11px] text-texto-3 hover:text-texto underline"
                onClick={onGerenciarFlags}
              >
                Gerenciar
              </button>
            )}
          </div>
          {flags.length === 0 ? (
            <div className="text-[11.5px] text-texto-3 leading-snug">
              Nenhum marcador definido neste plano.
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {flags.map((f) => {
                const ativa = data.flags.includes(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    className={cn('btn btn-sm', ativa && 'btn-primary')}
                    aria-pressed={ativa}
                    onClick={() => toggleFlagNoNo(node.id, f.id)}
                  >
                    <span
                      className={`flag-chip flag-cor-${f.cor}`}
                      style={
                        ativa
                          ? { background: 'rgba(255,255,255,.18)', color: '#fff' }
                          : undefined
                      }
                    >
                      {f.code}
                    </span>
                    {f.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <label className="label">Observação</label>
          <textarea
            className="textarea"
            rows={3}
            value={data.observacao ?? ''}
            onChange={(e) => updateNode(node.id, { observacao: e.target.value })}
            placeholder="Notas livres…"
          />
        </div>
      </div>
      </fieldset>
    </div>
  );
}
