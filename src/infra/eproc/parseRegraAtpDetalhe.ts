import {
  COMPORTAMENTOS_ORIGEM,
  FILTROS_DEF,
  TIPOS_DATA_CONTROLE,
  acaoProgramadaDef,
  type AcaoProgramada,
  type AtpFiltros,
  type AtpRule,
  type AtpTrigger,
  type CampoDef,
  type ComportamentoOrigem,
  type FiltroDef,
  type Parametros,
  type TipoDataControle,
  type ValorCampo,
} from '@/domain';
import { atributosInfraDto, lerPhpSerializado, type ValorPhp } from './phpSerializado';

/**
 * Parser do formulário "Editar Regra N" (`automatizar_localizadores_alterar`),
 * já recortado pelo coletor (decisoes.md#D-46).
 *
 * O coletor devolve só os controles, em três blocos: `#formulario` (o
 * formulário da regra), `#filtrosEscolhidos` (o filtro "Evento/Tipo de
 * Petição", que a tela monta por script) e `#dadosGatilho` (a resposta do XHR
 * `montarDadosGatilho`). Dos `<select>` sobra só a opção selecionada.
 *
 * O resultado é a `AtpRule` do plano **sem** as pontas: origem e destino vêm da
 * listagem, que os traz por nome, e só quem monta o recurso sabe qual deles é a
 * ponta da aresta (D-42).
 *
 * Fica de fora, por ora: os filtros em lista de partes ("Representante",
 * "Pessoa") e o classificador de conteúdo. Os parâmetros de ação que o
 * descritor não conhece são descartados, como manda o D-27.
 */
export interface DetalheRegraEproc {
  numero: number;
  regra: AtpRule;
  /** `hdnIdLocalizadorRemove`: `M` várias origens, `N` nenhuma, `T` todos, ou o id. */
  origemModo?: string;
}

export function parseRegraAtpDetalhe(fragmento: string): DetalheRegraEproc {
  const doc = new DOMParser().parseFromString(fragmento, 'text/html');
  const form = doc.querySelector('#formulario') ?? doc.body;
  const gatilho = doc.querySelector('#dadosGatilho') ?? doc.body;
  const escolhidos = doc.querySelector('#filtrosEscolhidos');

  const numero = Number(valorDe(form, 'hdnNumRegra'));
  if (!Number.isInteger(numero) || numero <= 0) {
    throw new Error('O formulário da regra veio sem o número (hdnNumRegra).');
  }

  const origemModo = valorDe(form, 'hdnIdLocalizadorRemove') || undefined;
  const comportamento = selecionado(form, 'selOpcaoLocalizadorDesativacao');
  const opcao = selecionado(form, 'selOpcaoMultiplosLocalizadores');
  const trigger = lerGatilho(selecionado(form, 'selTipoControle'), gatilho);
  const acoes = lerAcoes(form);
  const filtros = lerFiltros(form, escolhidos);

  const regra: AtpRule = {
    implantar: false,
    ...(COMPORTAMENTOS_ORIGEM.some((c) => c.value === comportamento)
      ? { comportamentoOrigem: comportamento as ComportamentoOrigem }
      : {}),
    ...(origemModo === 'M' && (opcao === 'OR' || opcao === 'AND')
      ? { opcaoMultiplosLocalizadores: opcao }
      : {}),
    ...(trigger ? { trigger } : {}),
    ...(acoes.length ? { acoes } : {}),
    ...(Object.keys(filtros).length ? { filtros } : {}),
  };
  return { numero, regra, ...(origemModo ? { origemModo } : {}) };
}

/* ---------------- leitura de controles ---------------- */

function controle(raiz: ParentNode, id: string): Element | null {
  return raiz.querySelector(`[id="${id}"]`);
}

function valorDe(raiz: ParentNode, id: string): string {
  const el = controle(raiz, id);
  if (!el) return '';
  if (el.tagName === 'TEXTAREA') return (el.textContent ?? '').trim();
  return (el.getAttribute('value') ?? '').trim();
}

function marcado(raiz: ParentNode, id: string): boolean {
  return controle(raiz, id)?.hasAttribute('checked') ?? false;
}

/** Opções selecionadas, sem o "null" que o Eproc usa como "nada". */
function opcoes(raiz: ParentNode, id: string): { value: string; label: string }[] {
  const el = controle(raiz, id);
  if (!el) return [];
  return Array.from(el.querySelectorAll('option'))
    .filter((o) => o.hasAttribute('selected'))
    .map((o) => ({ value: o.getAttribute('value') ?? '', label: (o.textContent ?? '').trim() }))
    .filter((o) => o.value !== '' && o.value !== 'null');
}

