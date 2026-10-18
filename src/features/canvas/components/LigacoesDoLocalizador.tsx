import { useMemo } from 'react';
import { KIND_LABELS, atalhosPara, nomeDaPonta } from '@/domain';
import { Icon } from '@/components/Icon';
import { useIrParaAresta } from '../irParaNo';
import { useCanvasStore, type FlowEdge, type FlowNode } from '../store';

interface Ligacao {
  aresta: FlowEdge;
  /** O localizador da outra ponta. */
  outro: string;
  /** O resumo, ou, sem ele, os nomes dos recursos. */
  sobre: string;
}

function sobre(a: FlowEdge): string {
  const resumo = a.data?.resumo.trim();
  if (resumo) return resumo;
  return (a.data?.subitems ?? []).map((s) => s.nome.trim()).filter(Boolean).join(' · ');
}

/**
 * As transições que chegam e saem do localizador, para andar pelo fluxo a
 * partir do painel, sem caçar a seta no quadro (decisoes.md#D-44). Contam as
 * setas dos atalhos dele: no Eproc é o mesmo localizador.
 */
export function LigacoesDoLocalizador({ node, ehDescarte }: { node: FlowNode; ehDescarte: boolean }) {
  const irParaAresta = useIrParaAresta();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const grupos = useCanvasStore((s) => s.grupos);
  const entradas = useCanvasStore((s) => s.entradas);

  const { entram, saem } = useMemo(() => {
    const meus = new Set([node.id, ...atalhosPara(nodes, node.id)]);
    const ligacao = (a: FlowEdge, outroId: string): Ligacao => ({
      aresta: a,
      outro: nomeDaPonta(nodes, grupos, outroId, entradas),
      sobre: sobre(a),
    });
    return {
      entram: edges.filter((a) => meus.has(a.target)).map((a) => ligacao(a, a.source)),
      saem: edges.filter((a) => meus.has(a.source)).map((a) => ligacao(a, a.target)),
    };
  }, [node.id, nodes, edges, grupos, entradas]);

  const temRegraPendurada = (node.data.regrasSemMover?.length ?? 0) > 0;

  const linha = (l: Ligacao, sentido: 'de' | 'para') => {
    const kind = l.aresta.data?.kind ?? 'manual';
    return (
      <button
        key={l.aresta.id}
        type="button"
        className="ligacao"
        onClick={() => irParaAresta(l.aresta.id, l.aresta.source, l.aresta.target)}
        title="Ir até a transição"
      >
        <span className={`busca-selo busca-selo-${kind}`}>{KIND_LABELS[kind]}</span>
        <span className="alvo">
          {sentido} {l.outro.trim() || '(sem nome)'}
          {l.sobre && <span className="res">{l.sobre}</span>}
        </span>
        <span className="text-texto-3" style={{ transform: 'rotate(-90deg)', display: 'inline-flex' }} aria-hidden>
          <Icon.ChevronDown />
        </span>
      </button>
    );
  };

  return (
    <div>
      <label className="label">Entradas · {entram.length}</label>
      {entram.length > 0 ? (
        entram.map((l) => linha(l, 'de'))
      ) : (
        <div className="text-[11.5px] text-texto-3 leading-snug">Nenhuma. É aqui que o fluxo começa.</div>
      )}
      <label className="label" style={{ marginTop: 12 }}>
        Saídas · {saem.length}
      </label>
      {saem.length > 0 ? (
        saem.map((l) => linha(l, 'para'))
      ) : (
        <div
          className="text-[11.5px] leading-snug"
          style={{ color: entram.length > 0 && !ehDescarte && !temRegraPendurada ? 'var(--aviso-texto)' : 'var(--texto-3)' }}
        >
          {/* Fim de linha é aviso só quando algo chega aqui e nada sai: um
              localizador solto ainda está sendo desenhado. */}
          {entram.length > 0 && !ehDescarte && !temRegraPendurada
            ? 'Nenhuma saída: o processo para aqui. É isso mesmo?'
            : 'Nenhuma.'}
        </div>
      )}
    </div>
  );
}
