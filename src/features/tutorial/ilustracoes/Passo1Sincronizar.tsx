import { Icon } from '@/components/Icon';
import { AvisoIlustracao, Cursor, Em, Palco } from './pecas';

/**
 * Cena 1 — a barra de ações do cabeçalho, com "Sincronizar com a unidade" em
 * destaque. Os rótulos são os mesmos de `components/Header.tsx`; divergir aqui
 * mandaria o usuário procurar um botão que não existe.
 */
export function Passo1Sincronizar() {
  return (
    <>
      <Palco altura={150}>
        <Em left={0} top={54}>
          <div
            className="flex items-center gap-2 rounded-lg border border-borda bg-superficie px-3"
            style={{ height: 50, width: 520 }}
          >
            <span className="btn btn-sm" style={{ opacity: 0.5 }}>
              <Icon.File /> Novo plano
            </span>
            <span
              className="btn btn-sm"
              style={{
                borderColor: 'var(--destaque)',
                color: 'var(--destaque)',
                boxShadow: '0 0 0 3px oklch(0.55 0.15 265 / 0.12)',
              }}
            >
              <Icon.CloudDown /> Sincronizar com a unidade
            </span>
            <span className="btn btn-sm" style={{ opacity: 0.5 }}>
              <Icon.Library /> Catálogo órgão
            </span>
          </div>
        </Em>
        <Cursor left={244} top={96} />
      </Palco>
      <AvisoIlustracao />
    </>
  );
}
