import { Icon } from '@/components/Icon';
import { useBuscaStore } from '../store';

/** A porta visível da busca, no topo do quadro: quem não sabe do Ctrl+K acha por aqui. */
export function BarraBusca() {
  const abrir = useBuscaStore((s) => s.abrir);
  return (
    <button type="button" className="busca-barra no-print" onClick={abrir} aria-keyshortcuts="Control+K /">
      <Icon.Busca />
      <span className="busca-barra-t">Buscar localizador ou comando…</span>
      <kbd>Ctrl K</kbd>
    </button>
  );
}
