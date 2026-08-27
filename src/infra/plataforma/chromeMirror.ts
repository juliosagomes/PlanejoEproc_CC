import type { StorageLike } from './storageLike';

/* ============================================================================
 * ESPELHO SÍNCRONO DO chrome.storage
 *
 * `chrome.storage` é assíncrono; `infra/storage` é síncrono e precisa continuar
 * sendo (ver storageLike.ts e decisoes.md#D-12). A ponte é um `Map` em memória
 * hidratado uma vez no boot:
 *
 *   leitura  → só o Map (síncrona, sempre atual para quem escreveu por aqui)
 *   escrita  → Map imediatamente + `chrome.storage.*.set` em lote, sem await
 *   externo  → `chrome.storage.onChanged` reconcilia o Map e avisa a UI
 *
 * "Externo" é o service worker sincronizando em segundo plano, ou outra aba do
 * editor. Sem a reconciliação, esta aba continuaria enxergando o estado velho
 * até ser recarregada.
 *
 * ÁREAS
 * Quase tudo vai para `local` (com `unlimitedStorage`). Uma allowlist curta vai
 * para `sync`, que replica entre as máquinas do mesmo perfil Chrome — só
 * metadados pequenos, nunca planos: o limite é 8 KB por item e um plano de vara
 * passa de 20–80 KB (decisoes.md#D-8, #D-14).
 * ========================================================================== */

/** Chaves replicadas via `chrome.storage.sync`. Ver decisoes.md#D-14. */
const CHAVES_SYNC: ReadonlySet<string> = new Set([
  'planejoeproc:lotacoes',
  'planejoeproc:sync:prefs',
]);

type Area = 'local' | 'sync';

function areaDe(chave: string): Area {
  return CHAVES_SYNC.has(chave) ? 'sync' : 'local';
}

export type OuvinteExterno = (chaves: string[]) => void;

const espelho = new Map<string, string>();
const ouvintes = new Set<OuvinteExterno>();

/** Chaves com escrita pendente, por área. Esvaziadas no despacho do lote. */
const pendentes: Record<Area, Map<string, string | null>> = {
  local: new Map(),
  sync: new Map(),
};
let despachoAgendado = false;

/**
 * Chaves que **nós** acabamos de gravar. `chrome.storage.onChanged` dispara
 * para o próprio autor da escrita também; sem esse filtro, toda gravação local
 * acordaria a UI como se fosse mudança externa.
 */
const escritasProprias = new Set<string>();

function notificar(chaves: string[]): void {
  if (chaves.length === 0) return;
  for (const ouvinte of ouvintes) {
    try {
      ouvinte(chaves);
    } catch (err) {
      console.error('[plataforma] ouvinte de mudança externa falhou', err);
    }
  }
}

/**
 * Um `set`/`remove` por chave dispararia um IPC por chave — e um `savePlano`
 * toca três (plano, índice, ativo). Coalescer por microtask junta a rajada num
 * único par de chamadas por área.
 */
function agendarDespacho(): void {
  if (despachoAgendado) return;
  despachoAgendado = true;
  queueMicrotask(despachar);
}

function despachar(): void {
  despachoAgendado = false;
  for (const area of ['local', 'sync'] as const) {
    const lote = pendentes[area];
    if (lote.size === 0) continue;

    const gravar: Record<string, string> = {};
    const remover: string[] = [];
    for (const [chave, valor] of lote) {
      escritasProprias.add(chave);
      if (valor === null) remover.push(chave);
      else gravar[chave] = valor;
    }
    lote.clear();

    const alvo = chrome.storage[area];
    if (Object.keys(gravar).length > 0) {
      alvo.set(gravar).catch((err: unknown) => aoFalharEscrita(area, gravar, err));
    }
    if (remover.length > 0) {
      alvo.remove(remover).catch((err: unknown) => {
        console.warn(`[plataforma] falha ao remover de chrome.storage.${area}`, err);
      });
    }
  }
}

