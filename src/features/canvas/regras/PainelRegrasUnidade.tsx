import { useMemo, useState, type DragEvent } from 'react';
import { ehAtalho, nomeEfetivo, type RegraAtpUnidade } from '@/domain';
import { Icon } from '@/components/Icon';
import { useUnidadeStore } from '@/features/catalogo/storeUnidade';
import { chaveNome } from '@/features/painel/presencaRegras';
import { semDecoracao } from '@/infra/eproc/nomeLocalizador';
import { cn } from '@/utils/cn';
import { nomesDaRegra, regrasNoQuadro } from '../desenharRegra';
import { useCanvasStore } from '../store';
import { REGRA_ATP_DATATYPE, useRegrasQuadroStore } from './store';

/**
 * Lista lateral das regras de ATP da unidade, para desenhar no plano aberto
 * (decisoes.md#D-47, demo 11). Primeiro as que tocam algum localizador do
 * plano, agrupadas como no Eproc; as demais aparecem pela busca. Arrastar para
 * o quadro ou clicar no "+" só abre a prévia.
 */
export function PainelRegrasUnidade() {
  const aberto = useRegrasQuadroStore((s) => s.painelAberto);
  const alternar = useRegrasQuadroStore((s) => s.alternarPainel);
  const prever = useRegrasQuadroStore((s) => s.prever);
  const catalogo = useUnidadeStore((s) => s.catalogo);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const somenteLeitura = useCanvasStore((s) => s.somenteLeitura);
  const [busca, setBusca] = useState('');

  const regras = useMemo(() => catalogo?.regrasAtp ?? [], [catalogo]);
  const feitas = useMemo(() => regrasNoQuadro({ nodes, edges }), [nodes, edges]);
  const doPlano = useMemo(() => {
    const chaves = new Set(nodes.filter((n) => !ehAtalho(n)).map((n) => chaveNome(nomeEfetivo(nodes, n.id))));
    return new Set(regras.filter((r) => nomesDaRegra(r).some((n) => chaves.has(chaveNome(n)))).map((r) => r.numero));
  }, [nodes, regras]);

  const alvo = semDecoracao(busca);
  const visiveis = regras.filter((r) => {
    if (!alvo) return doPlano.has(r.numero);
    if (/^\d+$/.test(busca.trim())) return String(r.numero).startsWith(busca.trim());
    return semDecoracao([...nomesDaRegra(r), r.descricao ?? '', r.grupo ?? '', r.tipoControle].join(' ')).includes(alvo);
  });
  const porGrupo = new Map<string, RegraAtpUnidade[]>();
  for (const r of visiveis) {
    const g = r.grupo ?? 'Sem grupo';
    porGrupo.set(g, [...(porGrupo.get(g) ?? []), r]);
  }

  if (!aberto) return null;

  return (
    <aside
      className="no-print bg-superficie flex flex-col flex-shrink-0 min-h-0"
      style={{ width: 320, borderRight: '1px solid var(--borda)' }}
      aria-label="Regras de ATP da unidade"
    >
      <div className="px-3.5 pt-3 pb-2.5 flex flex-col gap-2" style={{ borderBottom: '1px solid var(--borda)' }}>
        <div className="flex items-center gap-2">
          <h2 className="section-h flex-1 m-0">Regras da unidade</h2>
          <button
            type="button"
            className="btn btn-icon btn-sm btn-ghost"
            onClick={() => alternar(false)}
            aria-label="Fechar a lista de regras"
            title="Fechar"
          >
            <Icon.X />
          </button>
        </div>
        <input
          className="input"
          type="search"
          placeholder="Buscar por nº, localizador ou grupo…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          aria-label="Buscar regra da unidade"
        />
        {!somenteLeitura && regras.length > 0 && (
          <div className="text-[11px] text-texto-3 leading-snug">
            Arraste uma regra para o quadro, ou use o "+". Antes de desenhar, o app mostra o que vai
            mudar.
          </div>
        )}
      </div>

      <div className="overflow-auto flex-1 px-2.5 py-2">
        {regras.length === 0 ? (
          <p className="text-[12px] text-texto-3 leading-snug p-1">
            Nenhuma regra sincronizada. Use <b>Unidade → Sincronizar com a unidade</b>.
          </p>
        ) : porGrupo.size === 0 ? (
          <p className="text-[12px] text-texto-3 leading-snug p-1">
            {alvo
              ? 'Nenhuma regra com essa busca.'
              : 'Nenhuma regra toca os localizadores deste plano. Busque pelo nº ou pelo nome.'}
          </p>
        ) : (
          [...porGrupo.entries()].map(([g, rs]) => {
            const pendentes = rs.filter((r) => !feitas.has(r.numero)).map((r) => r.numero);
            return (
              <section key={g} className="mb-2.5" aria-label={`Grupo ${g}`}>
                <div className="flex items-center justify-between gap-2 text-[10.5px] font-semibold uppercase tracking-wide text-texto-3 mx-1 mt-2 mb-1.5">
                  <span className="truncate">{g}</span>
                  {!somenteLeitura && pendentes.length > 1 && (
                    <button type="button" className="btn btn-sm btn-ghost normal-case" onClick={() => prever(pendentes)}>
                      Desenhar as {pendentes.length}
                    </button>
                  )}
                </div>
                {rs.map((r) => (
                  <CartaoRegra
                    key={r.numero}
                    regra={r}
                    feita={feitas.has(r.numero)}
                    somenteLeitura={somenteLeitura}
                    onPrever={() => prever([r.numero])}
                  />
                ))}
              </section>
            );
          })
        )}
      </div>
    </aside>
  );
}

