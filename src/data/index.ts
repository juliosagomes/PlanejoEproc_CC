/**
 * Catálogos do Eproc embutidos no bundle (Caminho A — ver CLAUDE.md).
 *
 * Só entram aqui as listas que os descritores da regra de ATP citam
 * (`CatalogoId`, em `domain/atp/campos.ts`) e que são **do Eproc**, não da
 * unidade. Os originais ficam em `listas_json/` na raiz; o que não está copiado
 * para cá ficou de fora de propósito (decisoes.md#D-27):
 *
 *  - grande demais para o ganho: assunto (1 MB, D-1), precedente, entidade,
 *    órgão de origem — viram campo de digitação;
 *  - da unidade ou do tribunal: localizadores, juízo, subseção, classificador —
 *    o build é o mesmo para todo mundo, e dado de uma vara não pode ir nele.
 *
 * As 24 ações programadas não estão aqui: moram no domínio, junto dos campos
 * de cada uma (`domain/atp/acoes.ts`).
 */
import type { CatalogoId } from '@/domain';
import devolucaoCartaAr from './compSelCodTipoDevolucaoCartaAr.json';
import qualificacaoParte from './compSelDadoQualificacaoParte.json';
import tipoInquerito from './compSelDadoTipoInquerito.json';
import tipoParte from './compSelDadoTipoParte.json';
import tipoPessoa from './compSelDadoTipoPessoa.json';
import dadoComplementarProcesso from './compSelIdDadoComplementarProcesso.json';
import dadoComplementarParte from './compSelIdDadoComplementarValor.json';
import compSelIdEventoData from './compSelIdEvento.json';
import quantidadeDocEvento from './compSelNumQuantidadeDocEvento.json';
import nivelSigilo from './compSelNivelSigilo.json';
import pendenciaCumprimento from './compSelPendenciasCumprimento.json';
import laudoPericial from './compSelSigTipoClassificacaoLaudoPericial.json';
import litisconsorcio from './compSelTipoLitisconsorcio.json';
import ordemConsultaRestricao from './compSelTipoOrdemConsultaRestricao.json';
import tipoProcessoRelacionado from './compSelTipoProcessoRelacionado.json';
import representacaoProcessual from './compSelTipoRepresentacaoProcessual.json';
import modificadorData from './critDataModificador.json';
import modificadorValor from './critValorModificador.json';
import selClassesData from './selClassesJudiciaisMultiplo.json';
import selCompetenciaData from './selCompetencia.json';
import grupoEventoPeticao from './selectGrupoEventoTipoPeticaoFiltro.json';
import prazo from './selPrazoMultiplo.json';
import rito from './selRitoProcesso.json';
import poloEntidade from './selSinPolo.json';
import poloPeticao from './selSinPoloFiltroContenhaEvento.json';
import poloRepresentante from './selSinPoloParteRepresentante.json';
import selStatusData from './selStatusProcessoMultiplo.json';
import selTipoControleData from './selTipoControle.json';
import tiposPeticao from './selTipoPeticaoFiltroMultiplo.json';
import ultimaMovimentacao from './selUltimaMovimentacao.json';

export interface ItemCatalogo {
  /** Código canônico do Eproc (string sempre — alguns JSONs usam letras, outros números). */
  value: string;
  /** Rótulo legível em PT-BR. */
  label: string;
}

const cast = (data: unknown): ItemCatalogo[] => data as ItemCatalogo[];

/** Eventos do Eproc — gatilho de ATP, "Último Evento" e "que contenha evento". */
export const EVENTOS = cast(compSelIdEventoData);

/** 9 tipos de controle (selTipoControle) — espelha `TIPO_CONTROLE_VALUES` do domain. */
export const TIPOS_CONTROLE = cast(selTipoControleData);

/** Classes judiciais. */
export const CLASSES_JUDICIAIS = cast(selClassesData);

/** Competências. */
export const COMPETENCIAS = cast(selCompetenciaData);

/** Situações do processo. */
export const STATUS_PROCESSO = cast(selStatusData);

/** Tipos de petição. */
export const TIPOS_PETICAO = cast(tiposPeticao);

/** `selSinPoloPeticao` — "Restringir petições ou documentos de". */
export const POLOS_PETICAO = cast(poloPeticao);

/**
 * Todo `CatalogoId` do domínio resolvido para a sua lista. O `Record` é o que
 * garante, em compilação, que um catálogo citado num descritor existe aqui.
 */
export const CATALOGOS: Record<CatalogoId, ItemCatalogo[]> = {
  eventos: EVENTOS,
  tiposPeticao: TIPOS_PETICAO,
  classes: CLASSES_JUDICIAIS,
  competencias: COMPETENCIAS,
  statusProcesso: STATUS_PROCESSO,
  rito: cast(rito),
  dadoComplementarProcesso: cast(dadoComplementarProcesso),
  nivelSigilo: cast(nivelSigilo),
  modificadorData: cast(modificadorData),
  modificadorValor: cast(modificadorValor),
  tipoInquerito: cast(tipoInquerito),
  tipoProcessoRelacionado: cast(tipoProcessoRelacionado),
  prazo: cast(prazo),
  ultimaMovimentacao: cast(ultimaMovimentacao),
  pendenciaCumprimento: cast(pendenciaCumprimento),
  quantidadeDocEvento: cast(quantidadeDocEvento),
  devolucaoCartaAr: cast(devolucaoCartaAr),
  laudoPericial: cast(laudoPericial),
  ordemConsultaRestricao: cast(ordemConsultaRestricao),
  tipoParte: cast(tipoParte),
  dadoComplementarParte: cast(dadoComplementarParte),
  litisconsorcio: cast(litisconsorcio),
  representacaoProcessual: cast(representacaoProcessual),
  tipoPessoa: cast(tipoPessoa),
  qualificacaoParte: cast(qualificacaoParte),
  poloEntidade: cast(poloEntidade),
  poloRepresentante: cast(poloRepresentante),
  poloPeticao: POLOS_PETICAO,
  grupoEventoPeticao: cast(grupoEventoPeticao),
};

/** Procura o `label` de um valor num catálogo. Retorna `undefined` se não achar. */
export function buscarLabel(
  catalogo: ReadonlyArray<ItemCatalogo>,
  value: string,
): string | undefined {
  return catalogo.find((it) => it.value === value)?.label;
}
