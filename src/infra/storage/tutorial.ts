import { z } from 'zod';
import { getStorage } from '@/infra/plataforma/storageLike';

/* ============================================================================
 * "JÁ VI O TUTORIAL"
 *
 * Chave **global ao navegador**, fora de qualquer silo — mesmo desenho do
 * catálogo do órgão (`catalogo.ts`, decisoes.md#D-7). Dois motivos:
 *
 *  1. Não é conteúdo de plano nenhum. É um fato sobre a pessoa que usa este
 *     navegador, e vale igual no modo local e em qualquer lotação.
 *  2. `escopo.ts` devolve `null` fora de sessão, e ali toda escrita é no-op.
 *     Uma chave com escopo não conseguiria ser gravada em metade dos momentos
 *     em que faz sentido gravá-la.
 *
 * Fica em `chrome.storage.local`, **não** na allowlist do `sync`
 * (`infra/plataforma/chromeMirror.ts`). A cota do `sync` é apertada e as duas
 * chaves que moram lá são coisas cuja perda dói de verdade — códigos
 * irrevogáveis e preferência explícita (decisoes.md#D-14). Aqui a assimetria de
 * erro aponta para o outro lado: não replicar custa rever 8 slides, com "Pular"
 * a um clique; replicar mal custa um usuário novo que **nunca** vê o tutorial
 * porque outro perfil o dispensou.
 * ========================================================================== */

const TUTORIAL_KEY = 'planejoeproc:tutorial:visto';

/**
 * Versão do **roteiro**, não do app.
 *
 * Amarrar isto ao `package.json` faria toda release reexibir os slides para
 * todo mundo. Suba o número só quando o tutorial mudar a ponto de quem já viu
 * precisar rever — é decisão de produto, não consequência de um ajuste de
 * texto.
 */
export const TUTORIAL_VERSAO = 1;

/**
 * Objeto em vez de booleano: o `versao` é o que permite reexibir um roteiro
 * novo. O `em` não é lido por ninguém — existe para quem for depurar o storage
 * saber quando aquilo foi gravado, mesmo padrão de `marcarSincronizacao`.
 */
const VistoSchema = z.object({
  versao: z.number().int().positive(),
  em: z.string(),
});

/** Versão do roteiro que este navegador já viu, ou `null` se nunca viu. */
export function getTutorialVisto(): number | null {
  const storage = getStorage();
  if (!storage) return null;
  const raw = storage.getItem(TUTORIAL_KEY);
  if (raw === null) return null;
  try {
    const parsed = VistoSchema.safeParse(JSON.parse(raw));
    // Valor irreconhecível cai como "nunca viu": o pior caso é o tutorial
    // aparecer de novo, e isso é bem melhor do que estourar no boot do editor.
    return parsed.success ? parsed.data.versao : null;
  } catch {
    return null;
  }
}

export function marcarTutorialVisto(versao: number = TUTORIAL_VERSAO): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(
      TUTORIAL_KEY,
      JSON.stringify({ versao, em: new Date().toISOString() }),
    );
  } catch (err) {
    console.warn('[tutorial] Falha ao marcar o tutorial como visto.', err);
  }
}

/** Faz o tutorial voltar a abrir sozinho. Usado nos testes. */
export function limparTutorialVisto(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(TUTORIAL_KEY);
  } catch {
    // ignore
  }
}
