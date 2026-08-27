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
  /** Total anunciado pela tela ("179 registros"), quando houver. */
  totalAnunciado?: number;
}

export interface ColetaUnidade {
  /** `location.host` da aba, ex.: `eproc1g.tjmg.jus.br`. */
  host: string;
  escopo: EscopoBruto | null;
  fontes: Partial<Record<FonteId, FonteBruta>>;
  /** Preenchido só quando nada pôde ser coletado (sessão expirada, p. ex.). */
  erro?: string;
}