function selecionado(raiz: ParentNode, id: string): string {
  return opcoes(raiz, id)[0]?.value ?? '';
}

/**
 * Os filtros multi de listas grandes vêm com o `<select>` vazio e as opções em
 * `input#valueOptions<Campo>`, já reduzidas às selecionadas pelo coletor.
 */
function opcoesDeValueOptions(raiz: ParentNode, id: string): { value: string; label: string }[] {
  const input = controle(raiz, `valueOptions${id.replace(/^sel/, '')}`);
  const html = input?.getAttribute('value');
  if (!html) return [];
  const doc = new DOMParser().parseFromString(`<select multiple>${html}</select>`, 'text/html');
  return Array.from(doc.querySelectorAll('option'))
    .filter((o) => o.hasAttribute('selected'))
    .map((o) => ({ value: o.getAttribute('value') ?? '', label: (o.textContent ?? '').trim() }));
}

/** "dd/mm/aaaa" → "aaaa-mm-dd"; outro formato passa como veio. */
function dataIso(texto: string): string {
  const m = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : texto;
}

/** O Eproc escreve "sigla - nome" nas opções de localizador; o plano guarda a sigla. */
function sigla(rotulo: string): string {
  const metade = rotulo.split(' - ');
  if (metade.length % 2 === 0) {
    const meio = metade.length / 2;
    const esq = metade.slice(0, meio).join(' - ');
    if (esq === metade.slice(meio).join(' - ')) return esq;
  }
  return rotulo;
}

/* ---------------- gatilho ---------------- */

function lerGatilho(tipo: string, g: ParentNode): AtpTrigger | undefined {
  const valores = (id: string) => opcoes(g, id).map((o) => o.value);
  const restricao = () => {
    const restringirA = selecionado(g, 'selSinPoloPeticao');
    const entidade = valorDe(g, 'txtNomeEntidadePeticao');
    return {
      ...(restringirA ? { restringirA } : {}),
      ...(restringirA === 'S' && entidade ? { entidade } : {}),
    };
  };
  const lista = (chave: string, v: string[]) => (v.length ? { [chave]: v } : {});
  const dias = () => {
    const n = Number(valorDe(g, 'txtDiasControle'));
    return Number.isFinite(n) && n > 0 ? { dias: n } : {};
  };

  switch (tipo) {
    case 'A':
      return {
        tipo,
        ...lista('eventoIds', valores('selControleEventoMultiplo')),
        ...lista('peticaoTipoIds', valores('selControlePeticaoMultiplo')),
        ...lista('documentos', valores('selControleDocumentoMultiplo')),
        ...restricao(),
      };
    case 'E':
      return { tipo, ...lista('eventoIds', valores('selControleEventoMultiplo')) };
    case 'P':
      return { tipo, ...lista('peticaoTipoIds', valores('selControlePeticaoMultiplo')), ...restricao() };
    case 'O': {
      // O campo do plano é texto: guarda o nome, não o código.
      const doc = Array.from(g.querySelectorAll('select[id*="Documento"] option[selected]'))[0];
      const documento = doc?.textContent?.trim();
      return { tipo, ...(documento ? { documento } : {}) };
    }
    case 'D': {
      const tipoData = selecionado(g, 'selTipoDataControle');
      const data = valorDe(g, 'txtDataControle');
      const diaMes = Number(valorDe(g, 'txtDiaMesDataControle'));
      const diaSemana = selecionado(g, 'selDiaSemanaDataControle');
      return {
        tipo,
        ...(TIPOS_DATA_CONTROLE.some((t) => t.value === tipoData)
          ? { tipoData: tipoData as TipoDataControle }
          : {}),
        ...(tipoData === 'D' && data ? { data: dataIso(data) } : {}),
        ...(tipoData === 'M' && diaMes > 0 ? { diaMes } : {}),
        ...(tipoData === 'S' && diaSemana ? { diaSemana } : {}),
      };
    }
    case 'L':
      return { tipo, ...dias(), ...(marcado(g, 'chkDiasControleUteis') ? { diasUteis: true } : {}) };
    case 'S': {
      const statusId = Array.from(g.querySelectorAll('select'))
        .map((s) => opcoes(g, s.id)[0]?.value)
        .find(Boolean);
      return {
        tipo,
        ...(statusId ? { statusId } : {}),
        ...dias(),
        ...(marcado(g, 'chkDiasControleUteis') ? { diasUteis: true } : {}),
      };
    }
    case 'V':
      return { tipo, ...dias() };
    case 'M': {
      const descricao = valorDe(g, 'txtDesRegra');
      return {
        tipo,
        ...(descricao ? { descricao } : {}),
        ...(marcado(g, 'chkAcaoPreferencial') ? { acaoPreferencialNaCapa: true } : {}),
        ...(marcado(g, 'chkSinExecucaoUmClique') ? { umClique: true } : {}),
      };
    }
    default:
      return undefined;
  }
}

