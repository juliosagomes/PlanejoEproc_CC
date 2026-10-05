import { z } from 'zod';
import { getStorage } from '@/infra/plataforma/storageLike';
import { prefixo } from './escopo';

/* ============================================================================
 * CÂMERA DO CANVAS POR PLANO
 *
 * Onde o usuário deixou a tela em cada plano, para que voltar a ele não herde a
 * posição do plano anterior. Mora **fora do `Plano`**: é estado de tela desta
 * máquina, e não viaja no export nem na sincronização — a câmera de um colega
 * não diz nada a outro.
 *
 * Uma chave por silo, com um mapa `planoId → câmera`. Com escopo porque ids de
 * plano são do silo; fora de sessão, leitura vazia e escrita no-op, como o
 * resto de `escopo.ts`.
 * ========================================================================== */

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

const CameraSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  zoom: z.number().positive().finite(),
});
const CamerasSchema = z.record(CameraSchema);

function camerasKey(): string | null {
  const p = prefixo();
  return p === null ? null : `${p}cameras`;
}

function ler(key: string): Record<string, Camera> {
  const raw = getStorage()?.getItem(key) ?? null;
  if (raw === null) return {};
  try {
    const parsed = CamerasSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

function gravar(key: string, mapa: Record<string, Camera>): void {
  try {
    if (Object.keys(mapa).length === 0) getStorage()?.removeItem(key);
    else getStorage()?.setItem(key, JSON.stringify(mapa));
  } catch (err) {
    console.warn('[cameras] Falha ao gravar a câmera do plano.', err);
  }
}

export function loadCamera(planoId: string): Camera | null {
  const key = camerasKey();
  if (key === null) return null;
  return ler(key)[planoId] ?? null;
}

export function saveCamera(planoId: string, camera: Camera): void {
  const key = camerasKey();
  if (key === null) return;
  const mapa = ler(key);
  mapa[planoId] = { x: camera.x, y: camera.y, zoom: camera.zoom };
  gravar(key, mapa);
}

export function esquecerCamera(planoId: string): void {
  const key = camerasKey();
  if (key === null) return;
  const mapa = ler(key);
  if (!(planoId in mapa)) return;
  delete mapa[planoId];
  gravar(key, mapa);
}

export function esquecerTodasCameras(): void {
  const key = camerasKey();
  if (key === null) return;
  try {
    getStorage()?.removeItem(key);
  } catch {
    // ignore
  }
}
