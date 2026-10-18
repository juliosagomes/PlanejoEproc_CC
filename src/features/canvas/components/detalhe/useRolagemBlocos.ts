import { useCallback, useEffect, useRef, useState } from 'react';
import type { SecaoAtp } from './NavBlocos';

const SECOES: readonly SecaoAtp[] = ['regras', 'acao', 'filtros', 'obs'];

/**
 * Rolagem do modal da ATP: qual bloco está à vista (para a navegação
 * lateral acender) e "ir até" um bloco ou um campo marcado com `data-alvo`.
 */
export function useRolagemBlocos() {
  const corpoRef = useRef<HTMLFieldSetElement>(null);
  const [atual, setAtual] = useState<SecaoAtp>('regras');

  useEffect(() => {
    const corpo = corpoRef.current;
    if (!corpo) return;
    const aoRolar = () => {
      const topo = corpo.getBoundingClientRect().top + 48;
      let visivel: SecaoAtp = 'regras';
      for (const s of SECOES) {
        const el = corpo.querySelector(`[data-secao="${s}"]`);
        if (el && el.getBoundingClientRect().top <= topo) visivel = s;
      }
      // No fim da rolagem o último bloco pode ser baixo demais para chegar ao topo.
      if (corpo.scrollTop + corpo.clientHeight >= corpo.scrollHeight - 4) visivel = 'obs';
      setAtual(visivel);
    };
    corpo.addEventListener('scroll', aoRolar, { passive: true });
    return () => corpo.removeEventListener('scroll', aoRolar);
  }, []);

  const rolarAte = useCallback((seletor: string, focar: boolean) => {
    const el = corpoRef.current?.querySelector<HTMLElement>(seletor);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: focar ? 'center' : 'start' });
    if (!focar) return;
    const campo = el.querySelector<HTMLElement>('select, input, textarea');
    // Focar já rola, e sem `preventScroll` cortaria a rolagem suave no meio.
    window.setTimeout(() => campo?.focus({ preventScroll: true }), 300);
  }, []);

  const irSecao = useCallback((s: SecaoAtp) => rolarAte(`[data-secao="${s}"]`, false), [rolarAte]);
  const irCampo = useCallback((alvo: string) => rolarAte(`[data-alvo="${alvo}"]`, true), [rolarAte]);

  return { corpoRef, atual, irSecao, irCampo };
}
