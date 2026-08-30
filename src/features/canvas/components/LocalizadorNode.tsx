import { Handle, Position, type NodeProps } from 'reactflow';
import type { LocalizadorData } from '@/domain';
import { Icon } from '@/components/Icon';
import { cn } from '@/utils/cn';
import { useCanvasStore } from '../store';

/**
 * Nó custom do canvas — um localizador do Eproc.
 *
 * Visual: cartão com nome, descrição e os chips das flags marcadas. Borda
 * tracejada quando ainda **não foi criado** no Eproc; sólida quando criado,
 * com badge verde no canto superior direito. Selo de seleção quando ativo.
 *
 * Não tem estado próprio — toda mutação flui pela store (Fase 5). Lê `flags`
 * dali porque as definições são do plano, não do nó: o nó guarda só ids.
 */
export function LocalizadorNode({ data, selected }: NodeProps<LocalizadorData>) {
  const definicoes = useCanvasStore((s) => s.flags);

  // A ordem é a da lista do plano, não a de marcação — assim dois nós com as
  // mesmas flags mostram os chips na mesma sequência. Id sem definição
  // (apagada noutra aba) simplesmente não casa e some.
  const flagsAtivas = definicoes.filter((f) => data.flags.includes(f.id));

  return (
    <div
      className={cn('pj-node', {
        selected: selected ?? false,
        created: data.ja_criado,
        'not-created': !data.ja_criado,
      })}
    >
      <Handle type="target" position={Position.Left} />

      {data.ja_criado && (
        <span className="ok-corner" title="Já criado no Eproc">
          <Icon.CheckCorner />
        </span>
      )}

      <div className="pj-node-name">
        {data.nome ? (
          data.nome
        ) : (
          <span className="font-normal italic text-texto-3">Sem nome</span>
        )}
      </div>

      {data.descricao && <div className="pj-node-desc">{data.descricao}</div>}

      {flagsAtivas.length > 0 && (
        <div className="pj-node-flags">
          {flagsAtivas.map((f) => (
            <span key={f.id} className={`flag-chip flag-cor-${f.cor}`} title={f.label}>
              {f.code}
            </span>
          ))}
        </div>
      )}

      <Handle type="source" position={Position.Right} />
    </div>
  );
}
