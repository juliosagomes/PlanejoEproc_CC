/* ============================================================================
 * ESCOPO DE ARMAZENAMENTO
 *
 * Cada sessão (ver domain/sessao.ts) tem seu próprio silo de chaves no
 * localStorage. Entrar numa lotação nunca mistura planos com os de outra nem
 * com os do modo local — o isolamento é estrutural (prefixo de chave), não um
 * filtro que alguém possa esquecer de aplicar.
 *
 *   modo local        →  planejoeproc:plans:index
 *                        planejoeproc:plan:<id>
 *   lotação <wsId>    →  planejoeproc:lot:<wsId>:plans:index
 *                        planejoeproc:lot:<wsId>:plan:<id>
 *
 * O modo local mantém o prefixo histórico, então planos criados antes deste
 * rework continuam onde estavam — sem migração.
 *
 * Escopo `null` = nenhuma sessão ativa (o app está na tela de login). Nesse
 * estado toda leitura devolve vazio e toda escrita é no-op: o canvas em
 * branco que existe antes do login não pode sobrescrever plano nenhum.
 * ========================================================================== */

export type Escopo =
  | { tipo: 'local' }
  | { tipo: 'lotacao'; workspaceId: string };

const PREFIXO_LOCAL = 'planejoeproc:';

/**
 * Estado de módulo em vez de parâmetro em toda função: `savePlano` é chamado
 * pela subscription da store do canvas, que não tem (nem deveria ter) acesso
 * à sessão. O escopo é trocado num único ponto — `features/sessao/store.ts`.
 */
let escopoAtual: Escopo | null = null;

export function getEscopo(): Escopo | null {
  return escopoAtual;
}

export function setEscopo(escopo: Escopo | null): void {
  escopoAtual = escopo;
}

/** Prefixo de todas as chaves do escopo corrente, ou null se não há sessão. */
export function prefixo(): string | null {
  if (escopoAtual === null) return null;
  if (escopoAtual.tipo === 'local') return PREFIXO_LOCAL;
  return `${PREFIXO_LOCAL}lot:${escopoAtual.workspaceId}:`;
}

export function indexKey(): string | null {
  const p = prefixo();
  return p === null ? null : `${p}plans:index`;
}

export function activeKey(): string | null {
  const p = prefixo();
  return p === null ? null : `${p}plans:active`;
}

export function planKey(id: string): string | null {
  const p = prefixo();
  return p === null ? null : `${p}plan:${id}`;
}

/**
 * Roda `fn` sob outro escopo e restaura o anterior ao final. Serve para
 * espiar um silo sem entrar nele — a tela de login, por exemplo, precisa
 * saber se há planos no modo local antes de o usuário escolher qualquer coisa.
 *
 * Só é seguro com `fn` **síncrona**: o escopo é estado de módulo, então uma
 * função assíncrona devolveria o controle com o escopo ainda trocado.
 */
export function comEscopo<T>(escopo: Escopo | null, fn: () => T): T {
  const anterior = escopoAtual;
  escopoAtual = escopo;
  try {
    return fn();
  } finally {
    escopoAtual = anterior;
  }
}

/** `true` só no modo local — usado pela migração da chave legada single-plano. */
export function isEscopoLocal(): boolean {
  return escopoAtual?.tipo === 'local';
}

/** `workspaceId` da lotação corrente, ou null (modo local ou sem sessão). */
export function getWorkspaceId(): string | null {
  return escopoAtual?.tipo === 'lotacao' ? escopoAtual.workspaceId : null;
}
