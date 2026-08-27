#!/usr/bin/env node
/**
 * Gerador dos ícones da extensão.
 *
 * O Chrome só aceita PNG/BMP/ICO em `manifest.icons` — SVG não serve. Em vez de
 * trazer uma dependência de rasterização (sharp, canvas) para produzir quatro
 * imagens que quase nunca mudam, desenhamos os pixels na mão e codificamos o
 * PNG com o `node:zlib` que já vem no runtime.
 *
 * O desenho reaproveita o `.brand-mark` do `src/index.css`: quadrado com cantos
 * arredondados, gradiente diagonal nas mesmas duas cores oklch. Por cima, um
 * glifo de fluxo (dois nós ligados por uma aresta) em vez das letras "eP" — a
 * 16px, texto vira borrão, e dois círculos com um traço continuam legíveis.
 *
 * Rode com `npm run icons`. A saída é versionada; não faz parte do build.
 */

import { deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '..', 'src', 'extension', 'icons');
const TAMANHOS = [16, 32, 48, 128];

/* ============================================================================
 * Cor: oklch → sRGB
 *
 * As cores da marca vivem em oklch no CSS. Converter aqui (em vez de chutar um
 * hex equivalente) mantém o ícone e a interface na mesma cor de verdade.
 * ========================================================================== */

function oklchParaSrgb(L, C, hGraus) {
  const h = (hGraus * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const lin = [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];

  return lin.map((v) => {
    const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, c)) * 255);
  });
}

// Mesmas paradas do gradiente de `.brand-mark` em src/index.css.
const COR_A = oklchParaSrgb(0.65, 0.13, 245);
const COR_B = oklchParaSrgb(0.55, 0.15, 265);

/* ============================================================================
 * Desenho
 *
 * Tudo é campo de distância avaliado por pixel, com supersampling 4×4 para o
 * antialiasing. Mais simples de acertar do que rasterizar caminhos, e a essa
 * escala o custo é irrelevante.
 * ========================================================================== */

/** Distância assinada a um retângulo de cantos arredondados centrado na origem. */
function distRoundRect(px, py, meia, raio) {
  const qx = Math.abs(px) - (meia - raio);
  const qy = Math.abs(py) - (meia - raio);
  const dx = Math.max(qx, 0);
  const dy = Math.max(qy, 0);
  return Math.hypot(dx, dy) + Math.min(Math.max(qx, qy), 0) - raio;
}

/** Distância assinada a um segmento de reta engrossado. */
function distSegmento(px, py, ax, ay, bx, by, espessura) {
  const vx = bx - ax;
  const vy = by - ay;
  const t = Math.min(1, Math.max(0, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy)) - espessura / 2;
}

function amostrar(x, y, n) {
  // Coordenadas normalizadas em [-1, 1], com o centro do ícone na origem.
  const u = (2 * x) / n - 1;
  const v = (2 * y) / n - 1;

  const dentroFundo = distRoundRect(u, v, 1, 0.24) <= 0;
  if (!dentroFundo) return null;

  const t = Math.min(1, Math.max(0, (u + v + 2) / 4));
  const fundo = [0, 1, 2].map((i) => Math.round(COR_A[i] + (COR_B[i] - COR_A[i]) * t));

  // Glifo: nó superior-esquerdo → aresta → nó inferior-direito.
  const rNo = 0.2;
  const noA = Math.hypot(u + 0.34, v + 0.34) - rNo;
  const noB = Math.hypot(u - 0.34, v - 0.34) - rNo;
  const aresta = distSegmento(u, v, -0.34, -0.34, 0.34, 0.34, 0.15);
  const glifo = Math.min(noA, noB, aresta);

  return glifo <= 0 ? [255, 255, 255] : fundo;
}

function renderizar(n) {
  const SS = 4;
  const pixels = Buffer.alloc(n * n * 4);
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let cobertura = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const cor = amostrar(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS, n);
          if (cor === null) continue;
          r += cor[0];
          g += cor[1];
          b += cor[2];
          cobertura += 1;
        }
      }
      const i = (y * n + x) * 4;
      const total = SS * SS;
      if (cobertura === 0) continue; // fora do quadrado: transparente
      pixels[i] = Math.round(r / cobertura);
      pixels[i + 1] = Math.round(g / cobertura);
      pixels[i + 2] = Math.round(b / cobertura);
      pixels[i + 3] = Math.round((cobertura / total) * 255);
    }
  }
  return pixels;
}

/* ============================================================================
 * Codificação PNG (RGBA de 8 bits, sem filtro por linha)
 * ========================================================================== */

const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = TABELA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(tipo, dados) {
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([tamanho, corpo, crc]);
}

function png(n, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(n, 0);
  ihdr.writeUInt32BE(n, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // RGBA
  // 10..12 = compressão/filtro/entrelaçamento, todos 0

  // Cada scanline é prefixada pelo byte de filtro (0 = None).
  const bruto = Buffer.alloc(n * (n * 4 + 1));
  for (let y = 0; y < n; y += 1) {
    bruto[y * (n * 4 + 1)] = 0;
    pixels.copy(bruto, y * (n * 4 + 1) + 1, y * n * 4, (y + 1) * n * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(bruto, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  for (const n of TAMANHOS) {
    const arquivo = join(OUT, `icon${n}.png`);
    await writeFile(arquivo, png(n, renderizar(n)));
    console.log(`[icons] icon${n}.png`);
  }
  console.log(`[icons] Pronto em ${OUT}`);
}

main().catch((err) => {
  console.error('[icons] Falhou:', err);
  process.exit(1);
});
