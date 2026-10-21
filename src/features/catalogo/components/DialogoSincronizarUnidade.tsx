import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { loadDetalheAtp, saveDetalheAtp } from '@/infra/storage/preferenciaSincronizacao';
import { useUnidadeStore } from '../storeUnidade';

interface DialogoSincronizarUnidadeProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Antes de "Sincronizar com a unidade": a única escolha é trazer ou não o
 * detalhe completo das regras de ATP, que abre o formulário de cada regra e
 * leva minutos (decisoes.md#D-46). Enquanto corre, mostra o progresso; o
 * resultado continua no `SincronizacaoUnidadeModal`.
 */
export function DialogoSincronizarUnidade({ open, onClose }: DialogoSincronizarUnidadeProps) {
  const sincronizar = useUnidadeStore((s) => s.sincronizar);
  const sincronizando = useUnidadeStore((s) => s.sincronizando);
  const progresso = useUnidadeStore((s) => s.progressoAtp);
  const [detalhe, setDetalhe] = useState(loadDetalheAtp);

  if (!open) return null;

  const iniciar = () => {
    saveDetalheAtp(detalhe);
    void sincronizar({ detalheAtp: detalhe }).finally(onClose);
  };

  return (
    <>
      <div className="scrim no-print" onClick={sincronizando ? undefined : onClose} />
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Sincronizar com a unidade"
        style={{ width: 'min(440px, 92vw)' }}
      >
        <div className="px-5 pt-4 pb-3" style={{ borderBottom: '1px solid var(--borda)' }}>
          <div className="section-h">Sincronizar com a unidade</div>
          <div className="text-[12px] text-texto-3 mt-0.5">
            Lê localizadores, preferências, modelos e regras de ATP na aba do Eproc. Só leitura.
          </div>
        </div>

        <div className="p-5 flex flex-col gap-3">
          <label className="flex items-start gap-2 text-[12.5px] text-texto-2 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={detalhe}
              disabled={sincronizando}
              onChange={(e) => setDetalhe(e.target.checked)}
            />
            <span>
              <span className="font-semibold text-texto">
                Incluir regras de ATP (detalhe completo)
              </span>
              <span className="block text-texto-3 text-[11.5px] mt-0.5">
                Abre cada regra no Eproc: pode levar alguns minutos. Desmarcada, vem só a lista e o
                detalhe trazido antes é mantido.
              </span>
            </span>
          </label>

          {sincronizando && (
            <div className="text-[12px] text-texto-2" role="status" aria-live="polite">
              {progresso && progresso.total > 0
                ? `Lendo a regra ${progresso.feitas} de ${progresso.total}…`
                : 'Sincronizando…'}
            </div>
          )}
        </div>

        <div
          className="px-5 py-3 flex items-center gap-2"
          style={{ borderTop: '1px solid var(--borda)', background: 'var(--fundo)' }}
        >
          <div className="flex-1" />
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={sincronizando}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={iniciar}
            disabled={sincronizando}
            autoFocus
          >
            <Icon.Sincronizar /> Sincronizar
          </button>
        </div>
      </div>
    </>
  );
}
