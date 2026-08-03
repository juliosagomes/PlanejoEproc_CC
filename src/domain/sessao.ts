/**
 * Sessão = o contexto em que o usuário abre o app. É escolhido na tela de
 * login e determina quais planos ele enxerga.
 *
 * - `local`: planos ficam só neste navegador; nenhuma chamada de rede acontece.
 * - `lotacao`: planos pertencem a uma unidade (vara, cartório, gabinete)
 *   compartilhada por código. O `workspaceId` identifica a lotação no servidor
 *   e nomeia o silo local; o `codigo` é o segredo de acesso (ver decisoes.md#D-8).
 */

export type Permissao = 'leitura' | 'edicao';

export interface SessaoLocal {
  tipo: 'local';
}

export interface SessaoLotacao {
  tipo: 'lotacao';
  workspaceId: string;
  nome: string;
  /** Código usado para entrar — de leitura ou de edição, conforme `permissao`. */
  codigo: string;
  /**
   * Código de leitura da lotação, para quem entrou como editor poder repassá-lo
   * sem entregar junto o poder de publicar. Só vem preenchido quando
   * `permissao === 'edicao'` — com código de leitura, `codigo` já É este valor.
   * Opcional porque implantações antigas do Apps Script não o devolvem
   * (ver decisoes.md#D-10).
   */
  codigoLeitura?: string;
  permissao: Permissao;
}

export type Sessao = SessaoLocal | SessaoLotacao;

/** `true` quando a sessão permite publicar (push) no servidor. */
export function podeEditar(sessao: Sessao): sessao is SessaoLotacao {
  return sessao.tipo === 'lotacao' && sessao.permissao === 'edicao';
}
