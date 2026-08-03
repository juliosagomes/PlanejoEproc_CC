import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { useSessaoStore } from '../store';
import { CodigoLinha } from './CodigoLinha';

/**
 * Apresenta os dois códigos de uma lotação recém-criada.
 *
 * Já não é a última chance de vê-los — desde D-10 o criador (que é editor)
 * reconsulta os dois pelo menu do cabeçalho. O checkbox continua aqui porque
 * o risco que sobra é outro: os códigos são irrevogáveis (decisoes.md#D-8) e
 * ficam só neste navegador, então perder o acesso a ele é perder a lotação.
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
            <strong>Guarde os dois códigos fora deste navegador.</strong> Você
            pode reconsultá-los depois em <em>Ver códigos de acesso</em>, no
            menu da lotação, mas eles não podem ser trocados — e se este
            navegador perder os dados, some o único acesso à lotação.
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
