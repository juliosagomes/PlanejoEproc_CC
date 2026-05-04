import { Handle, Position, type NodeProps } from 'reactflow';
import { TIPO_FLAGS, type LocalizadorData } from '@/domain';
import { Icon } from '@/components/Icon';
import { cn } from '@/utils/cn';

/**
 * Nó custom do canvas — um localizador do Eproc.
 *
 * Visual: cartão com nome, descrição e chips de flag (T/E/G/F). Borda
 * tracejada quando ainda **não foi criado** no Eproc; sólida quando criado,
 * com badge verde no canto superior direito. Selo de seleção quando ativo.
 *
 * Não tem estado próprio — toda mutação flui pela store (Fase 5).
 */
export function LocalizadorNode({ data, selected }: NodeProps<LocalizadorData>) {
  const flagsAtivas = TIPO_FLAGS.filter((f) => data.flags[f.key]);

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
            <span key={f.key} className={`flag-chip flag-${f.code}`} title={f.label}>
              {f.code}
            </span>
          ))}
        </div>
      )}

      <Handle type="source" position={Position.Right} />
    </div>
  );
}
