/**
 * Catálogo lido direto da **unidade no Eproc** — o irmão automático do
 * `CatalogoOrgao`, que vem do XLS exportado à mão (decisoes.md#D-7).
 *
 * Diferença essencial para o `CatalogoOrgao`: este é **escopado por unidade**.
 * Um host do Eproc serve todas as varas do tribunal, e o mesmo usuário costuma
 * ter vários perfis; chavear só por host faria a coleta de uma unidade
 * sobrescrever a da outra sem nada denunciar a troca.
 */
export const CATALOGO_UNIDADE_VERSION = 1 as const;

export type CatalogoUnidadeVersion = typeof CATALOGO_UNIDADE_VERSION;

/** Identidade da unidade+usuário de onde o catálogo veio. */
export interface UnidadeEproc {
  /** `host::login::sigla`. Compõe a chave de storage. */
  chave: string;
  /** Ex.: `eproc1g.tjmg.jus.br`. */
  host: string;
  /** Login do usuário no Eproc. */
  login: string;
  /**
   * Sigla da unidade, **sem o papel**: de `ULA 2ª V.FAM.SUC/GERENTE DE
   * SECRETARIA` sai `ULA 2ª V.FAM.SUC`. O papel fica de fora de propósito — o
   * mesmo usuário aparece na mesma vara com papéis diferentes, e incluí-lo
   * criaria um catálogo por papel.
   */
  sigla: string;
  /** Nome por extenso, quando o `title` do `<option>` permitir extrair. */
  nome?: string;
}

/**
 * Um localizador da unidade.
 *
 * `sigla` e `nome` são campos distintos no Eproc (colunas "Localizador" e "Nome
 * do Localizador") e coincidem na maioria esmagadora dos casos — 364 de 431 numa
 * unidade real. É essa coincidência que produz o texto duplicado no `<select>`
 * (`"X - X"`), e por isso os dois campos existem separados aqui.
 */
export interface LocalizadorUnidade {
  /**
   * Id do Eproc (29–30 dígitos), quando a listagem do `<select>` conseguiu
   * casar com este item. Ausente não é erro: o `<select>` e a listagem do órgão
   * não cobrem exatamente o mesmo conjunto.
   */
  eprocId?: string;
  sigla: string;
  nome: string;
  descricao?: string;
  /**
   * Coluna "Localizador Sistema". Itens de sistema entram no catálogo e são
   * marcados, não filtrados (decisoes.md#D-23).
   */
  sistema: boolean;
  /** Como o Eproc mostra: `dd/MM/yyyy HH:mm:ss`. Não normalizado de propósito. */
  dataInclusao?: string;
  qtdProcessos?: number;
}

/** Item simples de catálogo — preferências, modelos, textos padrão. */
export interface ItemCatalogoUnidade {
  /**
   * Código do Eproc. Ausente nas **preferências**: a tela que as lista
   * (`consultar_formulario_personalizacao_grupo`) mostra só o nome, sem link
   * que carregue o `num_id_form_personalizacao`. Para sugerir nomes no editor
   * isso basta; para qualquer integração mais funda, não.
   */
  eprocId?: string;
  nome: string;
  /** Sigla do órgão dono, para separar o que é da unidade do que é herdado. */
  orgao?: string;
  /** Tipo de documento (modelos) ou sigla auto-texto (textos padrão). */
  detalhe?: string;
}

/**
 * Vínculo entre um localizador e as preferências que atuam sobre ele — o que o
 * Eproc chama de **ação preferencial**.
 *
 * É a única coisa coletada que não é catálogo: catálogo é lista de nomes para
 * sugerir, isto é **grafo** — no vocabulário do PlanejoEproc, as arestas verdes
 * que já existem na unidade. Por ora entra só como informação no painel do
 * localizador; transformá-lo em arestas do plano é outra decisão, registrada no
 * roadmap do CLAUDE.md.
 */
export interface AcaoPreferencialUnidade {
  /** Sigla do localizador, como casa com `LocalizadorUnidade.sigla`. */
  localizador: string;
  /** Nomes das preferências vinculadas, na ordem em que a tela lista. */
  preferencias: string[];
}

export type FonteStatus = 'ok' | 'vazio' | 'semPermissao' | 'falhou';

export const FONTES = [
  'catalogoSelect',
  'localizadoresOrgao',
  'preferencias',
  'modelos',
  'textosPadrao',
  'acoesPreferenciais',
] as const;

export type FonteId = (typeof FONTES)[number];

/**
 * Como cada fonte se saiu. Resultado parcial é sucesso: uma tela que o perfil do
 * usuário não alcança não pode derrubar a coleta inteira.
 */
export interface FonteResultado {
  status: FonteStatus;
  /** Quantos itens entraram no catálogo por esta fonte. */
  itens?: number;
  /** Por que falhou, em PT-BR, para aparecer no modal de resultado. */
  motivo?: string;
}

export interface CatalogoUnidade {
  version: CatalogoUnidadeVersion;
  unidade: UnidadeEproc;
  /** ISO 8601 UTC do momento da coleta. */
  coletadoEm: string;
  localizadores: LocalizadorUnidade[];
  /**
   * Preenchidos na Fase 2. Nascem opcionais para que um catálogo gravado hoje
   * continue validando depois — o schema não tem máquina de migração, e falhar
   * a validação significa jogar o catálogo do usuário fora.
   */
  preferencias?: ItemCatalogoUnidade[];
  modelos?: ItemCatalogoUnidade[];
  textosPadrao?: ItemCatalogoUnidade[];
  acoesPreferenciais?: AcaoPreferencialUnidade[];
  fontes: Partial<Record<FonteId, FonteResultado>>;
}
