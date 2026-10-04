import { ehAtalho } from '@/domain';
import { Icon } from '@/components/Icon';
import { PanelHeader } from '@/components/PanelHeader';
import { useIrParaNo } from '../irParaNo';
import { useCanvasStore, type FlowNode } from '../store';

interface AtalhoPanelProps {
  node: FlowNode;
}

/**
 * Painel de um atalho (decisoes.md#D-30). Não há o que editar no localizador
 * aqui — isso é no alvo —, só para onde o atalho aponta.
 */
export function AtalhoPanel({ node }: AtalhoPanelProps) {
  const nodes = useCanvasStore((s) => s.nodes);
  const updateNode = useCanvasStore((s) => s.updateNode);
  const deleteNode = useCanvasStore((s) => s.deleteNode);
  const somenteLeitura = useCanvasStore((s) => s.somenteLeitura);
  const irParaNo = useIrParaNo();

  const alvoId = node.data.atalhoPara ?? '';
  const candidatos = nodes
    .filter((n) => !ehAtalho(n))
    .sort((a, b) => a.data.nome.localeCompare(b.data.nome, 'pt-BR'));
  const alvo = candidatos.find((n) => n.id === alvoId);

  return (
    <div className="flex flex-col h-full">
      <PanelHeader
        eyebrow="Atalho"
        title={alvo ? `→ ${alvo.data.nome || 'Sem nome'}` : 'Alvo removido'}
        right={
          somenteLeitura ? undefined : (
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => deleteNode(node.id)}>
              <Icon.Trash /> Remover
            </button>
          )
        }
      />
      <div className="flex-1 overflow-auto scroll p-4 flex flex-col gap-3.5">
        <p className="text-[12px] text-texto-2 leading-relaxed m-0">
          Um atalho representa outro localizador deste plano, para evitar setas
          longas cruzando o quadro. As transições que chegam ou saem daqui valem
          como transições do localizador de destino — inclusive no checklist.
        </p>

        <div>
          <label className="label" htmlFor={`alvo-${node.id}`}>
            Leva a
          </label>
          <select
            id={`alvo-${node.id}`}
            className="select"
            value={alvo ? alvoId : ''}
            disabled={somenteLeitura}
            onChange={(e) => updateNode(node.id, { atalhoPara: e.target.value })}
          >
            {!alvo && <option value="">— escolha o localizador —</option>}
            {candidatos.map((n) => (
              <option key={n.id} value={n.id}>
                {n.data.nome || 'Sem nome'}
              </option>
            ))}
          </select>
          {!alvo && (
            <div className="text-[11.5px] text-aviso mt-1.5">
              O localizador de destino foi apagado. Escolha outro ou remova o atalho.
            </div>
          )}
        </div>

        {alvo && (
          <button type="button" className="btn" onClick={() => irParaNo(alvo.id)}>
            Ir para o localizador
          </button>
        )}
        <div className="text-[11px] text-texto-3">Dica: clique duas vezes no atalho, no quadro, para ir até o localizador.</div>
      </div>
    </div>
  );
}
