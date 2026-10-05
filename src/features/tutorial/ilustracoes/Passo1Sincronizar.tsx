import { Icon } from '@/components/Icon';
import { AvisoIlustracao, Cursor, Em, Palco } from './pecas';

/**
 * Cena 1 — o menu "Unidade" do cabeçalho aberto, com "Sincronizar com a
 * unidade" em destaque. Os rótulos são os mesmos de `components/Header.tsx`
 * (decisoes.md#D-36); divergir aqui mandaria o usuário procurar um item que
 * não existe.
 */
export function Passo1Sincronizar() {
  return (
    <>
      <Palco altura={150}>
        <Em left={0} top={8}>
          <div
            className="flex items-center justify-end gap-1 rounded-lg border border-borda bg-superficie px-3"
            style={{ height: 40, width: 520 }}
          >
            <span className="btn btn-sm btn-ghost" style={{ opacity: 0.5 }}>
              Plano <Icon.ChevronDown />
            </span>
            <span className="btn btn-sm" style={{ borderColor: 'var(--destaque)' }}>
              Unidade <Icon.ChevronDown />
            </span>
            <span className="btn btn-sm btn-accent" style={{ opacity: 0.5 }}>
              <Icon.Bolt /> Checklist
            </span>
          </div>
        </Em>
        <Em left={196} top={54}>
          <div
            className="rounded-lg border border-borda bg-superficie p-1 text-[12.5px]"
            style={{ width: 250 }}
          >
            <div
              className="flex items-center gap-2 rounded-md px-2.5 py-1.5"
              style={{
                background: 'var(--destaque-suave)',
                boxShadow: '0 0 0 1px var(--destaque-borda)',
              }}
            >
              <span className="text-destaque">
                <Icon.Sincronizar />
              </span>
              <span className="font-medium">Sincronizar com a unidade</span>
            </div>
            <div className="flex items-center gap-2 px-2.5 py-1.5" style={{ opacity: 0.55 }}>
              <span className="text-texto-3">
                <Icon.Library />
              </span>
              <span className="font-medium">Catálogo do órgão</span>
            </div>
          </div>
        </Em>
        <Cursor left={330} top={78} />
      </Palco>
      <AvisoIlustracao />
    </>
  );
}
