import type { ColetaUnidade } from '@/infra/eproc/tipos';
import { ehExtensao } from '@/infra/plataforma';
import { coletarUnidadeNaAba } from './coletor/eproc';
import { PADROES_EPROC } from './eprocUrls';

/**
 * Ponte entre o editor e a aba do Eproc.
 *
 * Concentra o `chrome.*` desta feature (a fronteira do CLAUDE.md), e é chamada
 * pela store da feature — que não conhece `chrome` nenhum.
 *
 * **Por que a própria página injeta, e não o service worker.** Páginas de
 * extensão têm acesso à API `chrome.scripting` direto, então tirar o worker do
 * caminho mantém a invariante do D-13: uma única thread mexendo no storage.
 * O worker existe para trabalho de fundo por alarme; aqui o gatilho é um clique.
 */
export class SemAbaDoEprocError extends Error {
  constructor() {
    super(
      'Não achei nenhuma aba do Eproc aberta. Abra o Eproc, faça login, e clique de novo.',
    );
    this.name = 'SemAbaDoEprocError';
  }
}

/**
 * Acha uma aba do Eproc e coleta nela.
 *
 * Deliberadamente **não navega por conta própria**: abrir o Eproc numa aba nova
 * pode cair na tela de login e, pior, mexer na navegação do usuário sem ele ter
 * pedido. Se não há aba, o erro diz o que fazer.
 *
 * `allFrames: true` porque o Eproc usa frames e o menu nem sempre está no
 * principal; fica o primeiro resultado que trouxe alguma fonte.
 */
export async function coletarDaUnidade(): Promise<ColetaUnidade> {
  // No `npm run dev` o app roda como página comum, sem `chrome.*`. Sem esta
  // guarda o sintoma seria um "chrome is not defined" no lugar de uma
  // explicação — e a coleta é justamente o recurso que só a extensão tem.
  if (!ehExtensao() || typeof chrome?.scripting?.executeScript !== 'function') {
    throw new Error(
      'A sincronização com a unidade só funciona na extensão instalada no Chrome, ' +
        'porque depende da sua sessão do Eproc na aba.',
    );
  }

  const abas = await chrome.tabs.query({ url: PADROES_EPROC });
  const aba = abas.find((t) => typeof t.id === 'number');
  if (!aba || typeof aba.id !== 'number') throw new SemAbaDoEprocError();

  const resultados = await chrome.scripting.executeScript({
    target: { tabId: aba.id, allFrames: true },
    // MAIN, não o mundo isolado padrão. As telas de Modelos e Textos Padrão só
    // paginam chamando `infraAcaoPaginar`, que é uma função **da página** — e o
    // mundo isolado, por construção, não enxerga variáveis JS da página. No
    // isolado o laço aborta na primeira volta e a coleta traz só a primeira
    // página, sem erro nenhum (foi o sintoma: 25 de 180 modelos).
    //
    // O coletor não usa `chrome.*` — se um dia usar, isto deixa de funcionar.
    world: 'MAIN',
    func: coletarUnidadeNaAba,
  });

  const coletas = resultados
    .map((r) => r.result as ColetaUnidade | undefined)
    .filter((c): c is ColetaUnidade => !!c);

  const boa = coletas.find((c) => !c.erro && Object.keys(c.fontes).length > 0);
  const primeira = boa ?? coletas[0];
  if (!primeira) {
    throw new Error(
      'A aba do Eproc não respondeu à coleta. Recarregue a página do Eproc e tente de novo.',
    );
  }
  return primeira;
}
