import { useCanvasStore, type FlowNode } from '../store';
import { useIrParaNo } from '../irParaNo';

interface AtalhosDoLocalizadorProps {
  node: FlowNode;
}

/** Bloco do painel do localizador: criar atalho e ir aos que já existem (D-30). */
export function AtalhosDoLocalizador({ node }: AtalhosDoLocalizadorProps) {
  const atalhos = useCanvasStore((s) => s.nodes.filter((n) => n.data.atalhoPara === node.id));
  const somenteLeitura = useCanvasStore((s) => s.somenteLeitura);
  const criarAtalho = useCanvasStore((s) => s.criarAtalho);
  const irParaNo = useIrParaNo();

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label className="label">Atalhos</label>
        {!somenteLeitura && (
          <button
            type="button"
            className="text-[11px] text-texto-3 hover:text-texto underline"
            onClick={() => criarAtalho(node.id)}
            title="Cria, logo abaixo, um nó que representa este localizador — para ligar setas sem atravessar o quadro"
          >
            Criar atalho
          </button>
        )}
      </div>
      {atalhos.length === 0 ? (
        <div className="text-[11.5px] text-texto-3 leading-snug">
          Nenhum. Um atalho evita setas longas: as transições ligadas a ele valem
          como deste localizador.
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {atalhos.map((a, i) => (
            <button
              key={a.id}
              type="button"
              className="btn btn-sm"
              onClick={() => irParaNo(a.id)}
              title="Ir até o atalho no quadro"
            >
              ↪ Atalho {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
