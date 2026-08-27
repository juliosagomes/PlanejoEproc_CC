import { Icon } from '@/components/Icon';
import { useUnidadeStore } from '../storeUnidade';

interface SincronizacaoUnidadeModalProps {
  onFechar: () => void;
}

/**
 * Retorno visual de "Sincronizar com a unidade", no mesmo esqueleto do
 * `SyncResultadoModal` — que relata a *outra* sincronização, a de planos com o
 * servidor. Duas coisas diferentes com o mesmo verbo, então o título aqui diz
 * "unidade" e o de lá diz "servidor".
 *
 * Renderiza `null` enquanto não há nada a relatar.
 */
export function SincronizacaoUnidadeModal({ onFechar }: SincronizacaoUnidadeModalProps) {
  const erro = useUnidadeStore((s) => s.erro);
  const resumo = useUnidadeStore((s) => s.ultimoResumo);
  const catalogo = useUnidadeStore((s) => s.catalogo);

  if (!erro && !resumo) return null;

  const falhou = erro !== null;
  const unidade = catalogo?.unidade;

  return (
    <>
      <div className="scrim no-print" onClick={onFechar} />
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Resultado da sincronização com a unidade"
        style={{ width: 'min(440px, 92vw)' }}
      >
        <div
          className="px-5 pt-4 pb-3 flex items-start gap-3"
          style={{ borderBottom: '1px solid var(--borda)' }}
        >
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: falhou ? 'var(--aviso-suave)' : 'var(--ok-suave)',
              border: `1px solid ${falhou ? 'var(--aviso)' : 'var(--ok-borda)'}`,
              color: falhou ? 'var(--texto)' : 'var(--ok)',
            }}
          >
            <Icon.Library />
          </div>
          <div className="flex-1">
            <div className="section-h">
              {falhou ? 'Não consegui sincronizar' : 'Catálogo da unidade atualizado'}
            </div>
            {!falhou && unidade && (
              <div className="text-[12px] text-texto-3 mt-0.5">
                {unidade.nome ?? unidade.sigla}
              </div>
            )}
          </div>
        </div>

        <div className="p-5 flex flex-col gap-2">
          {falhou ? (
            <p className="text-[12.5px] text-texto-2 leading-snug" role="alert">
              {erro}
            </p>
          ) : resumo ? (
            <ul className="text-[12.5px] text-texto-2 flex flex-col gap-1">
              <Linha rotulo="Localizadores importados" valor={resumo.localizadores} />
              {resumo.ignoradosSistema > 0 && (
                <Linha
                  rotulo="Ignorados (localizadores de sistema)"
                  valor={resumo.ignoradosSistema}
                />
              )}
              {resumo.duplicados > 0 && (
                <Linha rotulo="Ignorados (repetidos)" valor={resumo.duplicados} />
              )}
              <Linha rotulo="Com código do Eproc" valor={resumo.comId} />
            </ul>
          ) : null}
        </div>

        <div
          className="px-5 py-3 flex items-center"
          style={{ borderTop: '1px solid var(--borda)', background: 'var(--fundo)' }}
        >
          <div className="flex-1" />
          <button type="button" className="btn btn-primary" onClick={onFechar} autoFocus>
            Fechar
          </button>
        </div>
      </div>
    </>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <li className="flex items-baseline gap-2">
      <span className="mono text-[13px] font-semibold text-texto">{valor}</span>
      <span className="text-texto-3">{rotulo}</span>
    </li>
  );
}