/* ---------------- ações programadas ---------------- */

/**
 * Cada ação vem inteira em `hdnATP_n` ("DESCRIÇÃO|base64"), um `InfraDTO`
 * serializado pelo PHP. Os campos visíveis da tela mostram só a primeira, por
 * isso o serializado é a fonte.
 */
function lerAcoes(form: ParentNode): AcaoProgramada[] {
  if (!marcado(form, 'chkLancarAcaoProgramada')) return [];
  const hidden = Array.from(form.querySelectorAll('input[id^="hdnATP_"]'))
    .map((el) => ({ n: Number(el.id.slice('hdnATP_'.length)), valor: el.getAttribute('value') ?? '' }))
    .filter((h) => Number.isInteger(h.n) && h.valor.includes('|'))
    .sort((a, b) => a.n - b.n);

  return hidden.map(({ n, valor }) => {
    const base64 = valor.slice(valor.indexOf('|') + 1);
    const attrs = atributosInfraDto(lerPhpSerializado(atob(base64)));
    const tipo = textoPhp(attrs.CodTipoAcaoProgramada);
    const descricao = textoPhp(attrs.DescricaoAcaoProgramada);
    const localizadorErro = textoPhp(attrs.SigLocalizador);
    const parametros = parametrosDaAcao(tipo, attrs.DadosPreferenciaAcaoProgramada);
    return {
      id: `eproc-${n}`,
      ...(tipo ? { tipo } : {}),
      ...(hidden.length > 1 && descricao ? { descricao } : {}),
      ...(Object.keys(parametros).length ? { parametros } : {}),
      ...(localizadorErro ? { localizadorErro } : {}),
    };
  });
}

/** Texto do PHP: Latin-1 byte a byte, com o que não cabe nele em entidade HTML. */
function textoPhp(v: ValorPhp | undefined): string {
  if (typeof v === 'number') return String(v);
  if (typeof v !== 'string') return '';
  return decodificarEntidades(v).trim();
}

function decodificarEntidades(s: string): string {
  if (!s.includes('&')) return s;
  const doc = new DOMParser().parseFromString(`<p>${s.replace(/</g, '&lt;')}</p>`, 'text/html');
  return doc.body.textContent ?? s;
}

/**
 * O plano guarda o órgão do lembrete pelo rótulo, porque o campo aceita órgão
 * da comarca digitado; o serializado traz o código das três opções gerais.
 */
const ORGAO_LEMBRETE: Record<string, string> = {
  T: 'Todos os órgãos',
  P: 'Órgão julgador do processo',
  R: 'Órgão da regra',
};

function parametrosDaAcao(tipo: string, dados: ValorPhp | undefined): Parametros {
  const def = acaoProgramadaDef(tipo);
  if (!def || !dados || typeof dados !== 'object') return {};
  const saida: Parametros = {};
  for (const campo of def.campos) {
    const bruto = dados[campo.chave];
    if (bruto === undefined || bruto === null || campo.tipo === 'lista') continue;
    const texto = textoPhp(bruto);
    const rotulo = campo.chave === 'OrgaoDestinoLembrete' ? ORGAO_LEMBRETE[texto] : undefined;
    const valor = converter(campo, texto, rotulo);
    if (valor !== undefined) saida[campo.chave] = valor;
  }
  return saida;
}

/** Valor em texto do Eproc → valor do campo do plano, conforme o descritor. */
function converter(campo: CampoDef, texto: string, rotulo?: string): ValorCampo | undefined {
  if (texto === '' || texto === 'null') return undefined;
  switch (campo.tipo) {
    case 'simNao':
      return texto === 'S' ? true : texto === 'N' ? false : undefined;
    case 'numero': {
      const n = Number(texto.replace(',', '.'));
      return Number.isFinite(n) ? n : undefined;
    }
    case 'data':
      return dataIso(texto);
    case 'multi':
      return texto.split(',').map((t) => t.trim()).filter(Boolean);
    case 'texto': {
      // Campo de texto com opções guarda o rótulo (ex.: "Todos os órgãos").
      const opcao = campo.opcoes?.find((o) => o.value === texto || o.label === rotulo);
      return opcao ? opcao.label : (rotulo ?? texto);
    }
    default:
      return texto;
  }
}

/* ---------------- filtros opcionais ---------------- */

