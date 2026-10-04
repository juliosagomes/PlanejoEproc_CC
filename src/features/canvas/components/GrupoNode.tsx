import { Handle, NodeResizer, Position, type NodeProps } from 'reactflow';
import type { GrupoLocalizadores } from '@/domain';
import { cn } from '@/utils/cn';
import { useCanvasStore } from '../store';

export interface GrupoNodeData {
  grupo: GrupoLocalizadores;
}

/**
 * Moldura de grupo (decisoes.md#D-31). Arrastar pela moldura leva os membros —
 * isso é a store, ao receber a mudança de posição. Selecionada, ganha as alças
 * de redimensionar. Recolhida, vira um bloco com a contagem, e as setas dos
 * membros passam a chegar nas alças dela.
 */
export function GrupoNode({ data, selected }: NodeProps<GrupoNodeData>) {
  const { grupo } = data;
  const somenteLeitura = useCanvasStore((s) => s.somenteLeitura);
  const atualizarGrupo = useCanvasStore((s) => s.atualizarGrupo);
  const n = grupo.membros.length;

  return (
    <div
      className={cn('pj-grupo', `pj-grupo-cor-${grupo.cor}`, {
        selected,
        recolhido: grupo.recolhido,
      })}
    >
      {!grupo.recolhido && (
        <NodeResizer
          isVisible={selected && !somenteLeitura}
          minWidth={120}
          minHeight={80}
          lineClassName="pj-grupo-resize-linha"
          handleClassName="pj-grupo-resize-alca"
        />
      )}
      <div className="pj-grupo-rotulo">
        <button
          type="button"
          className="nodrag"
          onClick={() => atualizarGrupo(grupo.id, { recolhido: !grupo.recolhido })}
          disabled={somenteLeitura}
          aria-label={grupo.recolhido ? `Expandir ${grupo.rotulo}` : `Recolher ${grupo.rotulo}`}
          title={grupo.recolhido ? 'Expandir' : 'Recolher'}
        >
          {grupo.recolhido ? '▸' : '▾'}
        </button>
        <span className="truncate">{grupo.rotulo || 'Grupo sem nome'}</span>
      </div>
      {grupo.recolhido && (
        <div className="pj-grupo-resumo">
          {n} localizador{n === 1 ? '' : 'es'}
        </div>
      )}
      {/* Só recolhido as alças aparecem: é quando as setas dos membros chegam aqui. */}
      <Handle type="target" position={Position.Left} isConnectable={false} className={cn(!grupo.recolhido && 'invisible')} />
      <Handle type="source" position={Position.Right} isConnectable={false} className={cn(!grupo.recolhido && 'invisible')} />
    </div>
  );
}
