import { Em, LinhaAresta, NoFalso, Palco, RotuloAresta, TiposDeConexao } from './pecas';

/**
 * Cena 5 — o Resumo preenchido e o tipo em ATP: a aresta fica azul e o rótulo
 * muda junto. É o momento em que o desenho deixa de ser "duas caixas ligadas" e
 * passa a dizer *quando* o processo anda.
 */
export function Passo5ResumoAtp() {
  return (
    <Palco altura={218}>
      <Em left={0} top={12}>
        <div style={{ width: 268 }}>
          <span className="label">Resumo</span>
          <div
            className="textarea"
            style={{ minHeight: 0, height: 44, lineHeight: '1.35' }}
          >
            Quando apresentada contestação
          </div>
        </div>
      </Em>

      <Em left={0} top={92}>
        <span className="label">Tipo</span>
        <TiposDeConexao ativo="atp" />
      </Em>

      <Em left={310} top={28}>
        <div
          className="relative rounded-lg border border-borda"
          style={{
            width: 208,
            height: 150,
            background:
              'radial-gradient(var(--grade-ponto) 1px, transparent 1px) 0 0 / 16px 16px, var(--fundo)',
          }}
        >
          <LinhaAresta de={{ x: 89, y: 52 }} para={{ x: 89, y: 98 }} kind="atp" />
          <div className="absolute" style={{ left: 14, top: 14 }}>
            <NoFalso nome="ag. contestação" criado largura={150} />
          </div>
          <div className="absolute" style={{ left: 68, top: 64 }}>
            <RotuloAresta kind="atp" />
          </div>
          <div className="absolute" style={{ left: 14, top: 100 }}>
            <NoFalso nome="ag. réplica" largura={150} />
          </div>
        </div>
      </Em>
    </Palco>
  );
}
