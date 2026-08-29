import type { DragEvent } from 'react';
import { Icon } from '@/components/Icon';

/** Tipo MIME interno usado para identificar o drag-and-drop de "novo localizador". */
export const NEW_NODE_DATATYPE = 'application/x-pj-newnode';

interface SidebarProps {
  /** Disparado quando o usuário clica no botão (ou faz double-click no card). */
  onCreateNode: () => void;
  /** Sessão de visualização: some com a área de "Adicionar". */
  somenteLeitura?: boolean;
  /** Reabre o tutorial de slides. Disponível também em visualização — ler é inofensivo. */
  onVerTutorial: () => void;
}

/**
 * Coluna esquerda — área de "Adicionar" (drag/drop ou clique para criar nó),
 * legenda dos tipos de transição e dicas de uso.
 *
 * O drop em si é tratado pelo `FlowCanvas` (Fase 6) — aqui só configuramos o
 * `dataTransfer` na origem.
 *
 * Some inteira quando o usuário clica na marca do cabeçalho — é o botão de
 * mostrar/esconder, e quem já sabe arrastar não precisa da legenda ocupando
 * 220px de tela.
 */
export function Sidebar({
  onCreateNode,
  somenteLeitura = false,
  onVerTutorial,
}: SidebarProps) {
  const onDragStart = (e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData(NEW_NODE_DATATYPE, '1');
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside
      id="pj-sidebar"
      className="flex flex-col h-full no-print bg-superficie border-r border-borda flex-shrink-0"
      style={{ width: 220 }}
    >
      {somenteLeitura ? (
        <div className="p-3 border-b border-borda">
          <div className="section-h mb-2">Visualização</div>
          <div className="text-[11.5px] text-texto-2 leading-snug">
            Você entrou com o código de leitura desta lotação. Dá para abrir os
            planos, gerar checklist e salvar cópia — mas não alterar nada.
          </div>
        </div>
      ) : (
      <div className="p-3 border-b border-borda">
        <div className="section-h mb-2">Adicionar</div>
        <div
          draggable
          onDragStart={onDragStart}
          onDoubleClick={onCreateNode}
          className="flex flex-col items-center justify-center gap-1 rounded-lg p-3 text-center cursor-grab"
          style={{
            border: '1px dashed var(--borda-forte)',
            background: 'var(--superficie-2)',
          }}
          title="Arraste para o canvas, ou clique"
        >
          <span
            className="inline-flex items-center justify-center bg-superficie text-texto-2"
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              border: '1px solid var(--borda-forte)',
            }}
          >
            <Icon.Plus />
          </span>
          <div className="text-xs font-medium mt-1">Novo localizador</div>
          <div className="text-[10.5px] text-texto-3 leading-snug">
            arraste, ou clique para criar
          </div>
        </div>
        <button
          type="button"
          className="btn w-full justify-center mt-2"
          onClick={onCreateNode}
        >
          <Icon.Plus /> Criar nó
        </button>
      </div>
      )}

      <div className="p-3 flex-1 overflow-auto scroll text-[11.5px] text-texto-2 leading-relaxed">
        <div className="section-h mb-2">Como usar</div>
        {somenteLeitura ? (
          <ul className="list-disc pl-4 mb-3.5">
            <li>Clique num nó/aresta para ver os detalhes à direita.</li>
            <li>
              Para editar, entre de novo com o <strong>código de edição</strong>.
            </li>
          </ul>
        ) : (
          <ul className="list-disc pl-4 mb-3.5">
            <li>Clique num nó/aresta para editar à direita.</li>
            <li>Conecte nós arrastando das alças laterais.</li>
            <li>
              Marque <strong>já existe no Eproc</strong> conforme criar.
            </li>
            <li>Tudo é salvo automaticamente.</li>
          </ul>
        )}

        {/* Fora do <ul>: um <button> dentro de um item com marcador fica torto. */}
        <button
          type="button"
          className="btn btn-sm w-full justify-center mb-3.5"
          onClick={onVerTutorial}
        >
          <Icon.Ajuda /> Ver tutorial
        </button>

        <div className="section-h mb-2">Tipos de transição</div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="bg-aresta-atp" style={{ width: 24, height: 2 }} />
            ATP <span className="text-texto-3">animada</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-aresta-pref" style={{ width: 24, height: 2 }} />
            Preferência
          </div>
          <div className="flex items-center gap-2">
            <span
              style={{ width: 24, height: 0, borderTop: '2px dashed var(--aresta-manual)' }}
            />
            Manual
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-borda text-[10.5px] text-texto-3 leading-snug">
          <div>
            Criado por <span className="text-texto-2">Júlio Henrique de Sá Gomes</span>
          </div>
          <div className="mono">julio.sa@tjmg.jus.br</div>
          <div className="mt-1.5">© Todos os direitos reservados.</div>
        </div>
      </div>
    </aside>
  );
}