/**
 * `sync` tem cota apertada (8 KB por item, 100 KB no total). Estourar não pode
 * derrubar o fluxo do usuário: caímos para `local`, onde o dado continua
 * válido — só deixa de replicar entre máquinas.
 */
function aoFalharEscrita(area: Area, gravar: Record<string, string>, err: unknown): void {
  if (area === 'sync') {
    console.warn(
      '[plataforma] chrome.storage.sync recusou a escrita (provável cota); ' +
        'gravando em local — o dado não vai replicar entre máquinas.',
      err,
    );
    chrome.storage.local.set(gravar).catch((err2: unknown) => {
      console.error('[plataforma] fallback para chrome.storage.local também falhou', err2);
    });
    return;
  }
  console.error('[plataforma] falha ao gravar em chrome.storage.local', err);
}

/**
 * Despacha agora o que estiver pendente, sem esperar a microtask. Chamado pelo
 * `flushPersist()` do app antes de `beforeunload`: a página pode morrer antes
 * da microtask rodar, e a chamada ao `chrome.storage` precisa ao menos ter sido
 * emitida. Não há como *aguardar* a confirmação num handler de unload — risco
 * aceito e registrado em decisoes.md#D-12.
 */
export function flushEspelho(): void {
  if (despachoAgendado || pendentes.local.size > 0 || pendentes.sync.size > 0) {
    despachar();
  }
}

export const chromeMirror: StorageLike = {
  getItem(chave) {
    return espelho.get(chave) ?? null;
  },
  setItem(chave, valor) {
    espelho.set(chave, valor);
    pendentes[areaDe(chave)].set(chave, valor);
    agendarDespacho();
  },
  removeItem(chave) {
    espelho.delete(chave);
    pendentes[areaDe(chave)].set(chave, null);
    agendarDespacho();
  },
};

export function assinarMudancaExterna(ouvinte: OuvinteExterno): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

function aplicarMudancas(mudancas: Record<string, chrome.storage.StorageChange>): void {
  const externas: string[] = [];
  for (const [chave, mudanca] of Object.entries(mudancas)) {
    if (escritasProprias.delete(chave)) continue;
    if (typeof mudanca.newValue === 'string') espelho.set(chave, mudanca.newValue);
    else espelho.delete(chave);
    externas.push(chave);
  }
  notificar(externas);
}

/**
 * Lê as duas áreas para o Map e liga a reconciliação. Idempotente — o service
 * worker pode ser reciclado e re-hidratar a cada acordar.
 *
 * Só entram valores string: `infra/storage` sempre serializa com
 * `JSON.stringify` antes de gravar, então qualquer não-string na área é lixo de
 * outra origem e ignorá-lo é mais seguro do que adivinhar.
 */
export async function hidratarEspelho(): Promise<void> {
  espelho.clear();
  const [local, sync] = await Promise.all([
    chrome.storage.local.get(null),
    chrome.storage.sync.get(null).catch(() => ({}) as Record<string, unknown>),
  ]);
  // `sync` por último: é a fonte da verdade das chaves da allowlist, e se a
  // mesma chave existir nas duas áreas (fallback de cota), a réplica vence.
  for (const bruto of [local, sync]) {
    for (const [chave, valor] of Object.entries(bruto)) {
      if (typeof valor === 'string') espelho.set(chave, valor);
    }
  }
  if (!ouvinteRegistrado) {
    chrome.storage.onChanged.addListener(aplicarMudancas);
    ouvinteRegistrado = true;
  }
}

let ouvinteRegistrado = false;

/** Só para testes: devolve o espelho ao estado de módulo recém-carregado. */
export function _resetEspelhoParaTeste(): void {
  espelho.clear();
  ouvintes.clear();
  pendentes.local.clear();
  pendentes.sync.clear();
  escritasProprias.clear();
  despachoAgendado = false;
  ouvinteRegistrado = false;
}
