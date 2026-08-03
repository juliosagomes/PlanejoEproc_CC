import { useState } from 'react';
import { Icon } from '@/components/Icon';

interface CodigoLinhaProps {
  rotulo: string;
  ajuda: string;
  valor: string;
}

/**
 * Um código de acesso da lotação, com botão de copiar. Compartilhado entre o
 * modal de lotação recém-criada e o de consulta pelo cabeçalho.
 */
export function CodigoLinha({ rotulo, ajuda, valor }: CodigoLinhaProps) {
  const [copiado, setCopiado] = useState(false);

  const copiar = () => {
    navigator.clipboard
      ?.writeText(valor)
      .then(() => {
        setCopiado(true);
        window.setTimeout(() => setCopiado(false), 1800);
      })
      .catch(() => {
        // Sem permissão/API — o valor está visível para cópia manual.
      });
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="label" style={{ marginBottom: 0 }}>
        {rotulo}
      </span>
      <span className="text-[11.5px] text-texto-3 leading-snug">{ajuda}</span>
      <div className="flex items-center gap-2 mt-1">
        <code className="mono text-[11.5px] px-2 py-1.5 rounded bg-superficie-2 border border-borda flex-1 truncate">
          {valor}
        </code>
        <button
          type="button"
          className="btn btn-sm"
          onClick={copiar}
          aria-label={`Copiar ${rotulo}`}
        >
          <Icon.Copy /> {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  );
}
