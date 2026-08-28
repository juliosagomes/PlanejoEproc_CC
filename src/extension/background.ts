import { inicializarPlataforma, flushPlataforma } from '@/infra/plataforma';
import { setEscopo } from '@/infra/storage';
import { SyncError } from '@/infra/sync/client';
import { findLotacao } from '@/infra/sync/lotacoes';
import { houveMudanca, verificar, type ResumoSincronizacao } from '@/infra/sync/operacoes';
import {
  getPendente,
  getPrefs,
  getUltimaLotacao,
  getUltimaSincronizacao,
  getUltimaVerificacao,
  setPendente,
  setPrefs,
} from '@/infra/sync/sessaoPersistida';
import { alvoDeFundo, textoDoResumo } from './fundo';
import type { Estado, ParaWorker, RespostaAcao, RespostaEstado } from './mensagens';

/* ============================================================================
 * SERVICE WORKER
 *
 * Responsabilidades: manter o alarme de verificação, perguntar ao servidor se
 * há novidade na última lotação aberta, notificar quando houver, e responder
 * ao popup.
 *
 * O que ele **não** faz mais: baixar planos (decisoes.md#D-17). Um pull de
 * fundo aplica o servidor por cima do silo, e o alarme não tem como saber que
 * a pessoa está no meio de uma alteração — o trabalho dela desaparecia sem
 * aviso. Agora o worker só lê para comparar; escrever plano é sempre decisão de
 * quem está na frente do editor.
 *
 * MV3 recicla o worker a qualquer momento, então **nada** aqui pode viver em
 * memória entre eventos: todo handler re-hidrata o espelho do `chrome.storage`
 * antes de ler qualquer coisa, e o resultado da última verificação é
 * persistido. O único estado de módulo é o mutex, e ele é intencionalmente
 * descartável — se o worker morrer no meio, o alarme seguinte tenta de novo.
 * ========================================================================== */

const ALARME = 'planejoeproc:verificar';
/**
 * Nome do alarme antes do D-17. Alarmes sobrevivem à atualização da extensão,
 * então sem apagá-lo explicitamente ele continuaria acordando o worker a cada
 * 15 min para cair no `return` do listener — para sempre.
 */
const ALARME_LEGADO = 'planejoeproc:sync';
const NOTIFICACAO = 'planejoeproc:mudou';
const EDITOR = 'index.html';

/** Impede que o alarme e o botão "Verificar agora" se atropelem. */
let verificando = false;
let ultimoErro: string | null = null;

function log(...args: unknown[]): void {
  console.log('[planejoeproc:sw]', ...args);
}

/* ============================================================================
 * Alarme
 * ========================================================================== */

async function reprogramarAlarme(): Promise<void> {
  await chrome.alarms.clear(ALARME_LEGADO);
  await chrome.alarms.clear(ALARME);
  const { intervaloMin } = getPrefs();
  if (intervaloMin === null) {
    log('verificação automática desligada');
    return;
  }
  chrome.alarms.create(ALARME, {
    periodInMinutes: intervaloMin,
    // Sem `delayInMinutes`, o primeiro disparo só viria depois de um período
    // inteiro — quem acabou de instalar ficaria 15 min sem entender o porquê.
    delayInMinutes: 1,
  });
  log(`verificando a cada ${intervaloMin} min`);
}

/* ============================================================================
 * Notificação
 *
 * É o único efeito da verificação. O texto diz o que mudou **e** o que fazer,
 * porque a extensão deliberadamente não faz por conta própria.
 * ========================================================================== */

function notificar(nomeLotacao: string, resumo: ResumoSincronizacao): void {
  chrome.notifications.create(NOTIFICACAO, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: `PlanejoEproc — ${nomeLotacao}`,
    message: `${textoDoResumo(resumo)}. Abra o editor e clique em "Baixar do servidor" quando quiser trazer.`,
  });
}

/* ============================================================================
 * Verificação de fundo
 * ========================================================================== */

