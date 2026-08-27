import { separarSiglaNome } from './nomeLocalizador';

/**
 * Parser do `<select id="selLocalizador">` da tela "Lista de Processos por
 * Localizador".
 *
 * É a única fonte que traz o **id do Eproc** (29–30 dígitos, em `option.value`).
 * Em compensação lista mais coisas do que a unidade tem — 431 opções contra 179
 * localizadores do órgão —, então ela entra como enriquecimento, nunca como a
 * lista principal.
 *
 * Emojis chegam como entidades numéricas (`&#128424;`); o `DOMParser` já as
 * decodifica no `textContent`, então não é preciso `decodeHtmlEntities` aqui —
 * ele continua necessário no parser do XLS, que lê texto cru de planilha.
 */
export interface OpcaoLocalizador {
  eprocId: string;
  sigla: string;
  nome: string;
}

export function parseSelectLocalizadores(fragmento: string): OpcaoLocalizador[] {
  const doc = new DOMParser().parseFromString(fragmento, 'text/html');
  const select =
    doc.querySelector('#selLocalizador') ?? doc.querySelector('select');
  if (!select) return [];

  const itens: OpcaoLocalizador[] = [];
  const vistos = new Set<string>();

  for (const opt of Array.from(select.querySelectorAll('option'))) {
    const eprocId = opt.getAttribute('value')?.trim() ?? '';
    const rotulo = (opt.textContent ?? '').trim();
    // Opções de moldura ("Selecione…") não têm value numérico.
    if (!eprocId || !/^\d+$/.test(eprocId) || !rotulo) continue;
    if (vistos.has(eprocId)) continue;
    vistos.add(eprocId);

    const { sigla, nome } = separarSiglaNome(rotulo);
    itens.push({ eprocId, sigla, nome });
  }

  return itens;
}
