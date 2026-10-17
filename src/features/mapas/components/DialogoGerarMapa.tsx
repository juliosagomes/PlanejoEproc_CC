import { useMemo, useState } from 'react';
import { Icon } from '@/components/Icon';
import { MAPA_VERSION, type FormatoMapa, type Mapa } from '@/domain';
import { useCanvasStore } from '@/features/canvas/store';
import { useSetoresStore } from '@/features/setores/store';
import { getAtivoId } from '@/infra/storage';
import { uid } from '@/utils/uid';
import { nomeDoNo } from '../fluxoPapel';
import { gerarDocumento, gerarSlides, type LegendaMapa, type OpcoesGerar } from '../gerar';
import { useMapasStore } from '../store';
import { useCatalogoMencoes } from '../useCatalogoMencoes';
import { IconeFormato } from './IconeFormato';

interface Props {
  /** Depois de gerar: o App leva à tela dos mapas. */
  onGerado: () => void;
}

/**
 * Gerar mapa descritivo a partir dos localizadores escolhidos no quadro — o que
 * o antigo modo de impressão virou (decisoes.md#D-39). Só monta e entrega à
 * store; aberto o mapa, tudo é editável.
 */
export function DialogoGerarMapa({ onGerado }: Props) {
  const ids = useMapasStore((s) => s.pedidoGeracao);
  if (!ids) return null;
  return <Dialogo ids={ids} onGerado={onGerado} />;
}

function Dialogo({ ids, onGerado }: { ids: string[]; onGerado: () => void }) {
  const fechar = useMapasStore((s) => s.fecharGeracao);
  const adicionar = useMapasStore((s) => s.adicionar);
  const setores = useSetoresStore((s) => s.setores);
  const catalogo = useCatalogoMencoes();
  const plano = useMemo(() => useCanvasStore.getState().getPlano(), []);

  const nomes = ids.map((id) => nomeDoNo(plano, id));
  const [nome, setNome] = useState(() => {
    const primeiro = nomes[0] ?? 'Mapa';
    return ids.length > 1 ? `Mapa — ${primeiro} e mais ${ids.length - 1}` : `Mapa — ${primeiro}`;
  });
  const [formato, setFormato] = useState<FormatoMapa>('retrato');
  const [legenda, setLegenda] = useState<LegendaMapa>('tabela');
  const [fora, setFora] = useState(true);
  const [detalhe, setDetalhe] = useState(true);
  const [caixas, setCaixas] = useState(false);

  const gerar = () => {
    const planoId = getAtivoId();
    if (!planoId) return;
    const agora = new Date().toISOString();
    const titulo = nome.trim() || 'Mapa descritivo';
    const ctx = { plano, planoId, ids, setores, catalogo, agora };
    const o: OpcoesGerar = { legenda, fora, detalhe, caixas };
    const base = {
      version: MAPA_VERSION,
      id: uid('mapa'),
      nome: titulo,
      criadoEm: agora,
      atualizadoEm: agora,
      origem: { planoId, planoNome: plano.planoNome, localizadores: ids.length },
    };
    const mapa: Mapa =
      formato === 'retrato'
        ? { ...base, formato, html: gerarDocumento(ctx, titulo, o) }
        : { ...base, formato, slides: gerarSlides(ctx, titulo, o) };
    adicionar(mapa);
    fechar();
    onGerado();
  };

  const opcaoFormato = (f: FormatoMapa, titulo: string, texto: string) => (
    <button type="button" className="mapa-opcao-formato" aria-pressed={formato === f} onClick={() => setFormato(f)}>
      <IconeFormato formato={f} />
      <span>
        <b>{titulo}</b>
        <small>{texto}</small>
      </span>
    </button>
  );

  return (
    <>
      <div className="scrim no-print" onClick={fechar} />
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Gerar mapa descritivo"
        style={{ width: 'min(600px, 94vw)' }}
        onKeyDown={(e) => e.key === 'Escape' && fechar()}
      >
        <div className="px-5 pt-4 pb-3 flex items-start gap-3" style={{ borderBottom: '1px solid var(--borda)' }}>
          <div className="flex-1">
            <div className="section-h">Gerar mapa descritivo</div>
            <div className="text-[12px] text-texto-3 mt-0.5 leading-snug">
              O mapa nasce com o desenho e a descrição de cada transição, e fica todo editável. Depois é
              só imprimir ou exportar em PDF.
            </div>
          </div>
          <button type="button" className="btn btn-icon btn-sm btn-ghost" onClick={fechar} aria-label="Fechar">
            <Icon.X />
          </button>
        </div>
        <div className="p-5 flex flex-col gap-3.5 overflow-auto">
          <div className="flex flex-col gap-1.5">
            <span className="section-h">
              {ids.length} localizador{ids.length === 1 ? '' : 'es'} de {plano.planoNome}
            </span>
            <div className="flex flex-wrap gap-1">
              {nomes.map((n, i) => (
                <span key={ids[i]} className="mapa-chip-sel">
                  {n}
                </span>
              ))}
            </div>
          </div>
          <label className="flex flex-col gap-1">
            <span className="section-h">Nome</span>
            <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="section-h">Formato</span>
            <div className="grid grid-cols-2 gap-2">
              {opcaoFormato('retrato', 'Retrato · documento', 'Desenho no alto e a legenda em seguida, como um manual')}
              {opcaoFormato('paisagem', 'Paisagem · slides', 'Desenho no primeiro slide e um slide por localizador de origem')}
            </div>
          </div>
          {formato === 'retrato' && (
            <div className="flex flex-col gap-1.5">
              <span className="section-h">Legenda</span>
              <div className="mapa-segmentado" role="group" aria-label="Legenda">
                <button type="button" aria-pressed={legenda === 'tabela'} onClick={() => setLegenda('tabela')}>
                  Tabela
                </button>
                <button type="button" aria-pressed={legenda === 'origem'} onClick={() => setLegenda('origem')}>
                  Por localizador de origem
                </button>
              </div>
            </div>
          )}
          <label className="mapa-chk">
            <input type="checkbox" checked={fora} onChange={(e) => setFora(e.target.checked)} />
            <span>
              Mostrar o que entra e sai da seleção
              <small>Os localizadores de fora aparecem esmaecidos no desenho</small>
            </span>
          </label>
          <label className="mapa-chk">
            <input type="checkbox" checked={detalhe} onChange={(e) => setDetalhe(e.target.checked)} />
            <span>
              Detalhe das regras de ATP e das preferências
              <small>Os campos principais da tela do Eproc, embaixo de cada recurso</small>
            </span>
          </label>
          <label className="mapa-chk">
            <input type="checkbox" checked={caixas} onChange={(e) => setCaixas(e.target.checked)} />
            <span>
              Caixas para marcar à caneta
              <small>Para quem vai implantar riscar o que já criou</small>
            </span>
          </label>
        </div>
        <div className="px-5 py-3 flex justify-end gap-2" style={{ borderTop: '1px solid var(--borda)' }}>
          <button type="button" className="btn" onClick={fechar}>
            Cancelar
          </button>
          <button type="button" className="btn btn-accent" onClick={gerar}>
            Gerar mapa
          </button>
        </div>
      </div>
    </>
  );
}
