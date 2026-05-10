import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CATALOGO_ORGAO_VERSION } from '@/domain';
import { XlsParseError, parseLocalizadoresXls } from './parseLocalizadoresXls';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(
  HERE,
  '../../../outros_arquivos/LocalizadoresOrgao-2026-5-10-4-49-24.xls',
);

function carregarFixture(): Uint8Array {
  const buf = readFileSync(FIXTURE);
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

describe('parseLocalizadoresXls — fixture real do Eproc', () => {
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
