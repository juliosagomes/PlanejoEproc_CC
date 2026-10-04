import { z } from 'zod';
import { getStorage } from '@/infra/plataforma/storageLike';

/* ============================================================================
 * ORDEM DA LISTA DE PLANOS
 *
 * Preferência de tela, **global ao navegador** pelo mesmo motivo do tutorial
 * (`tutorial.ts`): é sobre a pessoa, não sobre um silo, e chave com escopo não
 * grava fora de sessão. Fica fora da allowlist do `sync` — perdê-la custa um
 * clique.
 * ========================================================================== */

const ORDEM_PLANOS_KEY = 'planejoeproc:ui:ordemPlanos';

export const ORDENS_PLANOS = ['recentes', 'alfabetica'] as const;
export type OrdemPlanos = (typeof ORDENS_PLANOS)[number];

const OrdemSchema = z.enum(ORDENS_PLANOS);

export function getOrdemPlanos(): OrdemPlanos {
  const raw = getStorage()?.getItem(ORDEM_PLANOS_KEY) ?? null;
  if (raw === null) return 'recentes';
  try {
    const parsed = OrdemSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : 'recentes';
  } catch {
    return 'recentes';
  }
}

export function setOrdemPlanos(ordem: OrdemPlanos): void {
  try {
    getStorage()?.setItem(ORDEM_PLANOS_KEY, JSON.stringify(ordem));
  } catch (err) {
    console.warn('[ordemPlanos] Falha ao gravar a ordem dos planos.', err);
  }
}
