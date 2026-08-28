import { z } from 'zod';
import { getStorage } from '@/infra/plataforma/storageLike';

/* ============================================================================
 * SESSÃO PERSISTIDA + PREFERÊNCIAS DE SINCRONIZAÇÃO
 *
 * A sessão do app é memória pura, por desenho: a tela de entrada aparece sempre
 * para deixar explícito em qual contexto se está (decisoes.md#D-9). Só que o
 * service worker acorda sem UI e sem memória — ele precisa saber, de algum
 * lugar, **qual lotação** sincronizar.
 *
 * Daí estas duas chaves. Note o que elas NÃO guardam: o código de acesso. Esse
 * continua vindo de `lotacoes.ts`, que já o mantém indexado por `workspaceId` —
 * duplicá-lo aqui ampliaria a superfície discutida no D-9 sem ganho nenhum.
 *
 * `prefs` viaja em `chrome.storage.sync` (allowlist do espelho): é escolha do
 * usuário, não do computador. `ultima` e `ultimoEm` ficam em `local` — em que
 * lotação eu estava e quando sincronizei pela última vez são fatos **desta**
 * máquina.
 * ========================================================================== */

const ULTIMA_KEY = 'planejoeproc:sessao:ultima';
const PREFS_KEY = 'planejoeproc:sync:prefs';
const ULTIMO_EM_KEY = 'planejoeproc:sync:ultimo';
const ULTIMA_VERIFICACAO_KEY = 'planejoeproc:sync:verificado';
const PENDENTE_KEY = 'planejoeproc:sync:pendente';

/** Intervalos oferecidos no popup. `null` = verificação automática desligada. */
export const INTERVALOS_MIN = [15, 30, 60] as const;

const UltimaSessaoSchema = z.object({ workspaceId: z.string().min(1) });

/**
 * Uma preferência só, e é sobre *avisar* — não sobre sincronizar
 * (decisoes.md#D-17).
 *
 * O schema já teve `autoPush` e `notificar`. Sumiram junto com a sincronização
 * automática: `autoPush` publicava todos os planos sem ninguém mandar, e
 * `notificar` desligado com intervalo ligado passou a não significar nada — a
 * notificação virou o único resultado da verificação.
 *
 * `z.object` descarta chave desconhecida, então prefs gravadas antes disto
 * continuam válidas e só perdem os dois campos.
 */
const PrefsSchema = z.object({
  /** Minutos entre verificações do servidor; `null` desliga. */
  intervaloMin: z.union([z.literal(15), z.literal(30), z.literal(60), z.null()]),
});

export type PrefsSync = z.infer<typeof PrefsSchema>;

export const PREFS_PADRAO: PrefsSync = {
  intervaloMin: 15,
};

function ler<T>(chave: string, schema: z.ZodType<T>): T | null {
  const storage = getStorage();
  if (!storage) return null;
  const raw = storage.getItem(chave);
  if (raw === null) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function gravar(chave: string, valor: unknown): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(chave, JSON.stringify(valor));
  } catch (err) {
    console.warn(`[sync] Falha ao gravar ${chave}.`, err);
  }
}

function apagar(chave: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(chave);
  } catch {
    // ignore
  }
}

/* ============================================================================
 * Última lotação
 * ========================================================================== */

/** `workspaceId` da última lotação aberta, ou `null` (modo local / nunca entrou). */
export function getUltimaLotacao(): string | null {
  return ler(ULTIMA_KEY, UltimaSessaoSchema)?.workspaceId ?? null;
}

export function setUltimaLotacao(workspaceId: string): void {
  gravar(ULTIMA_KEY, { workspaceId });
}

/** Chamado ao entrar em modo local ou sair — não há lotação a sincronizar. */
export function limparUltimaLotacao(): void {
  apagar(ULTIMA_KEY);
}

/* ============================================================================
 * Preferências
 * ========================================================================== */

export function getPrefs(): PrefsSync {
  return ler(PREFS_KEY, PrefsSchema) ?? PREFS_PADRAO;
}

export function setPrefs(prefs: PrefsSync): void {
  gravar(PREFS_KEY, prefs);
}

/* ============================================================================
 * Marcas d'água (só para exibir no popup)
 *
 * Duas, e a diferença é o ponto do D-17: **sincronizar** é trazer os planos, e
 * só acontece quando o usuário manda; **verificar** é perguntar ao servidor se
 * há novidade, e é o que o alarme faz sozinho. Um popup que dissesse
 * "sincronizado há 3 min" depois de uma verificação estaria mentindo.
 * ========================================================================== */

export function getUltimaSincronizacao(): string | null {
  return ler(ULTIMO_EM_KEY, z.string().datetime());
}

export function marcarSincronizacao(quando = new Date().toISOString()): void {
  gravar(ULTIMO_EM_KEY, quando);
}

export function getUltimaVerificacao(): string | null {
  return ler(ULTIMA_VERIFICACAO_KEY, z.string().datetime());
}

export function marcarVerificacao(quando = new Date().toISOString()): void {
  gravar(ULTIMA_VERIFICACAO_KEY, quando);
}

/* ============================================================================
 * O que a última verificação encontrou
 *
 * Precisa ser persistido, e não guardado em memória: o service worker do MV3 é
 * reciclado entre eventos, então o resultado do alarme das 14h já não existe
 * quando o popup abre às 14h05.
 * ========================================================================== */

const PendenteSchema = z.object({
  recebidos: z.number().int().nonnegative(),
  atualizados: z.number().int().nonnegative(),
  removidos: z.number().int().nonnegative(),
});

export type ResumoPendente = z.infer<typeof PendenteSchema>;

/** `null` quando a última verificação não achou diferença (ou nunca houve uma). */
export function getPendente(): ResumoPendente | null {
  return ler(PENDENTE_KEY, PendenteSchema);
}

export function setPendente(resumo: ResumoPendente | null): void {
  if (resumo === null) apagar(PENDENTE_KEY);
  else gravar(PENDENTE_KEY, resumo);
}
