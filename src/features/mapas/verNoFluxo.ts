import { partesChaveAtp, type RefMencao } from '@/domain';
import { getAtivoId } from '@/infra/storage';
import { resolver, type CatalogoMencoes } from './mencoes';
import { planoPorId } from './planos';

export interface AlvoNoFluxo {
  planoId: string;
  noId: string;
}

/**
 * Onde a menção aparece no quadro. O localizador prefere o plano aberto; a
 * regra de ATP leva à origem da sua seta. A preferência não tem lugar próprio
 * no desenho — ela é recurso de várias setas —, então não tem "ver no fluxo".
 */
export function alvoNoFluxo(ref: RefMencao, cat: CatalogoMencoes): AlvoNoFluxo | null {
  const r = resolver(ref, cat);
  if (!r) return null;
  if (r.tipo === 'loc') {
    const ativo = getAtivoId();
    const uso = r.info.usos.find((u) => u.planoId === ativo) ?? r.info.usos[0];
    return uso ? { planoId: uso.planoId, noId: uso.noId } : null;
  }
  if (r.tipo === 'atp') {
    const partes = partesChaveAtp(ref.chave);
    const plano = partes && planoPorId(partes.planoId);
    const aresta = plano?.edges.find((e) => e.id === partes?.arestaId);
    return partes && aresta ? { planoId: partes.planoId, noId: aresta.source } : null;
  }
  return null;
}
