import type { Editor } from '@tiptap/core';
import type { RefMencao, TipoMencao } from '@/domain';
import { resolver, type CatalogoMencoes } from '../mencoes';

const TIPOS = new Set<string>(['loc', 'pref', 'atp']);

export function refDosAtributos(attrs: Record<string, unknown>): RefMencao | null {
  const tipo = String(attrs.tipo ?? '');
  const chave = String(attrs.chave ?? '');
  if (!TIPOS.has(tipo) || !chave) return null;
  return {
    tipo: tipo as TipoMencao,
    chave,
    rotulo: String(attrs.rotulo ?? chave),
    ...(attrs.eprocId ? { eprocId: String(attrs.eprocId) } : {}),
    ...(attrs.no ? { no: String(attrs.no) } : {}),
  };
}

export function atributosDaRef(ref: RefMencao, nome = ref.rotulo): Record<string, unknown> {
  return { tipo: ref.tipo, chave: ref.chave, rotulo: nome, eprocId: ref.eprocId ?? null, no: ref.no ?? null, sumiu: false };
}

/**
 * Recalcula as menções do documento contra o catálogo — a menção viva do D-39.
 * Fora do desfazer: o usuário não fez nada, quem mudou foi a unidade ou o plano,
 * e um Ctrl+Z não pode trazer de volta o nome velho. Devolve se algo mudou.
 */
export function sincronizarMencoes(editor: Editor, cat: CatalogoMencoes): boolean {
  const { tr, doc } = editor.state;
  let mudou = false;
  doc.descendants((node, pos) => {
    if (node.type.name !== 'mencao') return;
    const ref = refDosAtributos(node.attrs);
    if (!ref) return;
    const r = resolver(ref, cat);
    const novo = {
      ...node.attrs,
      rotulo: r ? r.nome : ref.rotulo,
      chave: r ? r.chave : ref.chave,
      sumiu: r === null,
    };
    if (novo.rotulo !== node.attrs.rotulo || novo.chave !== node.attrs.chave || novo.sumiu !== node.attrs.sumiu) {
      tr.setNodeMarkup(pos, undefined, novo);
      mudou = true;
    }
  });
  if (mudou) {
    tr.setMeta('addToHistory', false);
    editor.view.dispatch(tr);
  }
  return mudou;
}
