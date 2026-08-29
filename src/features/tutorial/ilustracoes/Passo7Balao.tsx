import { BalaoResumo, Cursor, Em, LinhaAresta, NoFalso, Palco, RotuloAresta } from './pecas';

/**
 * Cena 7 — o balão de hover. É a `.edge-tooltip` de verdade (`PjEdge.tsx`), que
 * mostra o Resumo e nada mais.
 */
export function Passo7Balao() {
  return (
    <Palco grade altura={196}>
      <LinhaAresta de={{ x: 190, y: 92 }} para={{ x: 302, y: 92 }} kind="atp" />

      <Em left={16} top={70}>
        <NoFalso nome="ag. contestação" criado />
      </Em>
      <Em left={302} top={70}>
        <NoFalso nome="ag. réplica" />
      </Em>
      <Em left={224} top={80}>
        <RotuloAresta kind="atp" />
      </Em>

      {/* A classe traz `transform: translate(-50%,-100%)`: `left` é o centro do
          balão e `top` é a base dele, exatamente como no canvas real. */}
      <BalaoResumo texto="Quando apresentada contestação" left={246} top={48} />
      <Cursor left={238} top={94} />
    </Palco>
  );
}
