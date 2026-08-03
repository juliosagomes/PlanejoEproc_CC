import { useEffect } from 'react';
import { Icon } from '@/components/Icon';
import type { SessaoLotacao } from '@/domain';
import { CodigoLinha } from './CodigoLinha';

interface CodigosAcessoModalProps {
  sessao: SessaoLotacao;
  onFechar: () => void;
}

/**
 * Consulta dos códigos da lotação em que se está agora — diferente do
 * `CodigosLotacaoModal`, que aparece uma única vez na criação.
 *
 * O que aparece depende da permissão da sessão, e a assimetria é o ponto:
 * quem entrou por leitura só pode ver (e repassar) o código de leitura, que
 * já tem em mãos. Quem entrou por edição vê os dois — o de leitura vem do
 * servidor em `sincronizar` (decisoes.md#D-10), então falta em implantações
 * antigas do Apps Script.
 */
export function CodigosAcessoModal({ sessao, onFechar }: CodigosAcessoModalProps) {
  const editor = sessao.permissao === 'edicao';
  const codigoLeitura = editor ? sessao.codigoLeitura : sessao.codigo;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onFechar();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onFechar]);

  return (
    <>
      <div className="scrim no-print" onClick={onFechar} />
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Códigos de acesso da lotação"
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
            <div className="section-h">Códigos de acesso</div>
            <div className="text-[13px] font-semibold mt-0.5">{sessao.nome}</div>
          </div>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {codigoLeitura ? (
            <CodigoLinha
              rotulo="Código de visualização"
              ajuda="Quem receber só consegue baixar os planos."
              valor={codigoLeitura}
            />
          ) : (
            <div
              className="px-4 py-3 rounded-lg text-[12.5px] leading-snug"
              style={{
                background: 'var(--aviso-suave)',
                border: '1px solid var(--aviso)',
                color: 'var(--texto)',
              }}
              role="alert"
            >
              O código de visualização não veio do servidor. A implantação do
              backend é anterior a esta versão — republique o{' '}
              <code className="mono">Code.gs</code> e entre na lotação de novo.
            </div>
          )}

          {editor ? (
            <CodigoLinha
              rotulo="Código de edição"
              ajuda="Quem receber também consegue enviar alterações. Trate como senha."
              valor={sessao.codigo}
            />
          ) : (
            <div className="text-[11.5px] text-texto-3 leading-snug">
              Você entrou com o código de visualização, então o de edição não
              fica disponível aqui. Peça a quem administra a lotação.
            </div>
          )}
        </div>

        <div
          className="px-5 py-3 flex items-center justify-end"
          style={{ borderTop: '1px solid var(--borda)', background: 'var(--fundo)' }}
        >
          <button type="button" className="btn btn-primary" onClick={onFechar}>
            Fechar
          </button>
        </div>
      </div>
    </>
  );
}
