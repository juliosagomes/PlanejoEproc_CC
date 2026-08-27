import { inicializarPlataforma, flushPlataforma } from '@/infra/plataforma';
import { setEscopo } from '@/infra/storage';
import { SyncError } from '@/infra/sync/client';
import { findLotacao } from '@/infra/sync/lotacoes';
import {
  houveMudanca,
  pull,
  push,
  type ResumoSincronizacao,
} from '@/infra/sync/operacoes';
import {
  getPrefs,
  getUltimaLotacao,
  getUltimaSincronizacao,
  setPrefs,
} from '@/infra/sync/sessaoPersistida';
import { alvoDeFundo, textoDoResumo } from './fundo';
import type {
  Estado,
  ParaPagina,
  ParaWorker,
  RespostaAcao,
  RespostaEstado,
} from './mensagens';

/* ============================================================================
 * SERVICE WORKER
 *
 * Responsabilidades: manter o alarme de sincronização, executar o pull quando
 * nenhuma aba do editor está aberta, notificar quando algo mudou, e responder
 * ao popup.
 *
 * MV3 recicla o worker a qualquer momento, então **nada** aqui pode viver em
 * memória entre eventos: todo handler re-hidrata o espelho do `chrome.storage`
 * antes de ler qualquer coisa. O único estado de módulo é o mutex de
 * sincronização, e ele é intencionalmente descartável — se o worker morrer no
 * meio de um pull, o alarme seguinte simplesmente tenta de novo.
 * ========================================================================== */

const ALARME = 'planejoeproc:sync';
const NOTIFICACAO = 'planejoeproc:mudou';
const EDITOR = 'index.html';

/** Impede que o alarme e o botão "Sincronizar agora" se atropelem. */
let sincronizando = false;
let ultimoErro: string | null = null;

function log(...args: unknown[]): void {
  console.log('[planejoeproc:sw]', ...args);
}

/* ============================================================================
 * Alarme
 * ========================================================================== */

async function reprogramarAlarme(): Promise<void> {
  await chrome.alarms.clear(ALARME);
  const { intervaloMin } = getPrefs();
  if (intervaloMin === null) {
    log('sincronização automática desligada');
    return;
  }
  chrome.alarms.create(ALARME, {
    periodInMinutes: intervaloMin,
    // Sem `delayInMinutes`, o primeiro disparo só viria depois de um período
    // inteiro — quem acabou de instalar ficaria 15 min sem entender o porquê.
    delayInMinutes: 1,
  });
  log(`alarme a cada ${intervaloMin} min`);
}

/* ============================================================================
 * Delegação para a aba aberta
 * ========================================================================== */

/**
 * O editor mantém o plano ativo em memória, na store do canvas. Se o worker
 * sobrescrevesse o silo por baixo, a próxima gravação com debounce do canvas
 * escreveria por cima do que acabou de chegar do servidor.
 *
 * Então: havendo aba do editor, ela sincroniza; o worker só cutuca. Uma única
 * thread mexe no silo por vez, e a aba já sabe recarregar o ativo depois do
 * pull.
 */
async function editorAberto(): Promise<boolean> {
  const url = chrome.runtime.getURL(EDITOR);
  const abas = await chrome.tabs.query({ url });
  return abas.length > 0;
}

async function pedirParaAbaSincronizar(): Promise<boolean> {
  const msg: ParaPagina = { tipo: 'sincronize-voce' };
  try {
    await chrome.runtime.sendMessage(msg);
    return true;
  } catch {
    // "Receiving end does not exist": a aba foi fechada entre a checagem e o
    // envio. Cai para o caminho headless.
    return false;
  }
}

/* ============================================================================
 * Notificação
 * ========================================================================== */

function notificar(nomeLotacao: string, resumo: ResumoSincronizacao): void {
  chrome.notifications.create(NOTIFICACAO, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: `PlanejoEproc — ${nomeLotacao}`,
    message: textoDoResumo(resumo),
  });
}

/* ============================================================================
 * Sincronização de fundo
 * ========================================================================== */

async function sincronizarDeFundo(origem: 'alarme' | 'popup'): Promise<RespostaAcao> {
  if (sincronizando) return { ok: false, erro: 'Sincronização já em andamento.' };
  sincronizando = true;
  try {
    await inicializarPlataforma();

    const alvo = alvoDeFundo();
    if (!alvo) {
      log(`${origem}: sem lotação ativa, nada a fazer`);
      return { ok: true };
    }

    if (await editorAberto()) {
      if (await pedirParaAbaSincronizar()) {
        log(`${origem}: delegado à aba do editor`);
        return { ok: true };
      }
    }

    setEscopo({ tipo: 'lotacao', workspaceId: alvo.workspaceId });
    const prefs = getPrefs();
    const resumo = await pull(alvo);
    if (prefs.autoPush && alvo.permissao === 'edicao') await push(alvo);
    flushPlataforma();

    ultimoErro = null;
    log(`${origem}: pull ok`, resumo);

    if (prefs.notificar && houveMudanca(resumo)) {
      notificar(findLotacao(alvo.workspaceId)?.nome ?? 'Lotação', resumo);
    }
    return { ok: true };
  } catch (err) {
    ultimoErro =
      err instanceof SyncError ? err.message : 'Falha inesperada ao sincronizar.';
    console.error('[planejoeproc:sw] sincronização falhou', err);
    return { ok: false, erro: ultimoErro };
  } finally {
    sincronizando = false;
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
    prefs: getPrefs(),
    sincronizando,
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
  void sincronizarDeFundo('alarme');
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

      case 'sincronizar-agora':
        void sincronizarDeFundo('popup').then(sendResponse);
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
