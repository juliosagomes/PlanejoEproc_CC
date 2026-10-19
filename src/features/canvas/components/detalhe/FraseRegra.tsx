import type { AlvoPendencia } from '@/domain';
import type { Trecho } from '@/features/checklist/fraseAtp';

interface FraseRegraProps {
  trechos: readonly Trecho[];
  /** Leva ao campo que falta. */
  onIr: (alvo: AlvoPendencia) => void;
}

/**
 * A regra em português no topo do modal (decisoes.md#D-45). Muda a cada campo
 * preenchido, e o que falta é um botão que rola até o campo.
 */
export function FraseRegra({ trechos, onIr }: FraseRegraProps) {
  return (
    <p className="frase-regra" aria-live="polite">
      <span className="rot">Em português</span>
      {trechos.map((x, i) =>
        x.tipo === 'valor' ? (
          <b key={i}>{x.texto}</b>
        ) : x.tipo === 'falta' ? (
          <button key={i} type="button" className="frase-falta" onClick={() => onIr(x.alvo)} title="Ir até o campo">
            {x.texto}
          </button>
        ) : (
          <span key={i}>{x.texto}</span>
        ),
      )}
    </p>
  );
}
