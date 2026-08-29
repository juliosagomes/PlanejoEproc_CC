import { AvisoIlustracao, Em, NoFalso, Palco } from './pecas';

/**
 * Cena 2 — o combobox do nome sugerindo o catálogo, e o nó resultante já em
 * verde.
 *
 * O menu é HTML puro copiando os valores de `styles.menu`/`styles.option` de
 * `features/catalogo/components/LocalizadorNomeInput.tsx`. O componente real
 * não serve: ele portaliza o menu do react-select em `zIndex: 60`, acima do
 * `.modal` (51), e o menu sairia flutuando por cima da moldura do slide.
 */
export function Passo2Localizador() {
  return (
    <>
      <Palco altura={206}>
        <Em left={0} top={16}>
          <div style={{ width: 268 }}>
            <span className="label">Nome do localizador</span>
            <div
              className="input flex items-center"
              style={{
                borderColor: 'var(--destaque)',
                boxShadow: '0 0 0 3px oklch(0.55 0.15 265 / 0.12)',
              }}
            >
              ag. cont
              <span
                aria-hidden
                style={{
                  width: 1,
                  height: 15,
                  marginLeft: 1,
                  background: 'var(--texto)',
                }}
              />
            </div>
            <div
              className="mt-1 overflow-hidden rounded-md border border-borda bg-superficie"
              style={{ boxShadow: '0 4px 14px rgba(20, 22, 28, 0.12)' }}
            >
              <div className="px-2.5 py-1.5" style={{ background: 'var(--superficie-2)' }}>
                <div className="text-[12.5px] font-medium">ag. contestação</div>
                <div className="text-[11px] text-texto-3">Aguardando contestação do réu</div>
              </div>
              <div className="px-2.5 py-1.5">
                <div className="text-[12.5px]">ag. contrarrazões</div>
              </div>
            </div>
          </div>
        </Em>

        <Em left={330} top={62}>
          <NoFalso nome="ag. contestação" criado />
        </Em>
        <Em left={330} top={122}>
          <p className="text-[11px] leading-snug text-texto-3" style={{ width: 172 }}>
            Borda verde e o sinal no canto: este já existe no Eproc.
          </p>
        </Em>
      </Palco>
      <AvisoIlustracao />
    </>
  );
}
