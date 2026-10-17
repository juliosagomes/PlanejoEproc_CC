import { useEffect, useRef } from 'react';
import { Icon } from '@/components/Icon';
import type { Slide } from '@/domain';
import { cn } from '@/utils/cn';
import { htmlSlide } from '../estatico';
import { atualizarMencoes, type CatalogoMencoes } from '../mencoes';

interface Props {
  slide: Slide;
  numero: number;
  ativa: boolean;
  catalogo: CatalogoMencoes;
  podeExcluir: boolean;
  onAbrir: () => void;
  onExcluir: () => void;
}

/** O slide em ponto pequeno, desenhado pela mesma função da impressão. */
export function Miniatura({ slide, numero, ativa, catalogo, podeExcluir, onAbrir, onExcluir }: Props) {
  const caixaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const caixa = caixaRef.current;
    if (!caixa) return;
    caixa.innerHTML = htmlSlide(slide);
    atualizarMencoes(caixa, catalogo);
  }, [slide, catalogo]);

  return (
    <div role="listitem" className={cn('mapa-miniatura', ativa && 'ativa')}>
      <button type="button" className="mapa-miniatura-abrir" onClick={onAbrir} aria-label={`Slide ${numero}`} aria-current={ativa}>
        <span className="mapa-miniatura-n">{numero}</span>
        <div className="mapa-miniatura-caixa" ref={caixaRef} aria-hidden />
      </button>
      {podeExcluir && (
        <button type="button" className="mapa-miniatura-x" onClick={onExcluir} aria-label={`Excluir slide ${numero}`} title="Excluir slide">
          <Icon.X />
        </button>
      )}
    </div>
  );
}
