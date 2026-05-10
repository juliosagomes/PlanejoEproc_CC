import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { CATALOGO_ORGAO_VERSION } from '@/domain';
import { XlsParseError, parseLocalizadoresXls } from './parseLocalizadoresXls';

/**
 * Fixture sintética com a mesma estrutura do export real do Eproc
 * (linhas de metadado + linha de cabeçalho + linhas de dado), mas com
 * conteúdo fictício e anônimo — repositório é público e o XLS real do
 * órgão não pode ser versionado. As contagens (188 sistema + 177
 * não-sistema = 365 totais) reproduzem o shape para o qual o parser
 * foi calibrado, mantendo as asserções dos testes ancoradas em
 * quantidades realistas.
 *
 * O caso de emoji ZWJ ("Habilitar Perito") é incluído deliberadamente
 * porque exercita o caminho de decodificação de entidades multi-código,
 * que era a razão original da fixture.
 */
function buildFixture(): Uint8Array {
  const linhas: unknown[][] = [
    ['Localizadores do Órgão', '', '', '', '', ''],
    ['Data geração:', '01/05/2026', '', '', '', ''],
    ['Total Listados:', 365, '', '', '', ''],
    [
      'Localizador',
      'Nome do Localizador',
      'Descrição',
      'Localizador Sistema',
      'Data inclusão',
      'Total',
    ],
  ];

  // 188 linhas Sistema=Sim. A primeira é a "ISENTO DE CUSTAS INICIAIS"
  // que o teste verifica explicitamente como filtrada.
  linhas.push([
    'ISENTO DE CUSTAS INICIAIS POR DECISÃO',
    '',
    'Sistema padrão',
    'Sim',
    '01/01/2020',
    0,
  ]);
  for (let i = 0; i < 187; i += 1) {
    linhas.push([`Sistema padrão ${i + 1}`, '', '', 'Sim', '01/01/2020', 0]);
  }

  // 177 linhas Sistema=Não. Primeiro o caso de emoji ZWJ.
  linhas.push([
    '&#128105;&#127997;&#8205;&#128300; Habilitar Perito',
    '',
    '',
    'Não',
    '01/01/2020',
    0,
  ]);
  // Pelo menos 11 com descrição preenchida — folga para 20.
  for (let i = 0; i < 20; i += 1) {
    linhas.push([
      `Localizador descrito ${i + 1}`,
      '',
      `Descrição do localizador ${i + 1}`,
      'Não',
      '01/01/2020',
      0,
    ]);
  }
  // Restantes (177 - 1 - 20 = 156) sem descrição.
  for (let i = 0; i < 156; i += 1) {
    linhas.push([`Localizador ${i + 1}`, '', '', 'Não', '01/01/2020', 0]);
  }

  const ws = XLSX.utils.aoa_to_sheet(linhas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Localizadores');
  // bookType: 'xls' espelha o formato do export do Eproc; type: 'array'
  // pode retornar ArrayBuffer ou Uint8Array dependendo da versão — Uint8Array
  // aceita as duas formas como entrada.
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xls' });
  return new Uint8Array(buf);
}

const FIXTURE = buildFixture();

function carregarFixture(): Uint8Array {
  return FIXTURE;
}

describe('parseLocalizadoresXls — fixture sintética com estrutura do Eproc', () => {
  it('lê o XLS e retorna catálogo na versão atual', () => {
    const { catalogo, stats } = parseLocalizadoresXls(carregarFixture());

    expect(catalogo.version).toBe(CATALOGO_ORGAO_VERSION);
    expect(catalogo.importadoEm).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(stats.totalLinhas).toBe(365);
  });

  it('filtra Localizador Sistema = Sim (188 no fixture; 177 não-sistema entram)', () => {
    const { catalogo, stats } = parseLocalizadoresXls(carregarFixture());

    expect(stats.ignoradosSistema).toBe(188);
    expect(catalogo.itens).toHaveLength(177);
    expect(stats.importados).toBe(177);
  });

  it('decodifica emojis no nome (ZWJ multi-código)', () => {
    const { catalogo } = parseLocalizadoresXls(carregarFixture());

    // "Habilitar Perito" no XLS é "&#128105;&#127997;&#8205;&#128300; Habilitar Perito"
    const item = catalogo.itens.find((i) => i.nome.includes('Habilitar Perito'));
    expect(item).toBeDefined();
    expect(item!.nome.startsWith('\u{1F469}\u{1F3FD}\u{200D}\u{1F52C}')).toBe(true);
    // Como segurança extra: nenhum item deveria ter entidades remanescentes.
    for (const it of catalogo.itens) {
      expect(it.nome).not.toMatch(/&#\d+;/);
      if (it.descricao) expect(it.descricao).not.toMatch(/&#\d+;/);
    }
  });

  it('decodifica entidades também na descrição', () => {
    const { catalogo } = parseLocalizadoresXls(carregarFixture());
    // Pelo menos um item não-sistema tem descrição preenchida.
    const comDesc = catalogo.itens.filter((i) => i.descricao && i.descricao.length > 0);
    expect(comDesc.length).toBeGreaterThan(10);
  });

  it('exclui itens cujo Localizador Sistema = Sim', () => {
    const { catalogo } = parseLocalizadoresXls(carregarFixture());
    // "ISENTO DE CUSTAS INICIAIS …" no fixture é Sistema=Sim → não pode entrar.
    const sistemaConhecido = catalogo.itens.find((i) =>
      i.nome.toLowerCase().includes('isento de custas iniciais'),
    );
    expect(sistemaConhecido).toBeUndefined();
  });

  it('cada item ganha id único', () => {
    const { catalogo } = parseLocalizadoresXls(carregarFixture());
    const ids = new Set(catalogo.itens.map((i) => i.id));
    expect(ids.size).toBe(catalogo.itens.length);
    for (const it of catalogo.itens) expect(it.id).toMatch(/^lo-/);
  });

  it('nomes não têm whitespace duplicado nem bordas em branco', () => {
    const { catalogo } = parseLocalizadoresXls(carregarFixture());
    for (const it of catalogo.itens) {
      expect(it.nome).toBe(it.nome.trim());
      expect(it.nome).not.toMatch(/\s{2,}/);
    }
  });
});

describe('parseLocalizadoresXls — erros', () => {
  it('lança XlsParseError em buffer não-XLS', () => {
    const lixo = new TextEncoder().encode('isto não é um XLS');
    expect(() => parseLocalizadoresXls(lixo)).toThrow(XlsParseError);
  });
});
