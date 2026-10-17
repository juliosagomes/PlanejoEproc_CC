import { CONJUNTOS_VERSION, type CatalogoConjunto, type ConjuntosUnidade } from '@/domain';
import { getStorage } from '@/infra/plataforma/storageLike';
import { prefixo } from './escopo';
import { ConjuntosUnidadeSchema } from './schema';

/**
 * Conjuntos criados pelo usuário (decisoes.md#D-29, D-41). Uma chave por silo e
 * por catálogo, como os setores (D-26): é conhecimento da unidade sobre como
 * ela agrupa eventos, petições e documentos, não conteúdo de um plano.
 *
 *   modo local      →  planejoeproc:conjuntosEvento (…Peticao, …Documento)
 *   lotação <wsId>  →  planejoeproc:lot:<wsId>:conjuntosEvento
 *
 * A chave dos eventos é a de antes do D-41, para não perder o que já foi salvo.
 *
 * Valor irreconhecível vira lista vazia, sem backup: o que se perde é um atalho
 * de seleção — os planos guardam os códigos explícitos, e nenhum deles muda.
 */

const SUFIXOS: Record<CatalogoConjunto, string> = {
  eventos: 'conjuntosEvento',
  tiposPeticao: 'conjuntosPeticao',
  documentos: 'conjuntosDocumento',
};

function conjuntosKey(catalogo: CatalogoConjunto): string | null {
  const p = prefixo();
  return p === null ? null : `${p}${SUFIXOS[catalogo]}`;
}

export function loadConjuntos(catalogo: CatalogoConjunto): ConjuntosUnidade['itens'] {
  const key = conjuntosKey(catalogo);
  const raw = key === null ? null : (getStorage()?.getItem(key) ?? null);
  if (raw === null) return [];
  try {
    const parsed = ConjuntosUnidadeSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data.itens : [];
  } catch {
    return [];
  }
}

export function saveConjuntos(catalogo: CatalogoConjunto, itens: ConjuntosUnidade['itens']): void {
  const key = conjuntosKey(catalogo);
  if (key === null) return;
  try {
    if (itens.length === 0) getStorage()?.removeItem(key);
    else getStorage()?.setItem(key, JSON.stringify({ version: CONJUNTOS_VERSION, itens }));
  } catch (err) {
    console.warn('[storage] Falha ao salvar conjuntos.', err);
  }
}
