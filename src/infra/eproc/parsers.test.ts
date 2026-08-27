import { describe, expect, it } from 'vitest';
// `?raw` em vez de `fs`: é o Vite que resolve o caminho, então o teste não
// depende de qual diretório o vitest considera raiz.
import ESCOPO from './__fixtures__/escopoUnidade.html?raw';
import PREFERENCIAL from './__fixtures__/localizadorAcaoPreferencialListar.html?raw';
import ORGAO from './__fixtures__/localizadorOrgaoListar.html?raw';
import SELECT from './__fixtures__/selLocalizador.html?raw';
import {
  abrirGrade,
  InfraTableError,
  itensDaCelula,
  linhasDiretas,
  totalDeRegistros,
} from './infraTable';
import { montarUnidade } from './escopoUnidade';
import { anexarIds, deduplicar } from './montarCatalogo';
import { semDecoracao, separarSiglaNome } from './nomeLocalizador';
import { ehTelaDeLocalizadores, parseLocalizadorOrgao } from './parseLocalizadorOrgao';
import { parseSelectLocalizadores } from './parseSelectLocalizadores';

/* ------------------------------------------------------------------------ */

describe('semDecoracao', () => {
  it('iguala rótulos que diferem só por emoji', () => {
    expect(semDecoracao('💸ISENTO DE CUSTAS')).toBe(semDecoracao('ISENTO DE CUSTAS'));
  });

  it('iguala rótulos que diferem só por acento e caixa', () => {
    // Sem o descarte de \p{M} depois do NFKD, a cedilha vira espaço e estes dois
    // deixam de casar — foi o que fez `CITACAO` cair no ramo errado no spike.
    expect(semDecoracao('CITACAO DJE NÃO CONFIRMADA')).toBe(
      semDecoracao('Citação DJE Não Confirmada'),
    );
  });

  it('não iguala nomes genuinamente diferentes', () => {
    expect(semDecoracao('AlvEletr60Dias')).not.toBe(
      semDecoracao('Alvarás Eletr. Últimos 60 Dias'),
    );
  });
});

describe('separarSiglaNome', () => {
  it('colapsa metades idênticas', () => {
    const r = separarSiglaNome('📝 Minutar (Secretaria) - 📝 Minutar (Secretaria)');
    expect(r).toEqual({ sigla: '📝 Minutar (Secretaria)', nome: '📝 Minutar (Secretaria)' });
  });

  it('acha a metade certa quando o próprio nome contém " - "', () => {
    // O caso que quebra o corte no primeiro separador: cortar em pos[0] daria
    // sigla="🔵 Conclusos" e nome="Pedido Reconvencional - 🔵 Conclusos - …".
    const r = separarSiglaNome(
      '🔵 Conclusos - Pedido Reconvencional - 🔵 Conclusos - Pedido Reconvencional',
    );
    expect(r.sigla).toBe('🔵 Conclusos - Pedido Reconvencional');
    expect(r.nome).toBe('🔵 Conclusos - Pedido Reconvencional');
  });

  it('colapsa quando só a sigla carrega o emoji', () => {
    const r = separarSiglaNome(
      '💸ISENTO DE CUSTAS INICIAIS – L. 14.939/03 - ISENTO DE CUSTAS INICIAIS – L. 14.939/03',
    );
    expect(r.sigla).toBe('💸ISENTO DE CUSTAS INICIAIS – L. 14.939/03');
    expect(r.nome).toBe('ISENTO DE CUSTAS INICIAIS – L. 14.939/03');
  });

  it('preserva sigla e nome quando são genuinamente distintos', () => {
    const r = separarSiglaNome('AlvEletr60Dias - Alvarás Eletr. Últimos 60 Dias');
    expect(r).toEqual({
      sigla: 'AlvEletr60Dias',
      nome: 'Alvarás Eletr. Últimos 60 Dias',
    });
  });

  it('usa o primeiro separador quando o nome distinto contém " - "', () => {
    const r = separarSiglaNome('📰 CERTDJEN 📰 - CERTIDÃO DE DISTRIBUIÇÃO - DJEN');
    expect(r).toEqual({
      sigla: '📰 CERTDJEN 📰',
      nome: 'CERTIDÃO DE DISTRIBUIÇÃO - DJEN',
    });
  });

  it('aceita rótulo sem separador', () => {
    expect(separarSiglaNome('MIGRADOS PJE')).toEqual({
      sigla: 'MIGRADOS PJE',
      nome: 'MIGRADOS PJE',
    });
  });
});

/* ------------------------------------------------------------------------ */

