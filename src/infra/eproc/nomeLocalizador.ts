/**
 * Separação de `"sigla - nome"` no rótulo do `<select id="selLocalizador">`.
 *
 * O Eproc monta o texto de cada `<option>` como `sigla + " - " + nome`. Como na
 * maioria esmagadora dos localizadores a sigla é igual ao nome, o resultado é um
 * texto duplicado:
 *
 *     "📝 Minutar (Secretaria) - 📝 Minutar (Secretaria)"
 *
 * Cortar no **primeiro** `" - "` erra, porque o próprio nome pode conter " - ":
 *
 *     "🔵 Conclusos - Pedido Reconvencional - 🔵 Conclusos - Pedido Reconvencional"
 *      └──────────── sigla ────────────────┘   └────────── nome ───────────────┘
 *
 * A regra procura o separador que parte a string em **metades iguais**. Medido
 * nos 431 localizadores reais de uma unidade do TJMG (27/08/2026):
 *
 *   359  metades exatamente iguais            → colapsa
 *     5  iguais após descartar decoração      → colapsa
 *    67  `SIGLA - NOME` genuíno               → preserva os dois
 *     0  falso-colapso
 *
 * A verdade de referência é `localizador_orgao_listar`, que traz sigla e nome em
 * colunas separadas — é contra ela que o teste confere, e não contra uma
 * expectativa escrita à mão.
 */

const SEP = ' - ';

/**
 * Forma canônica para comparar dois rótulos que "são o mesmo nome": descarta
 * emoji, modificadores, acento e pontuação, e normaliza caixa e espaço.
 *
 * Serve para dois usos: decidir se as metades do `<option>` são o mesmo texto, e
 * casar um item do `<select>` com a linha correspondente da listagem do órgão.
 *
 * A ordem importa. `NFKD` decompõe `Ç` em `C` + cedilha combinante; sem remover
 * as marcas (`\p{M}`) logo em seguida, a cedilha viraria espaço na limpeza de
 * pontuação e `CITACAO` deixaria de casar com `Citação`.
 */
export function semDecoracao(texto: string): string {
  return texto
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}]/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toUpperCase();
}

export interface SiglaNome {
  sigla: string;
  nome: string;
}

/** Posições de todas as ocorrências de `" - "`, da esquerda para a direita. */
function separadores(texto: string): number[] {
  const pos: number[] = [];
  let i = texto.indexOf(SEP);
  while (i >= 0) {
    pos.push(i);
    i = texto.indexOf(SEP, i + 1);
  }
  return pos;
}

/**
 * Divide o rótulo do `<option>` em sigla e nome.
 *
 * O Eproc sempre monta `sigla - nome`, então em todos os ramos a metade
 * esquerda é a sigla e a direita é o nome — inclusive quando são iguais.
 */
export function separarSiglaNome(rotulo: string): SiglaNome {
  const texto = rotulo.replace(/\s+/g, ' ').trim();
  const pos = separadores(texto);
  if (pos.length === 0) return { sigla: texto, nome: texto };

  // 1) Metades idênticas. É o caso dominante e o único inequívoco.
  for (const i of pos) {
    const esq = texto.slice(0, i);
    const dir = texto.slice(i + SEP.length);
    if (esq === dir) return { sigla: esq, nome: dir };
  }

  // 2) Iguais a menos de decoração: a sigla carrega um emoji que o nome não tem
  //    ("💸ISENTO DE CUSTAS - ISENTO DE CUSTAS"), ou difere só por acento/caixa
  //    ("CITACAO DJE NÃO CONFIRMADA - Citação DJE Não Confirmada").
  for (const i of pos) {
    const esq = texto.slice(0, i);
    const dir = texto.slice(i + SEP.length);
    const canon = semDecoracao(esq);
    if (canon.length > 0 && canon === semDecoracao(dir)) {
      return { sigla: esq, nome: dir };
    }
  }

  // 3) Sigla e nome genuinamente distintos. Aqui — e só aqui — o primeiro
  //    separador é o certo: o que vem depois pertence todo ao nome
  //    ("📰 CERTDJEN 📰 - CERTIDÃO DE DISTRIBUIÇÃO - DJEN").
  const i = pos[0] as number;
  return { sigla: texto.slice(0, i), nome: texto.slice(i + SEP.length) };
}
