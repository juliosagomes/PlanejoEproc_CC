import type { UnidadeEproc } from '@/domain';

/**
 * Identificação da unidade+usuário a partir do que o coletor lê do DOM.
 *
 * Funções puras sobre strings, de propósito: o acesso ao DOM do Eproc mora no
 * coletor injetado (que não pode importar nada), e o entendimento do formato
 * mora aqui, onde dá para testar.
 *
 * **Por que a chave inclui login e sigla.** Um host serve todas as unidades do
 * tribunal — num perfil real o mesmo usuário tinha 9 lotações no mesmo host.
 * Chavear o catálogo só por host faria a última coleta sobrescrever a anterior
 * sem nada denunciar a troca.
 *
 * **Por que a sigla, e não o `value` do `<option>`.** O `value` identifica o par
 * unidade+**papel**: o mesmo usuário aparece na mesma vara como "GERENTE DE
 * SECRETARIA" e como "USUÁRIO AUTOMATIZADOR", com values distintos. Chavear por
 * ele criaria um catálogo por papel, para localizadores que são os mesmos.
 */
export interface EscopoBruto {
  /** `textContent` de `#nav-profile` — "FULANO DE TAL (f0344267) …". */
  perfilTexto: string | null;
  /** Texto do `<option>` selecionado — "ULA 2ª V.FAM.SUC/GERENTE DE SECRETARIA". */
  unidadeTexto: string | null;
  /** `title` do mesmo `<option>` — "2ª Vara … - ULA 2ª V.FAM.SUC/GERENTE …". */
  unidadeTitle: string | null;
}

/** Login entre parênteses, na primeira ocorrência: `FULANO (f0344267)`. */
export function extrairLogin(perfilTexto: string | null): string | null {
  if (!perfilTexto) return null;
  const m = perfilTexto.match(/\(([^()\s]+)\)/);
  return m?.[1]?.trim() || null;
}

/** Sigla é o que vem antes da primeira `/`; o resto é o papel. */
export function extrairSigla(unidadeTexto: string | null): string | null {
  if (!unidadeTexto) return null;
  const texto = unidadeTexto.replace(/\s+/g, ' ').trim();
  if (!texto) return null;
  const barra = texto.indexOf('/');
  const sigla = (barra >= 0 ? texto.slice(0, barra) : texto).trim();
  return sigla || null;
}

/**
 * Nome por extenso: o `title` é `"<nome> - <texto do option>"`. Remover o
 * sufixo é mais seguro que cortar no primeiro " - ", porque o nome da vara pode
 * conter hífen.
 */
export function extrairNomeUnidade(
  unidadeTitle: string | null,
  unidadeTexto: string | null,
): string | undefined {
  if (!unidadeTitle) return undefined;
  const title = unidadeTitle.replace(/\s+/g, ' ').trim();
  const texto = unidadeTexto?.replace(/\s+/g, ' ').trim();
  if (texto && title.endsWith(` - ${texto}`)) {
    const nome = title.slice(0, title.length - texto.length - 3).trim();
    return nome || undefined;
  }
  return title || undefined;
}

/** `host::login::sigla`. */
export function montarChave(host: string, login: string, sigla: string): string {
  return `${host}::${login}::${sigla}`;
}

/**
 * Monta a identidade completa. Devolve `null` quando falta login ou sigla — sem
 * um dos dois não há como escopar o catálogo, e gravar sob uma chave incompleta
 * é pior que não gravar: mistura unidades em silêncio.
 */
export function montarUnidade(host: string, bruto: EscopoBruto): UnidadeEproc | null {
  const login = extrairLogin(bruto.perfilTexto);
  const sigla = extrairSigla(bruto.unidadeTexto);
  if (!login || !sigla) return null;

  const nome = extrairNomeUnidade(bruto.unidadeTitle, bruto.unidadeTexto);
  return {
    chave: montarChave(host, login, sigla),
    host,
    login,
    sigla,
    ...(nome ? { nome } : {}),
  };
}
