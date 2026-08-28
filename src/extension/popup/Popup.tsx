import { useCallback, useEffect, useState } from 'react';
import { SeloPermissao } from '@/features/sessao/components/SeloPermissao';
import { INTERVALOS_MIN, type PrefsSync } from '@/infra/sync/sessaoPersistida';
import type { Estado, ParaWorker, RespostaAcao, RespostaEstado } from '../mensagens';

/* ============================================================================
 * POPUP
 *
 * A superfície pequena: em que lotação estou, se há novidade no servidor,
 * verificar agora, e de quanto em quanto tempo verificar. O editor de verdade
 * abre em aba — canvas não cabe em 360px.
 *
 * O que este painel **não** tem é um botão de baixar. Trazer os planos é uma
 * escrita no silo e pode passar por cima de uma edição em andamento; ela mora
 * onde o canvas está para recarregar depois, no botão "Baixar do servidor" do
 * cabeçalho (decisoes.md#D-17).
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

function textoPendente(p: NonNullable<Estado['pendente']>): string {
  const partes: string[] = [];
  if (p.recebidos > 0) partes.push(`${p.recebidos} plano(s) novo(s)`);
  if (p.atualizados > 0) partes.push(`${p.atualizados} com alteração`);
  if (p.removidos > 0) partes.push(`${p.removidos} removido(s) lá`);
  return partes.join(' · ');
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

  const verificarAgora = async () => {
    setOcupado(true);
    setErro(null);
    try {
      const r = await enviar<RespostaAcao>({ tipo: 'verificar-agora' });
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

  const { lotacao, prefs, pendente } = estado;

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
              Verificado {haQuantoTempo(estado.ultimaVerificacao)} · baixado{' '}
              {haQuantoTempo(estado.ultimaSincronizacao)}
            </p>
          </>
        ) : (
          <p className="text-[12px] text-texto-2">
            Modo local — nenhuma lotação aberta.
            <span className="block mt-1 text-[11px] text-texto-3">
              Entre numa lotação pelo editor para acompanhar o servidor.
            </span>
          </p>
        )}
      </section>

      {erro !== null && (
        <p className="rounded-md border border-borda bg-aviso-suave px-2.5 py-2 text-[11px] text-texto-2">
          {erro}
        </p>
      )}

      {/* O aviso é o produto da verificação. O botão que age fica no editor, de
          propósito: é lá que o canvas recarrega o plano ativo depois do pull. */}
      {pendente && (
        <section className="rounded-md border border-destaque-borda bg-destaque-suave px-2.5 py-2">
          <p className="text-[12px] font-medium text-texto">Há novidade no servidor</p>
          <p className="mt-0.5 text-[11px] text-texto-2">{textoPendente(pendente)}</p>
          <button
            className="btn btn-sm btn-primary mt-2 w-full justify-center"
            onClick={() => void enviar({ tipo: 'abrir-editor' })}
          >
            Abrir editor para baixar
          </button>
        </section>
      )}

      <button
        className="btn w-full justify-center"
        disabled={ocupado || lotacao === null}
        onClick={() => void verificarAgora()}
      >
        {ocupado ? 'Verificando…' : 'Verificar agora'}
      </button>

      <section className="flex flex-col gap-2 border-t border-borda pt-3">
        <label className="flex items-center justify-between gap-2 text-[12px]">
          <span>Verificar sozinho</span>
          <select
            className="select w-auto"
            value={prefs.intervaloMin ?? 'off'}
            onChange={(e) => {
              const v = e.target.value;
              void salvarPrefs({
                intervaloMin:
                  v === 'off' ? null : (Number(v) as (typeof INTERVALOS_MIN)[number]),
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
        <p className="text-[11px] text-texto-3 leading-snug">
          A extensão só olha e avisa. Baixar os planos é sempre você quem manda, no
          editor — assim uma atualização nunca cai por cima do que você está
          escrevendo.
        </p>
      </section>
    </div>
  );
}
