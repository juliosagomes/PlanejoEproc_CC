import type { ItemCatalogoUnidade } from '@/domain';
import { abrirGrade } from './infraTable';

/**
 * Parsers das duas listas de texto do Eproc: `modelo_padrao_listar` e
 * `texto_padrao_listar`.
 *
 * Têm a mesma forma — código, descrição, órgão dono e um campo que caracteriza
 * o item —, então dividem o mesmo caminho. O que muda é o mapa de colunas e
 * qual campo vira `detalhe`.
 *
 * **Nada é filtrado por órgão aqui.** As duas telas listam também o que veio de
 * outras unidades, e um item público de outra vara pode ser perfeitamente
 * utilizável. Descartar no parser perderia dado sem volta; a preferência pela
 * unidade do usuário é aplicada na camada de sugestão, onde dá para ordenar em
 * vez de excluir.
 */
const COLUNAS_MODELO = {
  orgao: ['ORGAO'],
  eprocId: ['CODIGO'],
  detalhe: ['TIPO DE DOCUMENTO'],
  nome: ['DESCRICAO'],
} as const;

const COLUNAS_TEXTO = {
  orgao: ['ORGAO'],
  eprocId: ['CODIGO'],
  detalhe: ['SIGLA AUTO TEXTO', 'SIGLA'],
  nome: ['DESCRICAO'],
} as const;

type CampoModelo = keyof typeof COLUNAS_MODELO;
type CampoTexto = keyof typeof COLUNAS_TEXTO;

function parseLista<C extends 'orgao' | 'eprocId' | 'detalhe' | 'nome'>(
  fragmento: string,
  colunas: Record<C, readonly string[]>,
): ItemCatalogoUnidade[] {
  const grade = abrirGrade<C>(fragmento, colunas, ['eprocId', 'nome'] as C[]);
  const itens: ItemCatalogoUnidade[] = [];

  for (const linha of grade.linhas) {
    const eprocId = grade.celula(linha, 'eprocId' as C);
    const nome = grade.celula(linha, 'nome' as C);
    if (!eprocId || !nome) continue;

    const orgao = grade.celula(linha, 'orgao' as C);
    const detalhe = grade.celula(linha, 'detalhe' as C);
    itens.push({
      eprocId,
      nome,
      ...(orgao ? { orgao } : {}),
      ...(detalhe ? { detalhe } : {}),
    });
  }

  return itens;
}

/** `modelo_padrao_listar` — `detalhe` é o tipo de documento. */
export function parseModeloPadrao(fragmento: string): ItemCatalogoUnidade[] {
  return parseLista<CampoModelo>(fragmento, COLUNAS_MODELO);
}

/**
 * `texto_padrao_listar` — `detalhe` é a **sigla auto-texto**, a tag que o
 * usuário digita na minuta (`@SIGLA@`). É ela que dá utilidade prática a
 * importar textos padrão: sem a sigla, o nome sozinho não ajuda a redigir.
 */
export function parseTextoPadrao(fragmento: string): ItemCatalogoUnidade[] {
  return parseLista<CampoTexto>(fragmento, COLUNAS_TEXTO);
}
