import { useCallback, useEffect, useState } from 'react';
import { SeloPermissao } from '@/features/sessao/components/SeloPermissao';
import { INTERVALOS_MIN, type PrefsSync } from '@/infra/sync/sessaoPersistida';
import type { Estado, ParaWorker, RespostaAcao, RespostaEstado } from '../mensagens';

/* ============================================================================
 * POPUP
 *
 * A superfície pequena: em que lotação estou, quando sincronizei, sincronizar
 * agora, e as três preferências. O editor de verdade abre em aba — canvas não
 * cabe em 360px.
 *
 * Todo o estado vem do service worker; o popup não lê o storage direto. Assim
 * há uma única resposta para "qual é a lotação corrente", e ela é a mesma que
 * o alarme usa.
 * ========================================================================== */

function enviar<R>(msg: ParaWorker): Promise<R> {
  return chrome.runtime.sendMessage(msg) as Promise<R>;
}

function haQuantoTempo(iso: string | null): string {
  if (iso === null) return 'nunca';
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora há pouco';
  if (min < 60) return `há ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `há ${horas} h`;
  return `há ${Math.floor(horas / 24)} d`;
}

export function Popup() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [semWorker, setSemWorker] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await enviar<RespostaEstado>({ tipo: 'estado' });
      setEstado(r.estado);
      setErro(r.estado.ultimoErro);
      setSemWorker(false);
    } catch (err) {
      // O service worker pode estar reiniciando, ter travado, ou esta página
      // pode estar aberta fora da extensão. Sem esse ramo, o popup ficaria em
      // "Carregando…" para sempre, sem dizer o porquê.
      console.error('[popup] service worker não respondeu', err);
      setSemWorker(true);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const sincronizarAgora = async () => {
    setOcupado(true);
    setErro(null);
    try {
      const r = await enviar<RespostaAcao>({ tipo: 'sincronizar-agora' });
      if (!r.ok) setErro(r.erro);
      await carregar();
    } catch {
      setSemWorker(true);
    } finally {
      setOcupado(false);
    }
  };

  // Otimista: a UI reflete a escolha na hora e o worker confirma depois. Uma
  // falha aqui é recuperável — reabrir o popup recarrega o valor de verdade.
  const salvarPrefs = async (prefs: PrefsSync) => {
    setEstado((e) => (e ? { ...e, prefs } : e));
    try {
      await enviar<RespostaAcao>({ tipo: 'salvar-prefs', prefs });
    } catch {
      setSemWorker(true);
    }
  };

  if (semWorker) {
    return (
      <div className="w-[340px] bg-fundo p-3.5 text-[12px] text-texto-2">
        <p className="font-medium text-texto">Extensão não respondeu</p>
        <p className="mt-1 text-[11px] text-texto-3">
          Recarregue a extensão em chrome://extensions e abra este painel de novo.
        </p>
        <button className="btn btn-sm mt-2.5" onClick={() => void carregar()}>
          Tentar de novo
        </button>
      </div>
    );
  }

  if (estado === null) {
    return <div className="p-4 text-xs text-texto-3">Carregando…</div>;
  }

  const { lotacao, prefs } = estado;

  return (
    <div className="flex flex-col gap-3 p-3.5 w-[340px] bg-fundo text-texto">
      <header className="flex items-baseline justify-between gap-2">
        <h1 className="text-sm font-semibold">PlanejoEproc</h1>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => void enviar({ tipo: 'abrir-editor' })}
        >
          Abrir editor
        </button>
      </header>

      <section className="rounded-md border border-borda bg-superficie p-2.5">
        {lotacao ? (
          <>
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-medium truncate">{lotacao.nome}</span>
              <SeloPermissao permissao={lotacao.permissao} />
            </div>
            <p className="mt-1 text-[11px] text-texto-3">
              Sincronizado {haQuantoTempo(estado.ultimaSincronizacao)}
            </p>
          </>
        ) : (
          <p className="text-[12px] text-texto-2">
            Modo local — nenhuma lotação aberta.
            <span className="block mt-1 text-[11px] text-texto-3">
              Entre numa lotação pelo editor para sincronizar automaticamente.
            </span>
          </p>
        )}
      </section>

      {erro !== null && (
        <p className="rounded-md border border-borda bg-aviso-suave px-2.5 py-2 text-[11px] text-texto-2">
          {erro}
        </p>
      )}

      <button
        className="btn btn-primary w-full justify-center"
        disabled={ocupado || lotacao === null}
        onClick={() => void sincronizarAgora()}
      >
        {ocupado ? 'Sincronizando…' : 'Sincronizar agora'}
      </button>

      <section className="flex flex-col gap-2 border-t border-borda pt-3">
        <label className="flex items-center justify-between gap-2 text-[12px]">
          <span>Sincronizar sozinho</span>
          <select
            className="select w-auto"
            value={prefs.intervaloMin ?? 'off'}
            onChange={(e) => {
              const v = e.target.value;
              void salvarPrefs({
                ...prefs,
                intervaloMin: v === 'off' ? null : (Number(v) as (typeof INTERVALOS_MIN)[number]),
              });
            }}
          >
            {INTERVALOS_MIN.map((m) => (
              <option key={m} value={m}>
                a cada {m} min
              </option>
            ))}
            <option value="off">desligado</option>
          </select>
        </label>

        <label className="flex items-center gap-2 text-[12px]">
          <input
            type="checkbox"
            checked={prefs.notificar}
            onChange={(e) => void salvarPrefs({ ...prefs, notificar: e.target.checked })}
          />
          <span>Avisar quando algo mudar</span>
        </label>

        <label className="flex items-start gap-2 text-[12px]">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={prefs.autoPush}
            disabled={lotacao?.permissao !== 'edicao'}
            onChange={(e) => void salvarPrefs({ ...prefs, autoPush: e.target.checked })}
          />
          <span>
            Enviar meus planos junto
            <span className="block text-[11px] text-texto-3">
              Publica todos os planos desta lotação a cada sincronização. Se a sua
              cópia estiver desatualizada, sobrescreve o que um colega publicou.
            </span>
          </span>
        </label>
      </section>
    </div>
  );
}
