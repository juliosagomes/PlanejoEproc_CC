/* ============================================================================
 * DESTINOS DE DESCARTE DA UNIDADE (decisoes.md#D-38)
 *
 * Localizadores que só existem para preencher o destino que o Eproc exige numa
 * regra que não move ("P", o de nome invisível). A lista é da unidade — uma
 * chave por silo, como os setores (D-26) —, guardada por nome.
 * ========================================================================== */

export const DESCARTE_VERSION = 1 as const;

export interface DestinosDescarteUnidade {
  version: typeof DESCARTE_VERSION;
  nomes: string[];
}

/** Caracteres que não aparecem na tela. O U+200E é o nome "invisível" da unidade. */
const INVISIVEIS = /[\s​-‏⁠﻿]/g;

/** `true` quando o nome não tem nada visível, como o "‎" da unidade. */
export function nomeInvisivel(nome: string): boolean {
  return nome.length > 0 && nome.replace(INVISIVEIS, '') === '';
}

/**
 * Régua de "mesmo destino": espaço e caixa. Os invisíveis **não** são
 * removidos — senão o "‎" seria igual a um nome vazio.
 */
function canon(nome: string): string {
  return nome.replace(/\s+/g, ' ').trim().toLocaleUpperCase('pt-BR');
}

export function ehDestinoDescarte(nome: string, lista: readonly string[]): boolean {
  if (!nome) return false;
  const c = canon(nome);
  return c !== '' && lista.some((d) => canon(d) === c);
}

/** Como mostrar um destino na tela: o invisível ganha nome. */
export function rotuloDescarte(nome: string): string {
  return nomeInvisivel(nome) ? '(nome invisível)' : nome.trim();
}

/**
 * Candidatos óbvios no catálogo da unidade: nome invisível ou de um caractere
 * só. A detecção pelo uso ("recebe regras de muitos grupos e não é origem de
 * nenhuma") depende das regras de ATP na sincronização, que ainda não existe.
 */
export function sugerirDescarte(nomes: readonly string[], lista: readonly string[]): string[] {
  return nomes.filter(
    (n) => (nomeInvisivel(n) || n.replace(INVISIVEIS, '').length === 1) && !ehDestinoDescarte(n, lista),
  );
}
