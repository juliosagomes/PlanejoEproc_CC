/**
 * Leitura das grades `infraTable` do Eproc.
 *
 * O Eproc roda sobre o framework Infra, e todas as telas de listagem
 * (localizadores do órgão, modelos padrão, textos padrão, ações preferenciais)
 * usam a mesma `<table class="infraTable">`. Este módulo concentra as quatro
 * armadilhas que essa grade tem, para que cada parser de tela seja só um mapa de
 * colunas.
 *
 * As quatro, todas medidas contra HTML real (ver `__fixtures__/README.md`):
 *
 * 1. **Tabelas aninhadas no cabeçalho.** Cada `<th>` contém uma
 *    `<table class="infraTableOrdenacao">` com 2 `<tr>` (as setinhas de
 *    ordenação). Um `tabela.querySelectorAll('tr')` conta 63 linhas onde há 51.
 *    Só valem as linhas **filhas diretas** do `<tbody>`.
 *
 * 2. **Ordem de coluna varia por tribunal.** O mesmo Infra roda com as colunas
 *    em ordens diferentes, e indexar por posição erra em *silêncio* — escreve
 *    uma data no campo de descrição. Daí o mapa por nome de cabeçalho.
 *
 * 3. **`<br>` separa itens dentro de uma célula.** Ler `textContent` direto cola
 *    os nomes ("...Emenda Inicial🔵▶️GAB - Inicial Ar...").
 *
 * 4. **`hdnInfraNroItens` varia por tela** (50 em localizadores, 25 em modelos) e
 *    não aceita ser aumentado. Ler o valor, nunca assumir.
 */

/** Linhas filhas diretas do `<tbody>` — ignora as tabelas aninhadas. */
export function linhasDiretas(tabela: HTMLTableElement): HTMLTableRowElement[] {
  const corpo: Element = tabela.tBodies[0] ?? tabela;
  return Array.from(corpo.children).filter(
    (el): el is HTMLTableRowElement => el.tagName === 'TR',
  );
}

/**
 * Texto de uma célula com `<br>` virando quebra de linha.
 *
 * Trabalha sobre um clone: trocar os `<br>` do documento original quebraria
 * qualquer leitura posterior da mesma célula.
 */