describe('infraTable', () => {
  it('ignora as tabelas de ordenação aninhadas no cabeçalho', () => {
    // A fixture tem 1 cabeçalho + 7 linhas de dado, e cada <th> carrega uma
    // <table class="infraTableOrdenacao"> com 2 <tr>. Um querySelectorAll('tr')
    // ingênuo devolveria 8 + 12 = 20.
    const doc = new DOMParser().parseFromString(ORGAO, 'text/html');
    const tabela = doc.querySelector('table.infraTable') as HTMLTableElement;
    expect(tabela.querySelectorAll('tr').length).toBeGreaterThan(8);
    expect(linhasDiretas(tabela)).toHaveLength(8);
  });

  it('mapeia colunas por nome mesmo fora de ordem', () => {
    const embaralhado = `
      <table class="infraTable"><tbody>
        <tr><th>Localizador Sistema</th><th>Localizador</th><th>Nome do Localizador</th></tr>
        <tr><td>Não</td><td>SIG</td><td>Nome Longo</td></tr>
      </tbody></table>`;
    const grade = abrirGrade(
      embaralhado,
      { sigla: ['LOCALIZADOR'], sistema: ['LOCALIZADOR SISTEMA'], nome: ['NOME DO LOCALIZADOR'] },
      ['sigla', 'sistema'],
    );
    const linha = grade.linhas[0] as HTMLTableRowElement;
    // O ponto do teste: "LOCALIZADOR SISTEMA" contém "LOCALIZADOR" e vem antes.
    // Sem a passada de casamento exato, `sigla` roubaria a coluna Sistema e o
    // parser gravaria "Não" como nome do localizador, sem erro nenhum.
    expect(grade.celula(linha, 'sigla')).toBe('SIG');
    expect(grade.celula(linha, 'sistema')).toBe('Não');
  });

  it('rejeita tela desviada por falta das colunas esperadas', () => {
    const painel = `
      <table class="infraTable"><tbody>
        <tr><th>Processo</th><th>Últimos eventos</th></tr>
        <tr><td>5001234-00</td><td>Conclusos</td></tr>
      </tbody></table>`;
    expect(() =>
      abrirGrade(painel, { sigla: ['LOCALIZADOR'], sistema: ['LOCALIZADOR SISTEMA'] }, [
        'sigla',
        'sistema',
      ]),
    ).toThrow(InfraTableError);
  });

  it('separa itens de uma célula por <br>', () => {
    const doc = new DOMParser().parseFromString(PREFERENCIAL, 'text/html');
    const tabela = doc.querySelector('table.infraTable') as HTMLTableElement;
    const primeira = linhasDiretas(tabela)[1] as HTMLTableRowElement;
    const acoes = itensDaCelula(primeira.children[3] as Element);
    expect(acoes).toHaveLength(4);
    expect(acoes[0]).toBe('🔵⏯️GAB - Determinar Emenda Inicial');
    // Sem trocar <br> por \n, tudo isso viria colado numa string só.
    expect(acoes[1]).toBe('🔵▶️GAB - Inicial Arquivar');
  });

  it('devolve célula vazia como lista vazia', () => {
    const doc = new DOMParser().parseFromString(PREFERENCIAL, 'text/html');
    const tabela = doc.querySelector('table.infraTable') as HTMLTableElement;
    const semAcoes = linhasDiretas(tabela)[3] as HTMLTableRowElement;
    expect(itensDaCelula(semAcoes.children[3] as Element)).toEqual([]);
  });

  it('lê o total anunciado', () => {
    expect(totalDeRegistros('<p>179 registros</p>')).toBe(179);
    expect(totalDeRegistros('<p>1.974 registros</p>')).toBe(1974);
    expect(totalDeRegistros('<p>sem rodapé</p>')).toBeUndefined();
  });
});

/* ------------------------------------------------------------------------ */

describe('parseSelectLocalizadores', () => {
  it('lê id e decodifica as entidades numéricas de emoji', () => {
    const itens = parseSelectLocalizadores(SELECT);
    expect(itens).toHaveLength(12);
    const primeiro = itens[0];
    expect(primeiro?.eprocId).toBe('11772027734669582002217986416');
    // No HTML isto é "&#128105;&#127997;&#8205;&#128300;".
    expect(primeiro?.nome).toBe('👩🏽‍🔬 Habilitar Perito');
  });
});

describe('parseLocalizadorOrgao', () => {
  it('filtra os localizadores de sistema (D-7)', () => {
    const r = parseLocalizadorOrgao(ORGAO);
    expect(r.ignoradosSistema).toBe(2);
    expect(r.itens).toHaveLength(5);
    expect(r.itens.every((i) => i.sistema === false)).toBe(true);
    expect(r.itens.map((i) => i.sigla)).not.toContain('AlvEletr60Dias');
  });

  it('extrai descrição, data e total de processos', () => {
    const item = parseLocalizadorOrgao(ORGAO).itens[0];
    expect(item?.sigla).toBe('👩🏽‍🔬 Habilitar Perito');
    expect(item?.descricao).toContain('habilitação de perito');
    expect(item?.dataInclusao).toBe('08/04/2026 19:44:17');
    expect(item?.qtdProcessos).toBe(2);
  });

  it('reconhece a tela certa', () => {
    expect(ehTelaDeLocalizadores(ORGAO)).toBe(true);
    expect(ehTelaDeLocalizadores(PREFERENCIAL)).toBe(false);
  });
});

