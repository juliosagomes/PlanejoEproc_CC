import { semDecoracao } from '@/infra/eproc/nomeLocalizador';

/**
 * Nós que representam o **mesmo localizador** no canvas — cópias que o usuário
 * cria para não puxar uma seta de um lado a outro do quadro.
 *
 * "Mesmo" é decidido por `semDecoracao`, a régua que o catálogo já usa para
 * deduplicar e anotar (decisoes.md#D-25): `📝 Minutar` e `MINUTAR` são um só.
 * Outra régua aqui faria o app discordar de si mesmo. Nó sem nome não tem
 * gêmeo — dois cartões em branco não são o mesmo localizador.
 */
export interface Gemeos {
  /** Chave canônica de cada nó que tem pelo menos uma cópia. */
  chaveDe: Map<string, string>;
  /** Ids de cada grupo de cópias, por chave. Só grupos com 2 ou mais. */
  grupos: Map<string, string[]>;
}

interface NoComNome {
  id: string;
  data: { nome: string };
}

export function acharGemeos(nodes: readonly NoComNome[]): Gemeos {
  const porChave = new Map<string, string[]>();
  for (const n of nodes) {
    const chave = semDecoracao(n.data.nome);
    if (!chave) continue;
    const ids = porChave.get(chave);
    if (ids) ids.push(n.id);
    else porChave.set(chave, [n.id]);
  }
  const grupos = new Map<string, string[]>();
  const chaveDe = new Map<string, string>();
  for (const [chave, ids] of porChave) {
    if (ids.length < 2) continue;
    grupos.set(chave, ids);
    for (const id of ids) chaveDe.set(id, chave);
  }
  return { chaveDe, grupos };
}