export function textoDaCelula(celula: Element): string {
  const clone = celula.cloneNode(true) as Element;
  for (const br of Array.from(clone.querySelectorAll('br'))) {
    br.replaceWith('\n');
  }
  return (clone.textContent ?? '')
    .split('\n')
    .map((linha) => linha.replace(/[^\S\n]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/** Texto de célula colapsado numa linha só. */
export function textoSimples(celula: Element): string {
  return textoDaCelula(celula).replace(/\n/g, ' ').trim();
}

/** Itens de uma célula que lista vários valores separados por `<br>`. */
export function itensDaCelula(celula: Element): string[] {
  const texto = textoDaCelula(celula);
  if (!texto) return [];
  return texto.split('\n').filter((linha) => linha.length > 0);
}

/**
 * Índice de coluna por nome de cabeçalho.
 *
 * A comparação é frouxa de propósito (sem acento, sem caixa, sem pontuação):
 * "Descrição do Localizador" e "DESCRICAO" devem casar. Cada campo recebe uma
 * lista de sinônimos, e o primeiro que aparecer no cabeçalho ganha.
 */
export type MapaColunas<C extends string> = Record<C, number>;

function chaveDeCabecalho(texto: string): string {
  return texto
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toUpperCase();
}

/**
 * Duas passadas, e a ordem entre elas é o que impede um erro silencioso.
 *
 * "Localizador Sistema" **contém** "Localizador". Numa passada só, com
 * casamento por `includes`, o campo `sigla` (sinônimo "LOCALIZADOR") casaria
 * com a coluna Sistema sempre que ela viesse primeiro — e o parser escreveria
 * "Sim"/"Não" no lugar do nome do localizador, sem erro nenhum. Resolvendo os
 * casamentos **exatos** antes e marcando as colunas já reivindicadas, a
 * ambiguidade some independentemente da ordem das colunas, que é justamente o
 * que varia entre tribunais.
 */
export function mapearColunas<C extends string>(
  linhaCabecalho: HTMLTableRowElement,
  sinonimos: Record<C, readonly string[]>,
): Partial<MapaColunas<C>> {
  const cabecalhos = Array.from(linhaCabecalho.children).map((c) =>
    chaveDeCabecalho(textoSimples(c)),
  );
  const campos = Object.keys(sinonimos) as C[];
  const mapa: Partial<MapaColunas<C>> = {};
  const reivindicadas = new Set<number>();

  for (const campo of campos) {
    const alvos = sinonimos[campo].map(chaveDeCabecalho);
    const idx = cabecalhos.findIndex(
      (cab, i) => !reivindicadas.has(i) && cab.length > 0 && alvos.includes(cab),
    );
    if (idx >= 0) {
      mapa[campo] = idx;
      reivindicadas.add(idx);
    }
  }

  for (const campo of campos) {
    if (mapa[campo] !== undefined) continue;
    // Sinônimo mais longo primeiro: o mais específico deve vencer.
    const alvos = sinonimos[campo]
      .map(chaveDeCabecalho)
      .sort((a, b) => b.length - a.length);
    const idx = cabecalhos.findIndex(
      (cab, i) =>
        !reivindicadas.has(i) && cab.length > 0 && alvos.some((alvo) => cab.includes(alvo)),
    );
    if (idx >= 0) {
      mapa[campo] = idx;
      reivindicadas.add(idx);
    }
  }

  return mapa;
}

export interface GradeInfra<C extends string> {
  colunas: Partial<MapaColunas<C>>;
  linhas: HTMLTableRowElement[];
  /** Lê uma célula pelo nome do campo. String vazia se a coluna não existir. */
  celula: (linha: HTMLTableRowElement, campo: C) => string;
}

export class InfraTableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InfraTableError';
  }
}

/**
 * Abre a `infraTable` de um fragmento HTML e devolve as linhas de dado já com o
 * mapa de colunas resolvido.
 *
 * `camposObrigatorios` é a conferência de tela: um `hash` gasto não produz erro
 * no Eproc — ele **desvia** para o Painel do Servidor, que também tem uma
 * `infraTable`. Exigir as colunas esperadas é o que transforma esse desvio
 * silencioso em falha explícita.
 */
export function abrirGrade<C extends string>(
  fragmento: string,
  sinonimos: Record<C, readonly string[]>,
  camposObrigatorios: readonly C[],
): GradeInfra<C> {
  const doc = new DOMParser().parseFromString(fragmento, 'text/html');
  const tabela = doc.querySelector('table.infraTable') ?? doc.querySelector('table');
  if (!tabela) {
    throw new InfraTableError('Nenhuma tabela encontrada no fragmento.');
  }

  const todas = linhasDiretas(tabela as HTMLTableElement);
  const cabecalho = todas[0];
  if (!cabecalho) {
    throw new InfraTableError('Tabela sem linha de cabeçalho.');
  }

  const colunas = mapearColunas(cabecalho, sinonimos);
  const faltando = camposObrigatorios.filter((c) => colunas[c] === undefined);
  if (faltando.length > 0) {
    throw new InfraTableError(
      `Tela inesperada: faltam as colunas ${faltando.join(', ')}. ` +
        'Provável desvio para outra tela (hash de uso único já gasto).',
    );
  }

  return {
    colunas,
    linhas: todas.slice(1),
    celula: (linha, campo) => {
      const idx = colunas[campo];
      if (idx === undefined) return '';
      const cel = linha.children[idx];
      return cel ? textoSimples(cel) : '';
    },
  };
}

/**
 * Total anunciado no rodapé ("179 registros"), quando houver.
 *
 * Casa contra o **texto** do documento, não contra o HTML cru: no cru a
 * primeira ocorrência pode vir de um comentário ou de um atributo, e o número
 * errado faria o laço de paginação parar cedo ou girar à toa.
 */
export function totalDeRegistros(html: string): number | undefined {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const m = (doc.body?.textContent ?? '').match(/([\d.]+)\s*registros?/i);
  if (!m || !m[1]) return undefined;
  const n = Number(m[1].replace(/\./g, ''));
  return Number.isFinite(n) ? n : undefined;
}
