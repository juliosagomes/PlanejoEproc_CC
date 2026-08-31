import type { LocalizadorUnidade } from '@/domain';
import { abrirGrade, textoSimples } from './infraTable';

/**
 * Parser da tela `localizador_orgao_listar` — "Localizadores do Órgão".
 *
 * É a **fonte principal** dos localizadores: traz sigla e nome em colunas
 * separadas (o que faz dela a verdade de referência para o parser do
 * `<select>`), mais descrição, a flag de sistema, a data de inclusão e o total
 * de processos. As mesmas colunas do XLS que este caminho substitui — a
 * diferença é que aqui não é preciso exportar planilha nenhuma.
 *
 * Pagina de 50 em 50 (`hdnInfraNroItens`), então o coletor entrega vários
 * fragmentos e esta função é chamada uma vez por página.
 */
const SINONIMOS = {
  sigla: ['LOCALIZADOR'],
  nome: ['NOME DO LOCALIZADOR', 'NOME'],
  descricao: ['DESCRICAO DO LOCALIZADOR', 'DESCRICAO'],
  sistema: ['LOCALIZADOR SISTEMA', 'SISTEMA'],
  dataInclusao: ['DATA INCLUSAO', 'INCLUSAO'],
  qtdProcessos: ['TOTAL DE PROCESSOS', 'TOTAL'],
} as const;

type Campo = keyof typeof SINONIMOS;

const OBRIGATORIAS: readonly Campo[] = ['sigla', 'nome', 'sistema'];

export interface LinhasOrgao {
  itens: LocalizadorUnidade[];
  /** Quantos dos itens são localizadores de sistema. */
  sistema: number;
  ignoradosVazios: number;
}

export function parseLocalizadorOrgao(fragmento: string): LinhasOrgao {
  const grade = abrirGrade<Campo>(fragmento, SINONIMOS, OBRIGATORIAS);

  const itens: LocalizadorUnidade[] = [];
  let sistema = 0;
  let ignoradosVazios = 0;

  for (const linha of grade.linhas) {
    const sigla = grade.celula(linha, 'sigla');
    if (!sigla) {
      ignoradosVazios += 1;
      continue;
    }

    // D-23: localizadores de sistema entram no catálogo marcados. Eles são
    // padrões do Eproc, mas os fluxos da unidade passam por eles, e escondê-los
    // tirava da autocomplete metade dos nomes que o usuário precisa escrever.
    const ehSistema = /^sim$/i.test(grade.celula(linha, 'sistema'));
    if (ehSistema) sistema += 1;

    const nome = grade.celula(linha, 'nome') || sigla;
    const descricao = grade.celula(linha, 'descricao');
    const dataInclusao = grade.celula(linha, 'dataInclusao');
    const qtd = Number(grade.celula(linha, 'qtdProcessos').replace(/\./g, ''));

    itens.push({
      sigla,
      nome,
      sistema: ehSistema,
      ...(descricao ? { descricao } : {}),
      ...(dataInclusao ? { dataInclusao } : {}),
      ...(Number.isFinite(qtd) ? { qtdProcessos: qtd } : {}),
    });
  }

  return { itens, sistema, ignoradosVazios };
}

/**
 * Confere se um fragmento é mesmo a tela de localizadores do órgão.
 *
 * Usado antes de parsear porque um `hash` gasto não dá erro no Eproc — ele
 * desvia para o Painel do Servidor, que também tem `table.infraTable`.
 */
export function ehTelaDeLocalizadores(fragmento: string): boolean {
  const doc = new DOMParser().parseFromString(fragmento, 'text/html');
  const tabela = doc.querySelector('table.infraTable');
  if (!tabela) return false;
  const primeira = tabela.querySelector('tr');
  if (!primeira) return false;
  const cabecalho = Array.from(primeira.children)
    .map((c) => textoSimples(c).toUpperCase())
    .join('|');
  return cabecalho.includes('LOCALIZADOR') && cabecalho.includes('SISTEMA');
}
