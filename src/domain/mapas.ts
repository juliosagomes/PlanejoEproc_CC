import { normalizarRotulo } from './setores';

/* ============================================================================
 * MAPAS DESCRITIVOS (decisoes.md#D-39)
 *
 * Documentos que o usuário monta para explicar o trabalho da unidade: slides
 * deitados (paisagem) ou um documento corrido em pé (retrato). O que os separa
 * de um arquivo do Word é a **menção**: digitando @, o texto cita um
 * localizador, uma preferência ou uma regra de ATP, e a citação continua
 * ligada ao dado — se a sincronização renomear o localizador, o mapa acompanha.
 *
 * O antigo "modo de impressão" virou um caminho de criação: escolher
 * localizadores no fluxo gera um mapa pronto, com o desenho e a legenda, que o
 * usuário edita e exporta em PDF.
 *
 * Os mapas são do **silo**, como os setores (D-26) e o painel (D-33): não
 * pertencem a um plano, e um mesmo mapa pode citar vários.
 * ========================================================================== */

export const MAPA_VERSION = 1 as const;

export type MapaVersion = typeof MAPA_VERSION;

export type FormatoMapa = 'paisagem' | 'retrato';

export const FORMATO_ROTULO: Record<FormatoMapa, string> = {
  paisagem: 'Paisagem',
  retrato: 'Retrato',
};

/** Medida do slide em px CSS: A4 deitada a 96 dpi (297 × 210 mm). */
export const SLIDE_LARGURA = 1122;
export const SLIDE_ALTURA = 793;

/* ---------------------------------------------------------------------------
 * Menções
 * ------------------------------------------------------------------------- */

export type TipoMencao = 'loc' | 'pref' | 'atp';

export const TIPO_MENCAO_ROTULO: Record<TipoMencao, string> = {
  loc: 'Localizador',
  pref: 'Preferência',
  atp: 'Regra de ATP',
};

/**
 * Para onde uma menção aponta. Mora no HTML do mapa, em atributos `data-*` do
 * `<span class="mencao">` — o texto visível é sempre recalculado a partir disto.
 *
 * - `loc` e `pref`: `chave` é o nome normalizado (como as filas do D-33, que
 *   guardam localizador por nome). `eprocId`, quando a menção nasceu de um item
 *   sincronizado, é o que permite acompanhar uma **renomeação** no Eproc: o nome
 *   antigo deixa de casar, o id continua.
 * - `atp`: o plano não sabe o número das regras no Eproc (D-38), então a regra é
 *   o **recurso da aresta**: `chave` = `planoId/arestaId/recursoId`.
 *
 * `no` (`planoId/noId`) é o nó de onde a menção a localizador nasceu, quando
 * nasceu de um plano. É o que acompanha a renomeação feita **no plano**: o nome
 * gravado deixa de casar, o nó continua.
 *
 * `rotulo` é o último nome conhecido. Aparece quando o alvo sumiu, para que o
 * texto em volta continue legível e o usuário saiba o que revisar.
 */
export interface RefMencao {
  tipo: TipoMencao;
  chave: string;
  rotulo: string;
  eprocId?: string;
  no?: string;
}

export function chaveMencaoNome(nome: string): string {
  return normalizarRotulo(nome);
}

export function chaveMencaoAtp(planoId: string, arestaId: string, recursoId: string): string {
  return `${planoId}/${arestaId}/${recursoId}`;
}

/** `null` quando a chave não tem as três partes — HTML colado de fora, por exemplo. */
export function partesChaveAtp(
  chave: string,
): { planoId: string; arestaId: string; recursoId: string } | null {
  const partes = chave.split('/');
  if (partes.length !== 3 || partes.some((p) => !p)) return null;
  const [planoId, arestaId, recursoId] = partes as [string, string, string];
  return { planoId, arestaId, recursoId };
}

/* ---------------------------------------------------------------------------
 * Desenho do fluxo
 * ------------------------------------------------------------------------- */

/**
 * O desenho de um recorte do plano, como entrou no mapa. É um **retrato**: o
 * SVG fica gravado, e a legenda em volta cita os números ①②③ dele. Redesenhar
 * sozinho a cada mudança no plano trocaria esses números por baixo do texto;
 * por isso o mapa só **avisa** (a `assinatura` deixou de bater) e o usuário
 * decide quando atualizar.
 */
export interface BlocoFluxo {
  planoId: string;
  /** Nome do plano quando o desenho foi feito, para o aviso de plano apagado. */
  planoNome: string;
  /** Ids dos localizadores escolhidos. */
  nos: string[];
  /** Mostra, esmaecido, o que entra e sai do recorte. */
  fora: boolean;
  /** Assinatura do recorte no momento do desenho (ver `features/mapas/fluxoPapel.ts`). */
  assinatura: string;
  svg: string;
  /** ISO 8601. */
  desenhadoEm: string;
}

/* ---------------------------------------------------------------------------
 * Slides (paisagem)
 * ------------------------------------------------------------------------- */

interface ElementoBase {
  id: string;
  /** Canto superior esquerdo e medida, em px do slide (`SLIDE_LARGURA` × `SLIDE_ALTURA`). */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ElementoTexto extends ElementoBase {
  tipo: 'texto' | 'nota';
  html: string;
}

export interface ElementoImagem extends ElementoBase {
  tipo: 'imagem';
  /** Data URL. A imagem viaja dentro do mapa: o app é offline. */
  src: string;
}

export interface ElementoFluxo extends ElementoBase {
  tipo: 'fluxo';
  fluxo: BlocoFluxo;
}

export type ElementoSlide = ElementoTexto | ElementoImagem | ElementoFluxo;

export interface Slide {
  id: string;
  elementos: ElementoSlide[];
}

/* ---------------------------------------------------------------------------
 * O mapa
 * ------------------------------------------------------------------------- */

/** De onde um mapa gerado veio — só informação, para a lista e o cabeçalho. */
export interface OrigemMapa {
  planoId: string;
  planoNome: string;
  localizadores: number;
}

interface MapaBase {
  version: MapaVersion;
  id: string;
  nome: string;
  /** ISO 8601. */
  criadoEm: string;
  atualizadoEm: string;
  origem?: OrigemMapa;
}

export interface MapaPaisagem extends MapaBase {
  formato: 'paisagem';
  slides: Slide[];
}

export interface MapaRetrato extends MapaBase {
  formato: 'retrato';
  /**
   * O documento, já sanitizado. Os desenhos de fluxo moram dentro dele como
   * `<figure class="fluxo-bloco" data-fluxo="…">`.
   */
  html: string;
}

export type Mapa = MapaPaisagem | MapaRetrato;

/** Uma linha do índice — o bastante para a lista lateral sem abrir cada mapa. */
export interface MapaIndexEntry {
  id: string;
  nome: string;
  formato: FormatoMapa;
  atualizadoEm: string;
  /** "3 slides", "gerado do fluxo"… montado na gravação. */
  resumo: string;
}

export function resumoDoMapa(m: Mapa): string {
  const base =
    m.formato === 'paisagem'
      ? `${m.slides.length} slide${m.slides.length === 1 ? '' : 's'}`
      : 'Documento';
  return m.origem ? `${base} · do plano ${m.origem.planoNome}` : base;
}

export function entradaDoIndice(m: Mapa): MapaIndexEntry {
  return {
    id: m.id,
    nome: m.nome,
    formato: m.formato,
    atualizadoEm: m.atualizadoEm,
    resumo: resumoDoMapa(m),
  };
}