interface CartaoRegraProps {
  regra: RegraAtpUnidade;
  feita: boolean;
  somenteLeitura: boolean;
  onPrever: () => void;
}

function CartaoRegra({ regra: r, feita, somenteLeitura, onPrever }: CartaoRegraProps) {
  const arrastavel = !feita && !somenteLeitura;
  const origem =
    r.tipoOrigem === 'nenhum'
      ? `Nenhum${r.filtroContem?.length ? ` · filtro ${r.filtroContem.join(', ')}` : ''}`
      : r.tipoOrigem === 'todos'
        ? 'Todos os localizadores'
        : r.origens.join(r.opcaoOrigens === 'AND' ? ' E ' : ' OU ');
  const arrastar = (e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData(REGRA_ATP_DATATYPE, String(r.numero));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div
      className={cn(
        'flex gap-2 items-start rounded-[9px] border border-borda-forte bg-superficie px-2.5 py-2 mb-1.5',
        arrastavel ? 'cursor-grab hover:border-destaque-borda' : 'opacity-50',
      )}
      draggable={arrastavel}
      onDragStart={arrastavel ? arrastar : undefined}
      title={feita ? 'Já está no plano' : undefined}
    >
      <span className="mono text-[11.5px] font-bold text-destaque w-8 flex-shrink-0 pt-px">{r.numero}</span>
      <span className="flex-1 min-w-0 text-[12px] leading-snug">
        <b className="block font-semibold break-words">{r.descricao ?? r.tipoControle}</b>
        {r.descricao && <small className="block text-texto-3 text-[11px]">{r.tipoControle}</small>}
        <small className="block text-texto-3 text-[11px] break-words">
          {origem} → {r.destinos.join(' E ') || '—'}
        </small>
        {!r.ativa && <small className="block text-aviso text-[11px]">desativada no Eproc</small>}
      </span>
      {feita ? (
        <span className="text-ok text-[11px] pt-px" aria-label="Já está no plano">
          ✓
        </span>
      ) : (
        !somenteLeitura && (
          <button
            type="button"
            className="btn btn-sm btn-icon flex-shrink-0"
            onClick={onPrever}
            title="Desenhar no plano"
            aria-label={`Desenhar a regra ${r.numero}`}
          >
            <Icon.Plus />
          </button>
        )
      )}
    </div>
  );
}
