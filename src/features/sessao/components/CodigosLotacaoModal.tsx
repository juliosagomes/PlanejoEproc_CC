import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { useSessaoStore } from '../store';

/**
 * Exibe, uma única vez, os dois códigos de uma lotação recém-criada.
 *
 * "Uma única vez" é literal: o servidor não tem endpoint para consultar nem
 * revogar códigos (decisoes.md#D-8), então quem fechar isto sem anotar perde
 * o código de leitura para sempre. Por isso o botão de fechar exige a
 * confirmação explícita do checkbox.
 */
export function CodigosLotacaoModal() {
  const codigos = useSessaoStore((s) => s.codigosNovaLotacao);
  const dispensar = useSessaoStore((s) => s.dispensarCodigos);
  const [anotado, setAnotado] = useState(false);

  if (!codigos) return null;

  return (
    <>
      <div className="scrim no-print" />
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Códigos da lotação"
        style={{ width: 'min(540px, 92vw)' }}
      >
        <div
          className="px-5 pt-4 pb-3 flex items-start gap-3"
          style={{ borderBottom: '1px solid var(--borda)' }}
        >
          <div
            className="flex items-center justify-center text-destaque flex-shrink-0"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'var(--destaque-suave)',
              border: '1px solid var(--destaque-borda)',
            }}
          >
            <Icon.Predio />
          </div>
          <div className="flex-1">
            <div className="section-h">Lotação criada</div>
            <div className="text-[13px] font-semibold mt-0.5">{codigos.nome}</div>
          </div>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div
            className="px-4 py-3 rounded-lg text-[12.5px] leading-snug"
            style={{
              background: 'var(--aviso-suave)',
              border: '1px solid var(--aviso)',
              color: 'var(--texto)',
            }}
            role="alert"
          >
            <strong>Anote os dois códigos agora.</strong> Eles não podem ser
            consultados nem trocados depois — esta é a única vez que aparecem.
          </div>

          <CodigoLinha
            rotulo="Código de visualização"
            ajuda="Quem receber só consegue baixar os planos."
            valor={codigos.codigoLeitura}
          />
          <CodigoLinha
            rotulo="Código de edição"
            ajuda="Quem receber também consegue enviar alterações. Trate como senha."
            valor={codigos.codigoEdicao}
          />
        </div>

        <div
          className="px-5 py-3 flex items-center gap-3"
          style={{ borderTop: '1px solid var(--borda)', background: 'var(--fundo)' }}
        >
          <label className="flex items-center gap-2 text-[12.5px] text-texto-2 cursor-pointer">
            <input
              type="checkbox"
              className="pj-check"
              checked={anotado}
              onChange={(e) => setAnotado(e.target.checked)}
            />
            Já guardei os códigos
          </label>
          <div className="flex-1" />
          <button
            type="button"
            className="btn btn-primary"
            disabled={!anotado}
            onClick={dispensar}
          >
            Entrar na lotação
          </button>
        </div>
      </div>
    </>
  );
}

function CodigoLinha({
  rotulo,
  ajuda,
  valor,
}: {
  rotulo: string;
  ajuda: string;
  valor: string;
}) {
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