/* ------------------------------------------------------------------------ */

describe('teste cruzado: <select> × listagem do órgão', () => {
  it('reconstrói do rótulo do <select> a mesma sigla e nome que a listagem traz em colunas separadas', () => {
    // Este é o teste que dá valor à regra das metades. A listagem do órgão é a
    // verdade de referência — ela tem sigla e nome em colunas próprias —, e as
    // 7 primeiras opções da fixture do <select> são exatamente os 7 mesmos
    // localizadores, na mesma ordem. Se a regra errar, aqui aparece.
    const grade = abrirGrade(
      ORGAO,
      {
        sigla: ['LOCALIZADOR'],
        nome: ['NOME DO LOCALIZADOR'],
        sistema: ['LOCALIZADOR SISTEMA'],
      },
      ['sigla', 'nome'],
    );
    const verdade = grade.linhas.map((l) => ({
      sigla: grade.celula(l, 'sigla'),
      nome: grade.celula(l, 'nome'),
    }));
    const doSelect = parseSelectLocalizadores(SELECT).slice(0, verdade.length);

    expect(doSelect).toHaveLength(verdade.length);
    doSelect.forEach((opcao, i) => {
      expect({ sigla: opcao.sigla, nome: opcao.nome }).toEqual(verdade[i]);
    });
  });
});

describe('anexarIds', () => {
  it('anexa o id do Eproc casando por sigla canonizada', () => {
    const daListagem = parseLocalizadorOrgao(ORGAO).itens;
    const doSelect = parseSelectLocalizadores(SELECT);
    const { itens, casados } = anexarIds(daListagem, doSelect);

    expect(casados).toBe(daListagem.length);
    expect(itens[0]?.eprocId).toBe('11772027734669582002217986416');
  });

  it('deixa sem id o que o <select> não lista, sem falhar', () => {
    const daListagem = parseLocalizadorOrgao(ORGAO).itens;
    const { itens, casados } = anexarIds(daListagem, []);
    expect(casados).toBe(0);
    expect(itens.every((i) => i.eprocId === undefined)).toBe(true);
    expect(itens).toHaveLength(daListagem.length);
  });
});

describe('deduplicar', () => {
  it('remove repetições por sigla canonizada', () => {
    const r = deduplicar([
      { sigla: '🔵 Conclusos', nome: '🔵 Conclusos', sistema: false },
      { sigla: 'Conclusos', nome: 'Conclusos', sistema: false },
      { sigla: 'Outro', nome: 'Outro', sistema: false },
    ]);
    expect(r.duplicados).toBe(1);
    expect(r.itens).toHaveLength(2);
  });
});

/* ------------------------------------------------------------------------ */

describe('escopoUnidade', () => {
  function bruto() {
    const doc = new DOMParser().parseFromString(ESCOPO, 'text/html');
    const sel = doc.querySelector('#selInfraUnidades') as HTMLSelectElement;
    const opcao = sel.querySelector('option[selected]') as HTMLOptionElement;
    return {
      perfilTexto: doc.querySelector('#nav-profile')?.textContent ?? null,
      unidadeTexto: opcao.textContent,
      unidadeTitle: opcao.getAttribute('title'),
    };
  }

  it('monta a chave host::login::sigla', () => {
    const u = montarUnidade('eproc1g.tjmg.jus.br', bruto());
    expect(u).not.toBeNull();
    expect(u?.login).toBe('x0000000');
    expect(u?.sigla).toBe('ULA 2ª V.FAM.SUC');
    expect(u?.chave).toBe('eproc1g.tjmg.jus.br::x0000000::ULA 2ª V.FAM.SUC');
  });

  it('descarta o papel, para que dois papéis na mesma vara compartilhem catálogo', () => {
    const comum = { perfilTexto: 'FULANO (x1) ', unidadeTitle: null };
    const gerente = montarUnidade('h', {
      ...comum,
      unidadeTexto: 'ULA 2ª V.FAM.SUC/GERENTE DE SECRETARIA',
    });
    const automatizador = montarUnidade('h', {
      ...comum,
      unidadeTexto: 'ULA 2ª V.FAM.SUC/USUÁRIO AUTOMATIZADOR',
    });
    expect(gerente?.chave).toBe(automatizador?.chave);
  });

  it('extrai o nome por extenso removendo o sufixo do title', () => {
    expect(montarUnidade('h', bruto())?.nome).toBe(
      '2ª Vara de Família e Sucessões da Comarca de Uberlândia',
    );
  });

  it('devolve null sem login ou sem sigla', () => {
    expect(
      montarUnidade('h', { perfilTexto: null, unidadeTexto: 'X/Y', unidadeTitle: null }),
    ).toBeNull();
    expect(
      montarUnidade('h', { perfilTexto: 'F (x1)', unidadeTexto: null, unidadeTitle: null }),
    ).toBeNull();
  });
});
