import { Handle, Position, type NodeProps } from 'reactflow';
import type { EntradaEvento } from '@/domain';
import { Icon } from '@/components/Icon';
import { cn } from '@/utils/cn';

export interface EntradaNodeData {
  entrada: EntradaEvento;
}

/**
 * Entrada por evento (decisoes.md#D-38): o gatilho de uma regra de origem
 * "Nenhum". Só solta setas — não há de onde o processo venha.
 */
export function EntradaNode({ data, selected }: NodeProps<EntradaNodeData>) {
  const { rotulo } = data.entrada;
  return (
    <div className={cn('pj-entrada', { selected })} title="Entrada por evento: a regra dispara venha o processo de onde vier">
      <Icon.Bolt />
      <span className="pj-entrada-rotulo">{rotulo.trim() || <i>Evento?</i>}</span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
