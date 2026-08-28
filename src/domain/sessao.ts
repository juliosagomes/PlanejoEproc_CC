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

/**
 * `true` quando a sessão é **só de visualização**: entrou numa lotação com o
 * código de leitura.
 *
 * Não é o complemento de `podeEditar` — o modo local não publica em servidor
 * nenhum e mesmo assim é totalmente editável. O que separa os dois é de quem é
 * o plano: no modo local é seu, na lotação lida com código de leitura é de
 * outra pessoa (decisoes.md#D-19).
 */
export function somenteVisualizacao(sessao: Sessao): boolean {
  return sessao.tipo === 'lotacao' && sessao.permissao === 'leitura';
}
