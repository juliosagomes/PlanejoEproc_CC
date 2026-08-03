import type { Permissao, Plano } from '@/domain';
import { SYNC_API_URL } from './config';
import {
  CriarWorkspaceResponseSchema,
  PublicarResponseSchema,
  SincronizarResponseSchema,
  type SincronizarPlanoItem,
} from './syncSchema';

/**
 * Cliente HTTP fino para o backend de sincronização (Apps Script). Cada
 * função lança `SyncError` em qualquer falha (rede, resposta inesperada, ou
 * erro reportado pelo servidor) — o caller (store da feature) captura e
 * mostra a mensagem, mesmo padrão de `XlsParseError` em
 * `infra/catalogo/parseLocalizadoresXls.ts`.
 */
export class SyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncError';
  }
}

export interface PlanoParaPublicar {
  remotoId: string;
  plano: Plano;
}

export interface SincronizarResultado {
  /** Identidade da lotação no servidor — é o que nomeia o silo local. */
  workspaceId: string;
  nome: string;
  planos: SincronizarPlanoItem[];
  permissao: Permissao;
  /** Presente só com permissão de edição, e só em implantações atualizadas. */
  codigoLeitura?: string;
}

export interface PublicarResultado {
  publicados: Array<{ remotoId: string; atualizadoEm: string }>;
  removidos: string[];
}

function checkConfigured(): void {
  if (!SYNC_API_URL) {
    throw new SyncError(
      'Sincronização não configurada neste build. Veja apps-script/README.md.',
    );
  }
}

/**
 * O Apps Script sempre responde 200 quando a implantação está no ar — mesmo
 * para erros de domínio, que vêm como `{ ok: false, erro }`. Então qualquer
 * status fora de 2xx é problema de *implantação*, não de uso: diagnosticamos
 * pelo código em vez de deixar o HTML de erro do Google cair no `res.json()`
 * e virar a mensagem genérica "resposta inválida", que manda quem lê procurar
 * bug no lugar errado.
 */
function mensagemDeStatus(status: number): string | null {
  if (status === 404) {
    return 'Servidor de sincronização não encontrado (404) — a implantação do Apps Script pode ter sido removida. Veja apps-script/README.md.';
  }
  if (status === 401 || status === 403) {
    return `Servidor de sincronização recusou o acesso (${status}) — a implantação precisa estar publicada para "Qualquer pessoa". Veja apps-script/README.md.`;
  }
  if (status >= 500) {
    return `Servidor de sincronização falhou (${status}). Tente de novo em alguns instantes.`;
  }
  return null;
}

async function parseJsonResponse(res: Response): Promise<unknown> {
  if (!res.ok) {
    console.error('[sync] resposta com status de erro', res.status, res.statusText);
    throw new SyncError(
      mensagemDeStatus(res.status) ??
        `Servidor de sincronização respondeu com erro ${res.status}.`,
    );
  }
  try {
    return await res.json();
  } catch (err) {
    // 200 sem JSON é tipicamente a página de login do Google: a implantação
    // existe mas exige conta, então o navegador recebe HTML em vez da API.
    console.error('[sync] resposta não era JSON válido', res.status, res.statusText, err);
    throw new SyncError(
      'Resposta inválida do servidor de sincronização — a implantação pode estar exigindo login. Veja apps-script/README.md.',
    );
  }
}

async function postJson(body: unknown): Promise<unknown> {
  checkConfigured();
  let res: Response;
  try {
    res = await fetch(SYNC_API_URL, {
      method: 'POST',
      // text/plain contorna o preflight CORS que o Apps Script não trata
      // bem para application/json vindo de outra origem (ver apps-script/Code.gs).
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error('[sync] fetch (POST) falhou', err);
    throw new SyncError('Falha de rede ao contatar o servidor de sincronização.');
  }
  return parseJsonResponse(res);
}

async function getJson(params: Record<string, string>): Promise<unknown> {
  checkConfigured();
  const url = new URL(SYNC_API_URL);
  Object.entries(params).forEach(([chave, valor]) => url.searchParams.set(chave, valor));
  let res: Response;
  try {
    res = await fetch(url.toString());
  } catch (err) {
    console.error('[sync] fetch (GET) falhou', err);
    throw new SyncError('Falha de rede ao contatar o servidor de sincronização.');
  }
  return parseJsonResponse(res);
}

export async function criarWorkspace(
  nome: string,
  planos: PlanoParaPublicar[],
): Promise<{ workspaceId: string; codigoLeitura: string; codigoEdicao: string }> {
  const json = await postJson({ action: 'criarWorkspace', nome, planos });
  const result = CriarWorkspaceResponseSchema.safeParse(json);
  if (!result.success) throw new SyncError('Resposta inesperada ao criar lotação.');
  if (!result.data.ok) throw new SyncError(result.data.erro);
  const { workspaceId, codigoLeitura, codigoEdicao } = result.data;
  return { workspaceId, codigoLeitura, codigoEdicao };
}

/**
 * `remover` são `remotoId`s de planos excluídos localmente que devem sumir do
 * servidor. Mandamos a lista explícita em vez de deixar o servidor apagar
 * tudo que não veio em `planos`: se o conjunto local estiver desatualizado,
 * a segunda estratégia apagaria em silêncio um plano que um colega acabou de
 * publicar (decisoes.md#D-9).
 */
export async function publicar(
  codigoEdicao: string,
  planos: PlanoParaPublicar[],
  remover: string[] = [],
): Promise<PublicarResultado> {
  const json = await postJson({
    action: 'publicar',
    codigo: codigoEdicao,
    planos,
    remover,
  });
  const result = PublicarResponseSchema.safeParse(json);
  if (!result.success) throw new SyncError('Resposta inesperada ao publicar.');
  if (!result.data.ok) throw new SyncError(result.data.erro);
  return { publicados: result.data.publicados, removidos: result.data.removidos };
}

export async function sincronizar(codigo: string): Promise<SincronizarResultado> {
  const json = await getJson({ action: 'sincronizar', codigo });
  const result = SincronizarResponseSchema.safeParse(json);
  if (!result.success) throw new SyncError('Resposta inesperada ao sincronizar.');
  if (!result.data.ok) throw new SyncError(result.data.erro);
  const { workspaceId, nome, planos, permissao, codigoLeitura } = result.data;
  return { workspaceId, nome, planos, permissao, codigoLeitura };
}
