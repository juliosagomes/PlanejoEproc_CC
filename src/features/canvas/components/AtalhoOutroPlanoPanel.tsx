import { useMemo } from 'react';
import { destinosPossiveis, resolverOutroPlano, type RefOutroPlano } from '@/domain';
import { Icon } from '@/components/Icon';
import { PanelHeader } from '@/components/PanelHeader';
import { getAtivoId } from '@/infra/storage';
import { outrosPlanos } from '../outrosPlanos';
import { useCanvasStore, type FlowNode } from '../store';

interface AtalhoOutroPlanoPanelProps {
  node: FlowNode;
  onAbrirOutroPlano: (alvo: { planoId: string; noId: string }) => void;
}

const porNome = (a: string, b: string) => a.localeCompare(b, 'pt-BR');

/**
 * Painel do atalho para outro plano (decisoes.md#D-40): escolher o plano e o
 * localizador onde o processo continua, e abrir lá.
 */
export function AtalhoOutroPlanoPanel({ node, onAbrirOutroPlano }: AtalhoOutroPlanoPanelProps) {
  const updateNode = useCanvasStore((s) => s.updateNode);
  const deleteNode = useCanvasStore((s) => s.deleteNode);
  const somenteLeitura = useCanvasStore((s) => s.somenteLeitura);

  const gravada = node.data.atalhoOutroPlano;
  const planos = useMemo(
    () => outrosPlanos(getAtivoId()).sort((a, b) => porNome(a.plano.planoNome, b.plano.planoNome)),
    [],
  );
  const destino = gravada ? resolverOutroPlano(gravada, planos) : null;
  const semDestino = !gravada || (!gravada.planoId && !gravada.nome);
  const planoEscolhido = planos.find((p) => p.id === (destino?.planoId ?? gravada?.planoId));
  const localizadores = planoEscolhido
    ? destinosPossiveis(planoEscolhido.plano.nodes)
        .filter((n) => n.data.nome.trim())
        .sort((a, b) => porNome(a.data.nome, b.data.nome))
    : [];

  const ligar = (ref: RefOutroPlano) => updateNode(node.id, { atalhoOutroPlano: ref });
  const escolherPlano = (id: string) => {
    const p = planos.find((x) => x.id === id);
    if (p) ligar({ planoId: p.id, noId: '', planoNome: p.plano.planoNome, nome: '' });
  };
  const escolherLocalizador = (id: string) => {
    const n = localizadores.find((x) => x.id === id);
    if (planoEscolhido && n) {
      ligar({ planoId: planoEscolhido.id, noId: n.id, planoNome: planoEscolhido.plano.planoNome, nome: n.data.nome });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PanelHeader
        eyebrow="Atalho para outro plano"
        title={destino ? `⇥ ${destino.nome || 'Sem nome'}` : semDestino ? 'Escolha o destino' : 'Destino não achado'}
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
          A mudança de fluxo: o processo sai deste plano e continua num
          localizador de outro. A transição que chega aqui é deste plano e entra
          no checklist com o plano de destino no nome. O localizador de destino
          é do outro plano, e é lá que ele entra no checklist.
        </p>

        {planos.length === 0 ? (
          <div className="text-[12px] text-texto-3">
            Não há outro plano nesta unidade. Crie ou importe o plano de destino primeiro.
          </div>
        ) : (
          <>
            <div>
              <label className="label" htmlFor={`plano-${node.id}`}>
                Plano
              </label>
              <select
                id={`plano-${node.id}`}
                className="select"
                value={planoEscolhido?.id ?? ''}
                disabled={somenteLeitura}
                onChange={(e) => escolherPlano(e.target.value)}
              >
                {!planoEscolhido && <option value="">— escolha o plano —</option>}
                {planos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.plano.planoNome || 'Plano sem título'}
                  </option>
                ))}
              </select>
            </div>

            {planoEscolhido && (
              <div>
                <label className="label" htmlFor={`loc-${node.id}`}>
                  Continua em
                </label>
                <select
                  id={`loc-${node.id}`}
                  className="select"
                  value={destino?.noId ?? ''}
                  disabled={somenteLeitura}
                  onChange={(e) => escolherLocalizador(e.target.value)}
                >
                  {!destino && <option value="">— escolha o localizador —</option>}
                  {localizadores.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.data.nome}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}

        {!semDestino && !destino && gravada?.nome && (
          <div className="text-[11.5px] text-aviso">
            "{gravada.nome}" não foi achado no plano "{gravada.planoNome || 'sem nome'}". O
            plano ou o localizador pode ter sido apagado ou renomeado. Escolha outro destino ou remova o atalho.
          </div>
        )}

        {destino && (
          <button
            type="button"
            className="btn"
            onClick={() => onAbrirOutroPlano({ planoId: destino.planoId, noId: destino.noId })}
          >
            Abrir no plano "{destino.planoNome || 'sem nome'}"
          </button>
        )}
        <div className="text-[11px] text-texto-3">Dica: clique duas vezes no atalho, no quadro, para abrir o outro plano.</div>
      </div>
    </div>
  );
}
