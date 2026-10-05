import type { ItemCatalogoUnidade } from '@/domain';
import { decodeHtmlEntities } from '@/utils/decodeHtmlEntities';

/**
 * Parser das preferências. Dois formatos:
 *
 *  - **JSON da lista do componente novo** (`data_table_listar_v2`, decisoes.md#D-37),
 *    o caminho atual: traz id, grupo e as marcas, e não depende do hash da tela.
 *  - **XML do autocompletar** `preferencia_auto_completar`, o caminho de antes,
 *    que o D-35 viu parar. O parser fica para catálogo e teste antigos.
 *
 * O que segue descreve o XML.
 *
 * **Por que não pela tela de listagem.** Não existe tela que liste preferências
 * avulsas — varri todas as ações do menu e só há variantes `_grupo`, que listam
 * *grupos*. Chegar às preferências por ali exigia consultar grupo a grupo, numa
 * tela que também expõe nome e login dos servidores. O autocompletar devolve
 * tudo em uma requisição por tipo, sem paginação e sem passar perto de dado
 * pessoal de terceiros.
 *
 * São três tipos, e o tipo **não está no XML** — só existe na pergunta
 * (`nomeAcao`). Por isso o coletor manda o rótulo em paralelo:
 *
 *   `minuta_cadastrar`               → Minuta
 *   `processo_movimento_consultar`   → Movimentação
 *   `processo_intimacao_bloco`       → Intimação
 *
 * Resposta: `<itens><item id="…" descricao="…" complemento="…"/>…</itens>`.
 */

/**
 * O `descricao` chega com as entidades **escapadas duas vezes**: o XML traz
 * `&amp;#128309;`, então depois de o parser resolver o `&amp;` sobra o literal
 * `&#128309;`. Daí a mesma `decodeHtmlEntities` do parser de XLS — e não a
 * decodificação nativa do DOMParser, que já fez a parte dela.
 */
function limpar(texto: string): string {
  return decodeHtmlEntities(texto).replace(/\s+/g, ' ').trim();
}

/**
 * O `id` é composto por campos separados por `|`; só o primeiro é o código
 * estável. Os demais carregam estado efêmero que não vale persistir.
 */
function idEstavel(bruto: string): string | undefined {
  const primeiro = bruto.split('|')[0]?.trim();
  return primeiro ? primeiro : undefined;
}

export function parsePreferenciasXml(xml: string, tipo: string): ItemCatalogoUnidade[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  if (doc.querySelector('parsererror')) return [];

  const itens: ItemCatalogoUnidade[] = [];
  for (const item of Array.from(doc.querySelectorAll('item'))) {
    const nome = limpar(item.getAttribute('descricao') ?? '');
    if (!nome) continue;
    const eprocId = idEstavel(item.getAttribute('id') ?? '');
    itens.push({
      nome,
      detalhe: tipo,
      ...(eprocId ? { eprocId } : {}),
    });
  }
  return itens;
}

interface LinhaListaPreferencias {
  Descricao?: unknown;
  SinPreferenciaIndividual?: unknown;
  DescricaoGrupoFormularioPersonalizacaoGrupo?: unknown;
  IdFormularioPersonalizacao?: unknown;
}

/** Linhas do JSON da lista (`{ data: [...] }`); `[]` para qualquer outra coisa. */
export function linhasDaLista(json: string): LinhaListaPreferencias[] {
  let dados: unknown;
  try {
    dados = JSON.parse(json);
  } catch {
    return [];
  }
  const linhas = Array.isArray(dados)
    ? dados
    : typeof dados === 'object' && dados !== null && Array.isArray((dados as { data?: unknown }).data)
      ? (dados as { data: unknown[] }).data
      : [];
  return linhas.filter((l): l is LinhaListaPreferencias => typeof l === 'object' && l !== null);
}

/** Campo de texto da lista: as descrições trazem entidades HTML (`&#128309;`). */
export function textoDaLista(v: unknown): string {
  return typeof v === 'string' ? limpar(v) : typeof v === 'number' ? String(v) : '';
}

/**
 * Preferências da lista do componente novo. A preferência **individual** (a do
 * próprio servidor que sincroniza) fica de fora: o catálogo é da unidade.
 */
export function parsePreferenciasJson(json: string, tipo: string): ItemCatalogoUnidade[] {
  const itens: ItemCatalogoUnidade[] = [];
  for (const linha of linhasDaLista(json)) {
    if (textoDaLista(linha.SinPreferenciaIndividual).toUpperCase() === 'S') continue;
    const nome = textoDaLista(linha.Descricao);
    if (!nome) continue;
    const eprocId = textoDaLista(linha.IdFormularioPersonalizacao);
    const grupo = textoDaLista(linha.DescricaoGrupoFormularioPersonalizacaoGrupo);
    itens.push({
      nome,
      detalhe: tipo,
      ...(eprocId ? { eprocId } : {}),
      ...(grupo ? { grupo } : {}),
    });
  }
  return itens;
}

/** JSON ou XML, pelo primeiro caractere. */
export function parsePreferencias(fragmento: string, tipo: string): ItemCatalogoUnidade[] {
  const inicio = fragmento.trimStart()[0];
  return inicio === '{' || inicio === '['
    ? parsePreferenciasJson(fragmento, tipo)
    : parsePreferenciasXml(fragmento, tipo);
}

/**
 * Junta os três tipos, deduplicando por nome.
 *
 * A dedupe é por **nome**, não por código: a mesma preferência pode aparecer em
 * mais de um tipo, e é o nome que o usuário reconhece no editor. O primeiro tipo
 * a trazê-la ganha o `detalhe`.
 */
export function montarPreferencias(porTipo: ItemCatalogoUnidade[][]): ItemCatalogoUnidade[] {
  const vistos = new Set<string>();
  const saida: ItemCatalogoUnidade[] = [];
  for (const lista of porTipo) {
    for (const item of lista) {
      const chave = item.nome.toUpperCase();
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      saida.push(item);
    }
  }
  return saida;
}