function lerFiltros(form: ParentNode, escolhidos: Element | null): AtpFiltros {
  const filtros: AtpFiltros = {};
  for (const def of FILTROS_DEF) {
    const params = def.chave === 'selectTipoControle'
      ? filtroEventoPeticao(escolhidos)
      : filtroSimples(form, def);
    if (Object.keys(params).length) filtros[def.chave] = params;
  }
  return filtros;
}

function filtroSimples(form: ParentNode, def: FiltroDef): Parametros {
  const saida: Parametros = {};
  for (const campo of def.campos) {
    if (campo.tipo === 'lista') continue;
    const valor = valorDoCampo(form, campo);
    if (valor !== undefined) saida[campo.chave] = valor;
  }
  return saida;
}

function valorDoCampo(form: ParentNode, campo: CampoDef): ValorCampo | undefined {
  const el = controle(form, campo.chave);
  if (campo.tipo === 'multi') {
    let ops = opcoes(form, campo.chave);
    if (ops.length === 0) ops = opcoesDeValueOptions(form, campo.chave);
    if (ops.length === 0) return undefined;
    // Localizador e texto livre guardam nome; catálogo guarda código.
    return campo.sugestao === 'localizador'
      ? ops.map((o) => sigla(o.label))
      : campo.livre
        ? ops.map((o) => o.label)
        : ops.map((o) => o.value);
  }
  if (!el) {
    // Rádio: os itens têm id próprio e o nome do campo.
    const radio = form.querySelector(`input[name="${campo.chave}"][checked]`);
    return radio ? converter(campo, radio.getAttribute('value') ?? '') : undefined;
  }
  if (el.tagName === 'SELECT') {
    const op = opcoes(form, campo.chave)[0];
    return op ? converter(campo, op.value, op.label) : undefined;
  }
  if (el.getAttribute('type') === 'checkbox') {
    return el.hasAttribute('checked') ? true : undefined;
  }
  return converter(campo, valorDe(form, campo.chave));
}

/**
 * O filtro "Evento/Tipo de Petição": a tela guarda cada condição em inputs
 * ocultos com nome de array (`hdnSelectTipoPrefixo[]`…), uma posição por
 * condição.
 */
function filtroEventoPeticao(escolhidos: Element | null): Parametros {
  if (!escolhidos) return {};
  const col = (nome: string) =>
    Array.from(escolhidos.querySelectorAll(`input[name="${nome}[]"]`)).map(
      (el) => el.getAttribute('value') ?? '',
    );
  const tipos = col('hdnSelectTipoControle');
  if (tipos.length === 0) return {};
  const conectores = col('hdnSelectConector');
  const prefixos = col('hdnSelectTipoPrefixo');
  const valores = col('hdnStrSelFiltroControleValor');
  const polos = col('hdnStrSelFiltroContenhaEventoPolo');
  const entidades = col('hdnStrSelFiltroContenhaEventoEntidade');
  const complementos = col('hdnStrComplementoEventoFiltro');
  const ultimos = col('hdnNumConsiderarUltimosEventos').find(Boolean);
  const ultimosDias = col('hdnNumConsiderarUltimosEventosDias').find(Boolean);

  const condicoes = tipos.map((tipo, i) => {
    const lista = (valores[i] ?? '').split(',').map((v) => v.trim()).filter(Boolean);
    const item: Record<string, string | string[]> = { selectTipoControle: tipo };
    if (i > 0 && conectores[i]) item.selectConector = conectores[i] as string;
    if (prefixos[i]) item.selectTipoPrefixo = prefixos[i] as string;
    if (tipo === 'E' && lista.length) item.selEventoFiltroMultiplo = lista;
    if (tipo === 'P' && lista.length) item.selTipoPeticaoFiltroMultiplo = lista;
    if (tipo === 'G' && lista[0]) item.selectGrupoEventoTipoPeticaoFiltro = lista[0];
    if (tipo === 'C' && complementos[i]) item.txtComplementoEventoFiltro = complementos[i] as string;
    if (tipo !== 'C' && polos[i]) item.selSinPoloFiltroContenhaEvento = polos[i] as string;
    if (polos[i] === 'S' && entidades[i]) {
      item.txtNomeEntidadeFiltroContenhaEvento = entidades[i] as string;
    }
    return item;
  });

  return {
    condicoes,
    ...(Number(ultimos) > 0 ? { txtConsiderarUltimosEventosFiltro: Number(ultimos) } : {}),
    ...(Number(ultimosDias) > 0 ? { txtConsiderarUltimosDiasFiltro: Number(ultimosDias) } : {}),
  };
}
