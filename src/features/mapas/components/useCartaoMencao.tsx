import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { TIPO_MENCAO_ROTULO, type RefMencao } from '@/domain';
import { Icon } from '@/components/Icon';
import { detalhar, lerRef, resolver, type CatalogoMencoes } from '../mencoes';
import { alvoNoFluxo, type AlvoNoFluxo } from '../verNoFluxo';

interface Acoes {
  /** `false` em sessão de visualização: o mapa abre só para ler. */
  podeEditar: boolean;
  onInserirDetalhe: (chip: HTMLElement) => void;
  onVerNoFluxo: (alvo: AlvoNoFluxo) => void;
}

interface Aberto {
  chip: HTMLElement;
  ref: RefMencao;
  left: number;
  top: number;
  acima: boolean;
}

const ESPERA_FECHAR_MS = 250;
const LARGURA = 340;

/**
 * O cartão da menção: os dados do alvo, como estão agora, e as ações. Abre ao
 * passar o mouse e espera um pouco para fechar, para dar tempo de chegar nele.
 */
export function useCartaoMencao(raizRef: RefObject<HTMLElement>, catalogo: CatalogoMencoes, acoes: Acoes): ReactNode {
  const [aberto, setAberto] = useState<Aberto | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelarFechar = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const fecharDepois = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAberto(null), ESPERA_FECHAR_MS);
  }, []);

  useEffect(() => {
    const raiz = raizRef.current;
    if (!raiz) return;
    const sobre = (e: MouseEvent) => {
      const chip = (e.target as Element).closest?.('.mencao') as HTMLElement | null;
      if (!chip || document.querySelector('.menu-mencao')) return;
      cancelarFechar();
      const ref = lerRef(chip);
      if (!ref) return;
      const r = chip.getBoundingClientRect();
      setAberto((a) =>
        a?.chip === chip
          ? a
          : {
              chip,
              ref,
              left: Math.max(8, Math.min(r.left, window.innerWidth - LARGURA - 8)),
              top: r.bottom,
              acima: r.bottom > window.innerHeight * 0.6,
            },
      );
    };
    const fora = (e: MouseEvent) => {
      if ((e.target as Element).closest?.('.mencao')) fecharDepois();
    };
    raiz.addEventListener('mouseover', sobre);
    raiz.addEventListener('mouseout', fora);
    return () => {
      raiz.removeEventListener('mouseover', sobre);
      raiz.removeEventListener('mouseout', fora);
    };
  }, [raizRef, fecharDepois]);

  if (!aberto) return null;

  const r = resolver(aberto.ref, catalogo);
  const detalhe = r && detalhar(r);
  const alvo = r && alvoNoFluxo(aberto.ref, catalogo);
  const editavel = acoes.podeEditar && !!aberto.chip.closest('[data-mencoes]');

  return createPortal(
    <div
      className="cartao-mencao"
      role="dialog"
      aria-label={`${TIPO_MENCAO_ROTULO[aberto.ref.tipo]}: ${r?.nome ?? aberto.ref.rotulo}`}
      style={{
        left: aberto.left,
        width: LARGURA,
        ...(aberto.acima ? { bottom: window.innerHeight - aberto.top + 28 } : { top: aberto.top + 6 }),
      }}
      onMouseEnter={cancelarFechar}
      onMouseLeave={fecharDepois}
    >
      <div className="cartao-mencao-tipo">
        <span className={`mencao-marca m-${aberto.ref.tipo}`} aria-hidden /> {TIPO_MENCAO_ROTULO[aberto.ref.tipo]}
      </div>
      <div className="cartao-mencao-titulo">{detalhe?.titulo ?? aberto.ref.rotulo}</div>
      {detalhe ? (
        <dl>
          {detalhe.linhas.map((l) => (
            <div key={l.label} className="contents">
              <dt>{l.label}</dt>
              <dd>{typeof l.valor === 'string' ? l.valor : l.valor.map((v) => v.rotulo).join(' · ')}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="cartao-mencao-sumiu">
          Não existe mais na unidade nem nos planos. A menção fica riscada para avisar que o texto em
          volta precisa de revisão.
        </p>
      )}
      {r && (
        <>
          <div className="cartao-mencao-vivo">
            Menção viva: se o nome mudar na unidade ou no plano, ela acompanha em todos os mapas.
          </div>
          <div className="flex gap-1.5 mt-2">
            {editavel && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  setAberto(null);
                  acoes.onInserirDetalhe(aberto.chip);
                }}
              >
                <Icon.Plus /> Inserir detalhes
              </button>
            )}
            {alvo && (
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => {
                  setAberto(null);
                  acoes.onVerNoFluxo(alvo);
                }}
              >
                Ver no fluxo
              </button>
            )}
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}
