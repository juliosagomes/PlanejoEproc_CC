import type { FonteId, FonteStatus } from '@/domain';
import type { EscopoBruto } from './escopoUnidade';

/**
 * Formato bruto que o coletor devolve da aba do Eproc.
 *
 * Distinto do `CatalogoUnidade` do domain de propósito: o coletor é burro por
 * imposição técnica — ele roda injetado na página e **não pode importar nada**
 * (ver `src/extension/coletor/eproc.ts`), então não tem acesso aos parsers. Ele
 * faz só o que exige estar lá dentro: rede com o cookie da sessão e leitura do
 * DOM. Recorta os fragmentos e devolve; quem interpreta é o lado da página, com
 * código puro e testado.
 */
export interface FonteBruta {
  status: FonteStatus;
  /** Por que não deu certo, em PT-BR, para chegar ao modal de resultado. */
  motivo?: string;
  /**
   * Um fragmento por página: o `outerHTML` da `<table class="infraTable">` ou do
   * `<select>`. Recortar na origem evita trafegar centenas de KB de moldura por
   * página — e é exatamente o formato das fixtures.
   */
  fragmentos: string[];
  /**
   * Rótulo de cada fragmento, paralelo a `fragmentos`. Usado pelas preferências,
   * que vêm em uma requisição por **tipo** (Minuta, Movimentação, Intimação) —
   * o tipo não está dentro do XML, só na pergunta que o produziu, e se perde se
   * não for carregado junto.
   */
  rotulos?: string[];
  /** Total anunciado pela tela ("179 registros"), quando houver. */
  totalAnunciado?: number;
}

export interface ColetaUnidade {
  /** `location.host` da aba, ex.: `eproc1g.tjmg.jus.br`. */
  host: string;
  escopo: EscopoBruto | null;
  fontes: Partial<Record<FonteId, FonteBruta>>;
  /**
   * Formulário recortado de cada regra de ATP lida nesta coleta, pelo nº
   * (decisoes.md#D-46). A listagem vai em `fontes.regrasAtp`.
   */
  detalhesAtp?: Record<string, string>;
  /** Regras cujo formulário foi pedido e não veio, com o motivo. */
  falhasAtp?: Record<string, string>;
  /** Preenchido só quando nada pôde ser coletado (sessão expirada, p. ex.). */
  erro?: string;
}

/**
 * O que a coleta das regras de ATP devolve (decisoes.md#D-46). Vem de uma
 * injeção própria, separada da coleta da unidade, porque também roda sozinha
 * para uma regra e porque o detalhe completo leva minutos.
 */
export interface ColetaRegrasAtp {
  /** A listagem, recortada: um fragmento com a tabela inteira. */
  lista: FonteBruta;
  /** Formulário de cada regra pedida, recortado, pelo nº da regra. */
  detalhes: Record<string, string>;
  /** Regras pedidas cujo formulário não veio, com o motivo. */
  falhas: Record<string, string>;
  /** Preenchido só quando nada pôde ser coletado. */
  erro?: string;
}

/** Progresso do detalhe, que a página lê enquanto a coleta corre. */
export interface ProgressoRegrasAtp {
  feitas: number;
  total: number;
}
