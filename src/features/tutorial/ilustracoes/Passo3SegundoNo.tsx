import { Cursor, Em, MarcaDuploClique, NoFalso, Palco } from './pecas';

/**
 * Cena 3 — duplo clique no canvas vazio cria o localizador ali mesmo, e o nó
 * novo nasce tracejado (ainda não existe no Eproc).
 *
 * O texto do passo diz "no ponto onde o localizador deve aparecer", que é o
 * gesto correto: o duplo clique cria o nó sob o cursor.
 */
export function Passo3SegundoNo() {
  return (
    <Palco grade altura={196}>
      <Em left={16} top={62}>
        <NoFalso nome="ag. contestação" criado />
      </Em>

      <Em left={300} top={62}>
        <NoFalso nome="ag. réplica" />
      </Em>

      {/* Acima da quina do nó: por cima dele, o cursor tapava o nome. */}
      <MarcaDuploClique left={306} top={34} />
      <Cursor left={288} top={40} />

      <Em left={16} top={140}>
        <p className="text-[11px] leading-snug text-texto-3" style={{ width: 460 }}>
          Tracejado = ainda a criar. É assim que você enxerga, de relance, o que
          falta configurar no Eproc.
        </p>
      </Em>
    </Palco>
  );
}
