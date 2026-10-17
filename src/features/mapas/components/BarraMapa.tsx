import type { ReactNode } from 'react';
import { Icon } from '@/components/Icon';
import type { Mapa } from '@/domain';
import { imprimirMapa } from '../estatico';
import type { CatalogoMencoes } from '../mencoes';
import { flushMapas, useMapasStore } from '../store';

interface Props {
  mapa: Mapa;
  catalogo: CatalogoMencoes;
  somenteLeitura: boolean;
  /** As ferramentas do formato (slides ou documento). */
  ferramentas: ReactNode;
  onMencionar: () => void;
}

/** Barra do editor: o que é igual nos dois formatos fica aqui; o resto vem em `ferramentas`. */
export function BarraMapa({ mapa, catalogo, somenteLeitura, ferramentas, onMencionar }: Props) {
  const renomear = useMapasStore((s) => s.renomear);

  const imprimir = (comoPdf: boolean) => {
    flushMapas();
    imprimirMapa(useMapasStore.getState().aberto ?? mapa, catalogo, comoPdf);
  };

  return (
    <div className="mapa-barra no-print" role="toolbar" aria-label="Ferramentas do mapa">
      <input
        className="input mapa-nome"
        aria-label="Nome do mapa"
        value={mapa.nome}
        readOnly={somenteLeitura}
        onChange={(e) => renomear(e.target.value)}
      />
      <span className="selo-formato">{mapa.formato === 'paisagem' ? 'Paisagem · A4 deitada' : 'Retrato · A4 em pé'}</span>
      {!somenteLeitura && (
        <>
          <span className="mapa-barra-sep" aria-hidden />
          {ferramentas}
          <button
            type="button"
            className="btn btn-sm"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onMencionar}
            title="Mencionar um localizador, uma preferência ou uma regra de ATP"
          >
            <b className="text-destaque">@</b> Mencionar
          </button>
          <span className="text-[11.5px] text-texto-3 whitespace-nowrap">
            ou digite <kbd>@</kbd>
          </span>
        </>
      )}
      <span className="flex-1" />
      <button type="button" className="btn btn-sm" onClick={() => imprimir(false)}>
        <Icon.Print /> Imprimir
      </button>
      <button
        type="button"
        className="btn btn-sm btn-accent"
        onClick={() => imprimir(true)}
        title='Abre o diálogo do Chrome. Em "Destino", escolha Salvar como PDF.'
      >
        <Icon.Download /> Exportar PDF
      </button>
    </div>
  );
}
