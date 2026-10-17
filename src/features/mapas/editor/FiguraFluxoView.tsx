import { useMemo } from 'react';
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react';
import { useCanvasStore } from '@/features/canvas/store';
import { useSetoresStore } from '@/features/setores/store';
import { blocoDesatualizado, desenharBloco } from '../fluxoPapel';
import { planoPorId } from '../planos';
import { sanitizarSvgFluxo } from '../sanitizar';
import { atributosDoBloco, blocoDosAtributos, FiguraFluxo } from './extensoes';

/**
 * O desenho do fluxo dentro do editor: o mesmo HTML da impressão, mais o aviso
 * de plano mudado. "Atualizar desenho" é uma transação comum — entra no
 * desfazer, e um Ctrl+Z devolve o desenho anterior.
 */
function FiguraFluxoView({ node, updateAttributes, editor }: ReactNodeViewProps) {
  const setores = useSetoresStore((s) => s.setores);
  // O plano ativo mudando é o gatilho de reconferir o desenho.
  const nodesAtivos = useCanvasStore((s) => s.nodes);
  const bloco = useMemo(() => blocoDosAtributos(node.attrs), [node.attrs]);
  const plano = useMemo(() => (bloco ? planoPorId(bloco.planoId) : null), [bloco, nodesAtivos]);
  const estado = !bloco ? 'nao' : plano === null ? 'sumiu' : blocoDesatualizado(bloco, plano) ? 'mudou' : 'nao';

  const atualizar = () => {
    if (!bloco || !plano) return;
    updateAttributes(atributosDoBloco(desenharBloco(plano, bloco.planoId, bloco.nos, bloco.fora, setores, new Date().toISOString())));
  };

  const data = bloco ? new Date(bloco.desenhadoEm).toLocaleDateString('pt-BR') : '';
  return (
    <NodeViewWrapper as="figure" className="fluxo-bloco" contentEditable={false} data-drag-handle="">
      {editor.isEditable && estado !== 'nao' && bloco && (
        <div className="fluxo-aviso">
          {estado === 'sumiu'
            ? `O plano "${bloco.planoNome}" não existe mais neste silo. O desenho fica como estava.`
            : 'O plano mudou depois deste desenho.'}
          {estado === 'mudou' && (
            <button type="button" onClick={atualizar}>
              Atualizar desenho
            </button>
          )}
        </div>
      )}
      {bloco && (
        <div className="fluxo-cab">
          Fluxo do plano {bloco.planoNome} · {bloco.nos.length} localizador{bloco.nos.length === 1 ? '' : 'es'} · desenhado em {data}
        </div>
      )}
      <div className="fluxo-svg" dangerouslySetInnerHTML={{ __html: sanitizarSvgFluxo(bloco?.svg ?? '') }} />
    </NodeViewWrapper>
  );
}

export const FiguraFluxoComVisao = FiguraFluxo.extend({
  addNodeView() {
    return ReactNodeViewRenderer(FiguraFluxoView);
  },
});
