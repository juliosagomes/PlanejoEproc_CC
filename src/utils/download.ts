/**
 * Download de arquivos gerados no cliente. Funciona em `file://` (requisito
 * de distribuição — ver CLAUDE.md): Blob + object URL não dependem de origem
 * HTTP.
 */

/** Slug ASCII-safe que sobrevive a sistemas de arquivo restritivos. */
export function safeFileName(raw: string, fallback: string): string {
  const slug = raw
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return slug || fallback;
}

export function downloadJson(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 0);
}

/** `YYYY-MM-DD` de hoje — sufixo padrão dos arquivos exportados. */
export function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}
