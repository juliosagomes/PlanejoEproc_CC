import { Icon } from '@/components/Icon';

interface BackupCachePromptProps {
  open: boolean;
  /** Quantos planos existem hoje no modo local. */
  quantidade: number;
  onBaixar: () => void;
  onContinuar: () => void;
  onCancelar: () => void;
}

/**
 * Passo intermediário antes de entrar numa lotação: oferece salvar em arquivo
 * os planos do modo local.
 *
 * Nada é apagado ao trocar de contexto — cada lotação tem seu próprio silo —
 * mas os planos do modo local são os únicos que não existem em lugar nenhum
 * além deste navegador. O texto diz isso em vez de sugerir perigo, para não
 * assustar quem só quer entrar.
 */
export function BackupCachePrompt({
  open,
  quantidade,
  onBaixar,
  onContinuar,
  onCancelar,
}: BackupCachePromptProps) {
  if (!open) return null;

  return (
    <>
      <div className="scrim no-print" onClick={onCancelar} />
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Salvar planos do modo local"
        style={{ width: 'min(480px, 92vw)' }}
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
            <Icon.Download />
          </div>
          <div className="flex-1">
            <div className="section-h">Antes de continuar</div>
            <div className="text-[12px] text-texto-3 mt-0.5">
              Você tem {quantidade} plano{quantidade === 1 ? '' : 's'} no modo
              local.
            </div>
          </div>
        </div>

        <div className="p-5 flex flex-col gap-3">
          <p className="text-[12.5px] text-texto-2 leading-snug">
            Entrar numa lotação <strong>não apaga</strong> esses planos — eles
            continuam guardados e voltam a aparecer quando você abrir o modo
            local de novo.
          </p>
          <p className="text-[12.5px] text-texto-3 leading-snug">
            Ainda assim, os planos do modo local só existem neste navegador. Se
            quiser uma cópia em arquivo, baixe agora.
          </p>
        </div>

        <div
          className="px-5 py-3 flex items-center gap-2"
          style={{ borderTop: '1px solid var(--borda)', background: 'var(--fundo)' }}
        >
          <button type="button" className="btn btn-ghost" onClick={onCancelar}>
            Cancelar
          </button>
          <div className="flex-1" />
          <button type="button" className="btn" onClick={onBaixar}>
            <Icon.Download /> Baixar .json
          </button>
          <button type="button" className="btn btn-primary" onClick={onContinuar}>
            Continuar
          </button>
        </div>
      </div>
    </>
  );
}
