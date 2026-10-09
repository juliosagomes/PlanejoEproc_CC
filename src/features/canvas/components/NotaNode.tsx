import type { NodeProps } from 'reactflow';
import { regrasCitadas, type NotaQuadro } from '@/domain';
import { cn } from '@/utils/cn';

export interface NotaNodeData {
  nota: NotaQuadro;
}

/**
 * Nota do quadro (decisoes.md#D-38): texto livre, sem alças — não liga a nada,
 * não vai ao Eproc nem ao checklist. As regras citadas no texto viram chips.
 */
export function NotaNode({ data, selected }: NodeProps<NotaNodeData>) {
  const { texto } = data.nota;
  const refs = regrasCitadas(texto);
  return (
    <div className={cn('pj-nota', { selected })}>
      {texto.trim() ? texto : <span className="pj-nota-vazia">Nota vazia</span>}
      {refs.length > 0 && (
        <div className="pj-nota-refs">
          {refs.map((n) => (
            <span key={n}>Regra {n}</span>
          ))}
        </div>
      )}
    </div>
  );
}
