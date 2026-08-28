import { useState } from 'react';
import { useAcoesPreferenciaisDoLocalizador } from '../sugestoes';

interface AcoesPreferenciaisNoEprocProps {
  /** Nome do localizador como está no nó — casa com a sigla do catálogo. */
  nome: string;
}

const VISIVEIS = 4;

/**
 * Mostra as ações preferenciais que a unidade **já tem** neste localizador no
 * Eproc.
 *
 * É o "como está" ao lado do que o usuário está desenhando — informação, não
 * plano. De propósito, nada aqui altera o grafo: transformar esses vínculos em
 * arestas mudaria a premissa do app, que existe para *desenhar* o fluxo, e isso
 * é decisão em aberto (ver o roadmap do CLAUDE.md).
 *
 * Some inteiro quando não há nada a dizer — antes da primeira sincronização,
 * para nome livre, ou para localizador sem vínculo. Um bloco vazio permanente
 * sugeriria que falta algo.
 */
export function AcoesPreferenciaisNoEproc({ nome }: AcoesPreferenciaisNoEprocProps) {
  const acoes = useAcoesPreferenciaisDoLocalizador(nome);
  const [expandido, setExpandido] = useState(false);

  if (acoes.length === 0) return null;

  const mostrando = expandido ? acoes : acoes.slice(0, VISIVEIS);
  const restantes = acoes.length - mostrando.length;

  return (
    <div
      className="rounded-lg px-3 py-2.5"
      style={{ background: 'var(--superficie-2)', border: '1px solid var(--borda)' }}
    >
      <div className="label" style={{ marginBottom: 6 }}>
        Ações Preferenciais Vinculadas
        <span className="mono ml-2 text-[10.5px] font-medium normal-case tracking-normal text-texto-3">
          {acoes.length}
        </span>
      </div>
      <ul className="flex flex-col gap-1">
        {mostrando.map((acao) => (
          <li key={acao} className="text-[11.5px] text-texto-2 leading-snug">
            {acao}
          </li>
        ))}
      </ul>
      {restantes > 0 && (
        <button
          type="button"
          className="btn btn-sm btn-ghost mt-1.5"
          style={{ height: 22, fontSize: 11 }}
          onClick={() => setExpandido(true)}
        >
          mostrar mais {restantes}
        </button>
      )}
    </div>
  );
}
