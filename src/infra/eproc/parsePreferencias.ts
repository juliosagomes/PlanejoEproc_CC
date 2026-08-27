import type { ItemCatalogoUnidade } from '@/domain';
import { decodeHtmlEntities } from '@/utils/decodeHtmlEntities';

/**
 * Parser das preferências, vindas do autocompletar `preferencia_auto_completar`.
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
