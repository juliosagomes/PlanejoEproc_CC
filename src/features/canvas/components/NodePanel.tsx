import { TIPO_FLAGS, type FlagKey } from '@/domain';
import { Icon } from '@/components/Icon';
import { PanelHeader } from '@/components/PanelHeader';
import { cn } from '@/utils/cn';
import { useCanvasStore, type FlowNode } from '../store';

interface NodePanelProps {
  node: FlowNode;
}

export function NodePanel({ node }: NodePanelProps) {
  const updateNode = useCanvasStore((s) => s.updateNode);
  const deleteNode = useCanvasStore((s) => s.deleteNode);
  const data = node.data;

  const setFlag = (key: FlagKey, valor: boolean) =>
    updateNode(node.id, { flags: { ...data.flags, [key]: valor } });

  return (
    <div className="flex flex-col h-full">
      <PanelHeader
        eyebrow="Nó · Localizador"
        title={data.nome || 'Sem nome'}
        right={
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => deleteNode(node.id)}
          >
            <Icon.Trash /> Remover
          </button>
        }
      />
      <div className="flex-1 overflow-auto scroll p-4 flex flex-col gap-3.5">
        <div>
          <label className="label">Nome do localizador</label>
          <input
            className="input"
            autoFocus
            value={data.nome}
            onChange={(e) => updateNode(node.id, { nome: e.target.value })}
            placeholder="Ex: Aguardando despacho"
          />
        </div>

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
          <label className="label">Flags de tipo (opcional)</label>
          <div className="flex flex-wrap gap-1.5">
            {TIPO_FLAGS.map((f) => {
              const ativa = !!data.flags[f.key];
              return (
                <button
                  key={f.key}
                  type="button"
                  className={cn('btn btn-sm', ativa && 'btn-primary')}
                  onClick={() => setFlag(f.key, !ativa)}
                >
                  <span
                    className={`flag-chip flag-${f.code}`}
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
    </div>
  );
}
