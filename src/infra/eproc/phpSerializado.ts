/**
 * Leitura do `serialize()` do PHP, o formato em que o formulário "Editar Regra"
 * do Eproc guarda cada ação programada (`hdnATP_n`, em base64).
 *
 * Só leitura, e só o que aparece ali: `a`, `s`, `i`, `d`, `b`, `N` e `O`. O
 * comprimento de `s:N:"…"` é em **bytes**; como a página é ISO-8859-1 e o
 * base64 é decodificado byte a byte (`atob`), um caractere vale um byte, e o
 * comprimento pode ser usado direto. Caractere fora do Latin-1 chega como
 * entidade HTML (`&#128221;`), resolvida por quem lê o valor.
 */
export type ValorPhp = string | number | boolean | null | MapaPhp;

export interface MapaPhp {
  [chave: string]: ValorPhp;
}

export function lerPhpSerializado(texto: string): ValorPhp {
  let i = 0;

  function ate(fim: string): string {
    const j = texto.indexOf(fim, i);
    if (j < 0) throw new Error(`PHP serializado truncado na posição ${i}.`);
    const trecho = texto.slice(i, j);
    i = j + fim.length;
    return trecho;
  }

  function valor(): ValorPhp {
    const tipo = texto[i];
    i += 2;
    switch (tipo) {
      case 'N':
        return null;
      case 'b':
        return ate(';') === '1';
      case 'i':
      case 'd':
        return Number(ate(';'));
      case 's': {
        const n = Number(ate(':'));
        i += 1; // abre aspas
        const s = texto.slice(i, i + n);
        i += n + 2; // fecha aspas e ;
        return s;
      }
      case 'a':
        return mapa(Number(ate(':')));
      case 'O': {
        ate(':'); // comprimento do nome da classe
        ate('":'); // nome da classe
        return mapa(Number(ate(':')));
      }
      default:
        throw new Error(`Tipo "${tipo}" desconhecido no PHP serializado.`);
    }
  }

  function mapa(n: number): MapaPhp {
    i += 1; // {
    const saida: MapaPhp = {};
    for (let k = 0; k < n; k++) {
      const chave = valor();
      saida[String(chave)] = valor();
    }
    i += 1; // }
    return saida;
  }

  return valor();
}

/**
 * Os atributos de um `InfraDTO` serializado: o PHP guarda cada um como
 * `[2 => valor, 5 => tipo]` dentro de `arrAtributos`, com o nome da
 * propriedade privada prefixado por bytes nulos.
 */
export function atributosInfraDto(dto: ValorPhp): Record<string, ValorPhp> {
  if (!dto || typeof dto !== 'object') return {};
  const chave = Object.keys(dto).find((k) => k.endsWith('arrAtributos'));
  const atributos = chave ? dto[chave] : undefined;
  if (!atributos || typeof atributos !== 'object') return {};
  const saida: Record<string, ValorPhp> = {};
  for (const [nome, par] of Object.entries(atributos)) {
    saida[nome] = par && typeof par === 'object' ? (par['2'] ?? null) : par;
  }
  return saida;
}