async function verificarDeFundo(
  origem: 'alarme' | 'popup',
): Promise<RespostaAcao> {
  if (verificando) return { ok: false, erro: 'Verificação já em andamento.' };
  verificando = true;
  try {
    await inicializarPlataforma();

    const alvo = alvoDeFundo();
    if (!alvo) {
      log(`${origem}: sem lotação ativa, nada a verificar`);
      return { ok: true };
    }

    // O escopo aponta o silo só para **ler** o índice na comparação; nenhuma
    // escrita de plano acontece daqui.
    setEscopo({ tipo: 'lotacao', workspaceId: alvo.workspaceId });
    const resumo = await verificar(alvo);
    const mudou = houveMudanca(resumo);
    setPendente(mudou ? resumo : null);
    flushPlataforma();

    ultimoErro = null;
    log(`${origem}: verificado`, resumo);

    if (mudou) notificar(findLotacao(alvo.workspaceId)?.nome ?? 'Lotação', resumo);
    return { ok: true };
  } catch (err) {
    ultimoErro =
      err instanceof SyncError ? err.message : 'Falha inesperada ao verificar.';
    console.error('[planejoeproc:sw] verificação falhou', err);
    return { ok: false, erro: ultimoErro };
  } finally {
    verificando = false;
    // O escopo é estado de módulo compartilhado com `infra/storage`; deixá-lo
    // apontado depois do evento faria a próxima leitura do worker cair num silo
    // que talvez não seja mais o corrente.
    setEscopo(null);
  }
}

/* ============================================================================
 * Estado para o popup
 * ========================================================================== */

async function montarEstado(): Promise<Estado> {
  await inicializarPlataforma();
  const workspaceId = getUltimaLotacao();
  const conhecida = workspaceId === null ? undefined : findLotacao(workspaceId);
  return {
    lotacao: conhecida
      ? {
          workspaceId: conhecida.workspaceId,
          nome: conhecida.nome,
          permissao: conhecida.permissao,
        }
      : null,
    ultimaSincronizacao: getUltimaSincronizacao(),
    ultimaVerificacao: getUltimaVerificacao(),
    pendente: getPendente(),
    prefs: getPrefs(),
    verificando,
    ultimoErro,
  };
}

/* ============================================================================
 * Abrir/focar o editor
 * ========================================================================== */

async function abrirEditor(): Promise<void> {
  const url = chrome.runtime.getURL(EDITOR);
  const [existente] = await chrome.tabs.query({ url });
  if (existente?.id !== undefined) {
    await chrome.tabs.update(existente.id, { active: true });
    if (existente.windowId !== undefined) {
      await chrome.windows.update(existente.windowId, { focused: true });
    }
    return;
  }
  await chrome.tabs.create({ url });
}

/* ============================================================================
 * Handlers
 * ========================================================================== */

chrome.runtime.onInstalled.addListener(() => {
  void inicializarPlataforma().then(reprogramarAlarme);
});

chrome.runtime.onStartup.addListener(() => {
  void inicializarPlataforma().then(reprogramarAlarme);
});

chrome.alarms.onAlarm.addListener((alarme) => {
  if (alarme.name !== ALARME) return;
  void verificarDeFundo('alarme');
});

chrome.notifications.onClicked.addListener((id) => {
  if (id !== NOTIFICACAO) return;
  chrome.notifications.clear(id);
  void abrirEditor();
});

/**
 * `onMessage` precisa devolver `true` para manter o canal aberto enquanto a
 * promessa resolve — sem isso, o `sendResponse` chega depois de o canal ter
 * fechado e o popup recebe `undefined`.
 */
chrome.runtime.onMessage.addListener(
  (msg: ParaWorker, _sender, sendResponse: (r: RespostaEstado | RespostaAcao) => void) => {
    switch (msg.tipo) {
      case 'estado':
        void montarEstado().then((estado) => sendResponse({ ok: true, estado }));
        return true;

      case 'verificar-agora':
        void verificarDeFundo('popup').then(sendResponse);
        return true;

      case 'salvar-prefs':
        void inicializarPlataforma()
          .then(() => {
            setPrefs(msg.prefs);
            flushPlataforma();
            return reprogramarAlarme();
          })
          .then(() => sendResponse({ ok: true }));
        return true;

      case 'abrir-editor':
        void abrirEditor().then(() => sendResponse({ ok: true }));
        return true;

      default:
        // Mensagem de outra origem (ou versão futura): ignorar em silêncio é
        // melhor do que responder erro a quem não estava falando com a gente.
        return false;
    }
  },
);
