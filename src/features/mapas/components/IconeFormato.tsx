import type { FormatoMapa } from '@/domain';

/** A folha deitada ou em pé, para a lista e o menu "Novo". */
export function IconeFormato({ formato }: { formato: FormatoMapa }) {
  return formato === 'paisagem' ? (
    <svg width="16" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="1" y="2" width="16" height="11" rx="1.5" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 18 16" fill="none" stroke="currentColor" aria-hidden>
      <rect x="4" y="1" width="10" height="14" rx="1.5" strokeWidth="1.6" />
      <path d="M6.5 5h5M6.5 8h5M6.5 11h3" strokeWidth="1.3" />
    </svg>
  );
}
