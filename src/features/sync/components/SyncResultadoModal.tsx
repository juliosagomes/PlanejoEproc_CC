import { Icon } from '@/components/Icon';
import { useSyncStore } from '../store';

interface SyncResultadoModalProps {
  onFechar: () => void;
}

/**
 * Retorno visual de "Baixar do servidor" / "Enviar ao servidor". O projeto
 * não tem sistema de toast, e trocar planos por baixo dos pés do usuário sem
 * dizer o que mudou seria pior que um modal — então o resultado (ou o erro)
 * aparece aqui, no mesmo esqueleto dos demais modais.
 *
 * Renderiza `null` enquanto não há nada a relatar.
 */
export function SyncResultadoModal({ onFechar }: SyncResultadoModalProps) {
  const ultimoErro = useSyncStore((s) => s.ultimoErro);
  const ultimoPull = useSyncStore((s) => s.ultimoPull);
  const ultimoPush = useSyncStore((s) => s.ultimoPush);

  if (!ultimoErro && !ultimoPull && !ultimoPush) return null;

  const falhou = ultimoErro !== null;

  return (
    <>
      <div className="scrim no-print" onClick={onFechar} />
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Resultado da sincronização"
        style={{ width: 'min(420px, 92vw)' }}
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
            {ultimoPush ? <Icon.CloudUp /> : <Icon.CloudDown />}
          </div>
          <div className="flex-1">
            <div className="section-h">
              {falhou ? 'Falha' : ultimoPush ? 'Envio concluído' : 'Atualização concluída'}
            </div>
          </div>
        </div>

        <div className="p-5 flex flex-col gap-2">
          {falhou ? (
            <p className="text-[12.5px] text-texto-2 leading-snug" role="alert">
              {ultimoErro}
            </p>
          ) : ultimoPush ? (
            <ul className="text-[12.5px] text-texto-2 flex flex-col gap-1">
              <Linha rotulo="Planos enviados" valor={ultimoPush.enviados} />
              {ultimoPush.removidos > 0 && (
                <Linha rotulo="Removidos do servidor" valor={ultimoPush.removidos} />
              )}
            </ul>
          ) : ultimoPull ? (
            <ul className="text-[12.5px] text-texto-2 flex flex-col gap-1">
              <Linha rotulo="Planos novos" valor={ultimoPull.recebidos} />
              <Linha rotulo="Atualizados" valor={ultimoPull.atualizados} />
              {ultimoPull.removidos > 0 && (
                <Linha
                  rotulo="Removidos (excluídos no servidor)"
                  valor={ultimoPull.removidos}
                />
              )}
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
