import { useEffect } from 'react';
import { Icon } from '@/components/Icon';
import { useUnidadeStore } from '@/features/catalogo/storeUnidade';
import { useIrParaNo } from '../irParaNo';
import { useCanvasStore } from '../store';
import { useRegrasQuadroStore } from './store';
import { useDesenhoPrevia } from './useDesenhoPrevia';

/**
 * A prévia de "desenhar a partir da regra" (decisoes.md#D-47): o que vai mudar
 * no plano, em frases, com as peças novas tracejadas no quadro. Nada entra sem
 * o clique em "Desenhar".
 */
export function PreviaDesenho() {
  const previa = useRegrasQuadroStore((s) => s.previa);
  const fechar = useRegrasQuadroStore((s) => s.fecharPrevia);
  const catalogo = useUnidadeStore((s) => s.catalogo);
  const desenharRegras = useCanvasStore((s) => s.desenharRegras);
  const desenho = useDesenhoPrevia();
  const irParaNo = useIrParaNo();

  useEffect(() => {
    if (!previa) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar();
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [previa, fechar]);

  if (!previa || !desenho) return null;

  const regra = previa.length === 1 ? catalogo?.regrasAtp?.find((r) => r.numero === previa[0]) : undefined;
  const op = desenho.operacoes;
  const nada =
    op.novosNos.length + op.novasEntradas.length + op.novasArestas.length + op.recursos.length + op.penduradas.length === 0;

  const desenhar = () => {
    desenharRegras(op);
    fechar();
    if (desenho.foco) {
      const foco = desenho.foco;
      // O nó novo precisa ser medido pelo ReactFlow antes de a câmera achá-lo.
      window.setTimeout(() => irParaNo(foco), 120);
    }
  };

  return (
    <div
      className="absolute right-3 top-3 z-10 bg-superficie border rounded-xl p-3.5 flex flex-col gap-2.5 overflow-auto"
      style={{
        width: 340,
        maxHeight: 'calc(100% - 24px)',
        borderColor: 'var(--destaque-borda)',
        boxShadow: '0 10px 28px -12px rgba(var(--sombra-cor), 0.45)',
      }}
      role="dialog"
      aria-label="Prévia do desenho"
    >
      <div>
        <h3 className="text-[13.5px] font-semibold m-0">
          {regra ? `Desenhar a regra ${regra.numero}` : `Desenhar ${previa.length} regras`}
        </h3>
        {regra && (
          <div className="text-[11.5px] text-texto-3">
            {regra.descricao ?? regra.tipoControle}
            {regra.grupo ? ` · ${regra.grupo}` : ''}
          </div>
        )}
      </div>

      <ul className="flex flex-col gap-1.5 m-0 p-0 list-none">
        {desenho.efeitos.map((e, i) => (
          <li key={i} className="flex gap-2 text-[12px] leading-snug">
            <span
              aria-hidden
              className={e.tipo === 'novo' ? 'text-destaque' : e.tipo === 'aviso' ? 'text-aviso' : 'text-ok'}
            >
              {e.tipo === 'novo' ? '+' : e.tipo === 'aviso' ? '!' : '✓'}
            </span>
            <span>{e.texto}</span>
          </li>
        ))}
      </ul>

      {regra && (
        <div className="text-[11.5px] text-texto-2 bg-superficie-2 border border-borda rounded-lg px-2.5 py-2 flex flex-col gap-0.5">
          {regra.gatilhoTexto && (
            <div>
              Tipo de controle: <b className="text-texto">{regra.gatilhoTexto}</b>
            </div>
          )}
          {regra.acoesTexto?.map((a, i) => (
            <div key={i}>
              Ação: <b className="text-texto">{a}</b>
            </div>
          ))}
          {regra.filtrosTexto?.length ? (
            <div>
              Filtros: <b className="text-texto">{regra.filtrosTexto.join(' · ')}</b>
            </div>
          ) : null}
          <div>
            Recurso: <b className="text-texto">Regra de ATP {regra.numero}</b>, já criado, vinculado ao nº
            do Eproc
          </div>
        </div>
      )}

      <div className="flex justify-end gap-1.5">
        <button type="button" className="btn btn-sm btn-ghost" onClick={fechar}>
          Cancelar
        </button>
        <button type="button" className="btn btn-sm btn-accent" onClick={desenhar} disabled={nada} autoFocus>
          <Icon.CheckCorner /> Desenhar
        </button>
      </div>
    </div>
  );
}
