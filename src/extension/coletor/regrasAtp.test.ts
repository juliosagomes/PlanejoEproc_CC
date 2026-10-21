import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LISTA from '@/infra/eproc/__fixtures__/automatizarLocalizadores.html?raw';
import { montarRegrasAtp } from '@/infra/eproc/aplicarRegrasAtp';
import { parseRegraAtpDetalhe } from '@/infra/eproc/parseRegraAtpDetalhe';
import { coletarRegrasAtpNaAba } from './regrasAtp';

/* Mesma armadilha do `eproc.test.ts`: o coletor é re-avaliado fora do módulo. */
function reavaliarIsolada<T>(fn: T): T {
  // eslint-disable-next-line no-new-func
  return new Function(`"use strict"; return (${String(fn)});`)() as T;
}

function corpoLatin1(texto: string): ArrayBuffer {
  const bytes = new Uint8Array(texto.length);
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto.charCodeAt(i);
    bytes[i] = c > 0xff ? 0x3f : c;
  }
  return bytes.buffer;
}

function resposta(html: string): Response {
  return { ok: true, status: 200, arrayBuffer: () => Promise.resolve(corpoLatin1(html)) } as unknown as Response;
}

const MENU = `<a href="controlador.php?acao=automatizar_localizadores&hash=abc">Automatizar</a>`;

/** Formulário sintético, no formato levantado em 21/10/2026. */
const formulario = (numero: string) => `<html><body>
  <form id="frmAssociaEventoLocalizador">
    <input type="hidden" id="hdnNumRegra" name="hdnNumRegra" value="${numero}">
    <input type="hidden" id="hdnIdControleLocalizadorSistema" value="ID${numero}">
    <select id="selTipoControle"><option value="D">Por Data</option><option value="E" selected>Por Evento</option></select>
    <select id="selAssinante"><option value="1">Fulana de Tal</option></select>
  </form>
  <script>
    $.ajax({ url: 'controlador.php?acao=automatizacao/montarDadosGatilho&hash=999' });
    if('S' == 'S'){ $('#divFiltroOpcionaisEscolhidos').append('<input type="hidden" name="hdnSelectTipoControle[]" value="P"><input type="hidden" name="hdnSelectTipoPrefixo[]" value="NOT IN"><input type="hidden" name="hdnStrSelFiltroControleValor[]" value="35,80">'); }
  </script></body></html>`;

let posts: string[] = [];

beforeEach(() => {
  document.body.innerHTML = MENU;
  posts = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((entrada: string, init?: RequestInit) => {
      const url = String(entrada);
      if (url.includes('montarDadosGatilho')) {
        posts.push(String(init?.body));
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              html: '<select id="selControleEventoMultiplo" multiple><option value="20008" selected>Distribuído</option><option value="1">Outro</option></select>',
            }),
        } as unknown as Response);
      }
      const n = url.match(/id_controle_localizador_sistema=(\d+)/)?.[1];
      if (url.includes('automatizar_localizadores_alterar')) {
        const linha = n === '11769707789881704637367937099' ? '1' : '999';
        return Promise.resolve(resposta(formulario(linha)));
      }
      if (url.includes('acao=automatizar_localizadores')) {
        return Promise.resolve(resposta(`<html><body>${LISTA}</body></html>`));
      }
      return Promise.resolve(resposta('<html><body>tela desconhecida</body></html>'));
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('coletor das regras de ATP (D-46)', () => {
  it('sobrevive à re-avaliação fora do módulo e traz só a lista quando não se pede detalhe', async () => {
    const coleta = await reavaliarIsolada(coletarRegrasAtpNaAba)([]);
    expect(coleta.lista.status).toBe('ok');
    expect(coleta.detalhes).toEqual({});
    expect(posts).toEqual([]);
    const m = montarRegrasAtp(coleta.lista, coleta.detalhes, coleta.falhas, undefined, 'agora');
    expect(m.regras).toHaveLength(13);
  });

  it('a lista devolvida não carrega hash nem tooltip', async () => {
    const coleta = await coletarRegrasAtpNaAba([]);
    const html = coleta.lista.fragmentos[0] ?? '';
    expect(html).not.toMatch(/hash=/);
    expect(html).not.toMatch(/onmouseover/i);
  });

  it('traz o formulário de uma regra pedida, com o gatilho do XHR, e só o que está escolhido', async () => {
    const coleta = await coletarRegrasAtpNaAba([1, 4242]);
    expect(Object.keys(coleta.detalhes)).toEqual(['1']);
    expect(coleta.falhas['4242']).toMatch(/não encontrada/);
    expect(posts).toEqual(['codTipo=E&idRegra=ID1']);

    const fragmento = coleta.detalhes['1'] ?? '';
    // Opção não escolhida não sai da página: pode ser nome de servidor.
    expect(fragmento).not.toContain('Fulana');
    expect(fragmento).not.toContain('Outro');

    const { numero, regra } = parseRegraAtpDetalhe(fragmento);
    expect(numero).toBe(1);
    expect(regra.trigger).toEqual({ tipo: 'E', eventoIds: ['20008'] });
    expect(regra.filtros?.selectTipoControle?.condicoes).toEqual([
      { selectTipoControle: 'P', selectTipoPrefixo: 'NOT IN', selTipoPeticaoFiltroMultiplo: ['35', '80'] },
    ]);
  });

  it('o detalhe que não veio agora fica o de antes', async () => {
    const coleta = await coletarRegrasAtpNaAba([1]);
    const antes = montarRegrasAtp(coleta.lista, coleta.detalhes, coleta.falhas, undefined, 't1');
    const soLista = await coletarRegrasAtpNaAba([]);
    const depois = montarRegrasAtp(soLista.lista, soLista.detalhes, soLista.falhas, antes.regras, 't2');
    const r1 = depois.regras.find((r) => r.numero === 1);
    expect(r1?.detalhe?.trigger).toEqual({ tipo: 'E', eventoIds: ['20008'] });
    expect(r1?.detalheEm).toBe('t1');
    expect(depois.detalhadas).toBe(0);
  });

  it('perfil sem a tela de ATP vira "semPermissao", sem exceção', async () => {
    document.body.innerHTML = '<a href="controlador.php?acao=outra">x</a>';
    const coleta = await coletarRegrasAtpNaAba([]);
    expect(coleta.lista.status).toBe('semPermissao');
  });
});
