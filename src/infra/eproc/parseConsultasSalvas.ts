import { TELAS_CONSULTA, type ConsultaSalvaUnidade, type TelaConsulta } from '@/domain';
import { linhasDaLista, parsePreferenciasXml, textoDaLista } from './parsePreferencias';

/**
 * Parser das consultas salvas nas telas de relatório (decisoes.md#D-32).
 *
 * O caminho atual é a lista do componente novo (`data_table_listar_v2`,
 * decisoes.md#D-37): JSON `{ data: [...] }` para as quatro telas, com o grupo.
 * Os dois formatos de antes ficam como reserva do coletor:
 *
 *  - **Lista de Processos por Localizador, Área de Minutas, Sem Movimentação**:
 *    o mesmo autocompletar das preferências (`preferencia_auto_completar`), com
 *    `nomeAcao` igual à ação da tela. XML `<item id descricao complemento/>`.
 *  - **Relatório Geral**: componente novo, `ui_preferencias/listar`, que devolve
 *    JSON `[{ Descricao, IdFormularioPersonalizacao, SinPreferenciaIndividual }]`.
 *
 * A tela de cada fragmento vem em `rotulos` (a chave de `TELAS_CONSULTA`), como
 * o tipo das preferências: não está na resposta, só na pergunta.
 */

export function ehTelaConsulta(rotulo: string | undefined): rotulo is TelaConsulta {
  return !!rotulo && rotulo in TELAS_CONSULTA;
}

export function parseConsultasJson(json: string, tela: TelaConsulta): ConsultaSalvaUnidade[] {
  const saida: ConsultaSalvaUnidade[] = [];
  for (const linha of linhasDaLista(json)) {
    const nome = textoDaLista(linha.Descricao);
    if (!nome) continue;
    const id = textoDaLista(linha.IdFormularioPersonalizacao);
    const sin = textoDaLista(linha.SinPreferenciaIndividual).toUpperCase();
    const grupo = textoDaLista(linha.DescricaoGrupoFormularioPersonalizacaoGrupo);
    saida.push({
      tela,
      nome,
      ...(id ? { eprocId: id } : {}),
      ...(sin === 'S' || sin === 'N' ? { individual: sin === 'S' } : {}),
      ...(grupo ? { grupo } : {}),
    });
  }
  return saida;
}

export function parseConsultasXml(xml: string, tela: TelaConsulta): ConsultaSalvaUnidade[] {
  return parsePreferenciasXml(xml, tela).map((item) => ({
    tela,
    nome: item.nome,
    ...(item.eprocId ? { eprocId: item.eprocId } : {}),
  }));
}

/**
 * Junta os fragmentos das quatro telas. JSON ou XML é decidido pelo primeiro
 * caractere — cada tela só fala um dos dois, mas assim uma mudança de geração
 * do componente no Eproc não quebra o parser. Dedupe por tela + nome.
 */
export function montarConsultasSalvas(
  fragmentos: readonly string[],
  rotulos: readonly (string | undefined)[],
): ConsultaSalvaUnidade[] {
  const vistos = new Set<string>();
  const saida: ConsultaSalvaUnidade[] = [];
  fragmentos.forEach((frag, i) => {
    const tela = rotulos[i];
    if (!ehTelaConsulta(tela)) return;
    const inicio = frag.trimStart()[0];
    const itens =
      inicio === '[' || inicio === '{' ? parseConsultasJson(frag, tela) : parseConsultasXml(frag, tela);
    for (const c of itens) {
      const chave = `${c.tela}|${c.nome.toUpperCase()}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      saida.push(c);
    }
  });
  return saida;
}
