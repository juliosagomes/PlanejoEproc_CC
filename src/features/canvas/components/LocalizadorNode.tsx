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
 * Localizador **padrão do Eproc** ganha faixa âmbar à esquerda e sai do eixo
 * `ja_criado` por completo — nem tracejado, nem badge verde. Não é algo que a
 * secretaria crie, então nem "falta criar" nem "já criei" dizem a verdade sobre
 * ele (decisoes.md#D-23).
 *
 * Não tem estado próprio — toda mutação flui pela store (Fase 5). Lê `flags`
 * dali porque as definições são do plano, não do nó: o nó guarda só ids.
 */
/**
 * `copias` não é do domínio: o `FlowCanvas` acrescenta na decoração quando o
 * mesmo localizador aparece mais de uma vez no plano.
 */
export type LocalizadorNodeData = LocalizadorData & { copias?: number };

export function LocalizadorNode(props: NodeProps<LocalizadorNodeData>) {
  if (props.data.atalhoPara !== undefined) {
    return <AtalhoNode alvoId={props.data.atalhoPara} selected={props.selected ?? false} />;
  }
  return <LocalizadorCartao {...props} />;
}

function LocalizadorCartao({ data, selected }: NodeProps<LocalizadorNodeData>) {
  const definicoes = useCanvasStore((s) => s.flags);

  // A ordem é a da lista do plano, não a de marcação — assim dois nós com as
  // mesmas flags mostram os chips na mesma sequência. Id sem definição
  // (apagada noutra aba) simplesmente não casa e some.
  const flagsAtivas = definicoes.filter((f) => data.flags.includes(f.id));

  return (
    <div
      className={cn('pj-node', {
        selected: selected ?? false,
        created: !data.sistema && data.ja_criado,
        'not-created': !data.sistema && !data.ja_criado,
        sistema: data.sistema ?? false,
      })}
      {...(data.sistema ? { title: 'Localizador padrão do Eproc' } : {})}
    >
      <Handle type="target" position={Position.Left} />

      {data.ja_criado && !data.sistema && (
        <span className="ok-corner" title="Já criado no Eproc">
          <Icon.CheckCorner />
        </span>
      )}

      {data.copias !== undefined && data.copias > 1 && (
        <span
          className="pj-node-copias mono"
          title={`Este localizador aparece ${data.copias} vezes no plano`}
          aria-label={`${data.copias} cópias no plano`}
        >
          ×{data.copias}
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

/**
 * Atalho para outro localizador do plano (decisoes.md#D-30): uma pílula com o
 * nome do alvo, lido da store a cada render — o atalho não guarda nome próprio,
 * então renomear o alvo renomeia todos os atalhos. Alvo apagado deixa o atalho
 * vermelho, em vez de sumir com ele e com as setas que chegam nele.
 */
function AtalhoNode({ alvoId, selected }: { alvoId: string; selected: boolean }) {
  const nomeAlvo = useCanvasStore((s) => {
    const alvo = s.nodes.find((n) => n.id === alvoId);
    return alvo && alvo.data.atalhoPara === undefined ? alvo.data.nome : null;
  });
  const orfao = nomeAlvo === null;
  return (
    <div
      className={cn('pj-atalho', { selected, orfao })}
      title={
        orfao
          ? 'O localizador de destino foi apagado. Aponte o atalho para outro ou remova-o.'
          : `Atalho para "${nomeAlvo || 'sem nome'}" — clique duas vezes para ir até lá`
      }
    >
      <Handle type="target" position={Position.Left} />
      <span className="pj-atalho-seta" aria-hidden>
        {orfao ? '⚠' : '↪'}
      </span>
      {orfao ? (
        <span>alvo removido</span>
      ) : (
        <span className="pj-atalho-nome">{nomeAlvo || <i>sem nome</i>}</span>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
