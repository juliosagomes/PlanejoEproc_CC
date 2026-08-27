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

/** Intervalos oferecidos no popup. `null` = sincronização automática desligada. */
export const INTERVALOS_MIN = [15, 30, 60] as const;

const UltimaSessaoSchema = z.object({ workspaceId: z.string().min(1) });

const PrefsSchema = z.object({
  /** Minutos entre sincronizações automáticas; `null` desliga. */
  intervaloMin: z.union([z.literal(15), z.literal(30), z.literal(60), z.null()]),
  /** Enviar também, não só baixar. Perigoso — ver `PREFS_PADRAO`. */
  autoPush: z.boolean(),
  notificar: z.boolean(),
});

export type PrefsSync = z.infer<typeof PrefsSchema>;

/**
 * `autoPush` nasce **desligado** de propósito. Um push manda todos os planos
 * locais e propaga tombstones; disparado sem intervenção do usuário, um silo
 * desatualizado sobrescreveria em silêncio o trabalho de um colega — exatamente
 * o cenário que o desenho de tombstones existe para evitar (decisoes.md#D-9).
 * O pull não tem esse risco: preserva rascunhos nunca publicados (`aplicar.ts`).
 */
export const PREFS_PADRAO: PrefsSync = {
  intervaloMin: 15,
  autoPush: false,
  notificar: true,
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
 * Marca d'água da última sincronização (só para exibir no popup)
 * ========================================================================== */

export function getUltimaSincronizacao(): string | null {
  return ler(ULTIMO_EM_KEY, z.string().datetime());
}

export function marcarSincronizacao(quando = new Date().toISOString()): void {
  gravar(ULTIMO_EM_KEY, quando);
}
