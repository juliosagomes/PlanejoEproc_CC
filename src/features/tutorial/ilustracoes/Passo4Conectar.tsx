import {
  Alca,
  Em,
  LinhaAresta,
  NoFalso,
  Palco,
  RotuloAresta,
  TiposDeConexao,
} from './pecas';

/**
 * Cena 4 — a ligação recém-criada, cinza tracejada, com as alças à mostra: saída
 * à direita, entrada à esquerda (é a geometria real do `LocalizadorNode`).
 *
 * Os três cartões ao lado mostram que o tipo é escolha do usuário — e que a
 * conexão nasce em Manual (`defaultEdgeData()` na store do canvas).
 */
export function Passo4Conectar() {
  return (
    <Palco grade altura={210}>
      <LinhaAresta de={{ x: 190, y: 62 }} para={{ x: 300, y: 62 }} kind="manual" />

      <Em left={16} top={40}>
        <div className="relative">
          <NoFalso nome="ag. contestação" criado />
          <Alca right={-4} top={18} destacada />
        </div>
      </Em>

      <Em left={302} top={40}>
        <div className="relative">
          <NoFalso nome="ag. réplica" />
          <Alca left={-4} top={18} destacada />
        </div>
      </Em>

      <Em left={218} top={50}>
        <RotuloAresta kind="manual" />
      </Em>

      <Em left={16} top={122}>
        <span className="label">Tipo</span>
        <TiposDeConexao ativo="manual" />
      </Em>

      <Em left={296} top={140}>
        <p className="text-[11px] leading-snug text-texto-3" style={{ width: 200 }}>
          Toda conexão nasce Manual. Escolha o tipo no painel da direita.
        </p>
      </Em>
    </Palco>
  );
}
