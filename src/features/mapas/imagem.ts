/**
 * A imagem entra no mapa como data URL — o app é offline, e o mapa precisa
 * levar a figura junto. Foto de celular passa fácil de 4 MB e seria regravada a
 * cada tecla; acima do limite, ela é reduzida e recomprimida em JPEG.
 */

const MAX_BYTES = 400 * 1024;
const MAX_LADO = 1600;

function lerComoDataUrl(arquivo: Blob): Promise<string> {
  return new Promise((ok, falha) => {
    const leitor = new FileReader();
    leitor.onload = () => ok(String(leitor.result));
    leitor.onerror = () => falha(leitor.error ?? new Error('Falha ao ler a imagem.'));
    leitor.readAsDataURL(arquivo);
  });
}

function carregar(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, falha) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => falha(new Error('Arquivo de imagem inválido.'));
    img.src = src;
  });
}

export interface ImagemPreparada {
  src: string;
  largura: number;
  altura: number;
}

export async function prepararImagem(arquivo: Blob): Promise<ImagemPreparada> {
  if (!arquivo.type.startsWith('image/')) throw new Error('O arquivo escolhido não é uma imagem.');
  const original = await lerComoDataUrl(arquivo);
  const img = await carregar(original);
  const { naturalWidth: w, naturalHeight: h } = img;
  if (arquivo.size <= MAX_BYTES && Math.max(w, h) <= MAX_LADO) return { src: original, largura: w, altura: h };

  const escala = Math.min(1, MAX_LADO / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * escala);
  canvas.height = Math.round(h * escala);
  const ctx = canvas.getContext('2d');
  if (!ctx) return { src: original, largura: w, altura: h };
  // JPEG não tem transparência: o fundo branco é o do papel.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { src: canvas.toDataURL('image/jpeg', 0.85), largura: canvas.width, altura: canvas.height };
}

/** Abre o seletor de arquivo do sistema e devolve a imagem escolhida. */
export function escolherImagem(): Promise<ImagemPreparada | null> {
  return new Promise((ok, falha) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const arq = input.files?.[0];
      if (!arq) return ok(null);
      prepararImagem(arq).then(ok, falha);
    };
    input.click();
  });
}
