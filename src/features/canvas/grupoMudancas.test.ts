import { describe, expect, it } from 'vitest';
import { GRUPO_RECOLHIDO } from '@/domain';
import { moldurasParaFlow, type GrupoFlow } from './grupoMudancas';

const grupo = (recolhido: boolean): GrupoFlow => ({
  id: 'g1',
  rotulo: 'Gabinete',
  cor: 3,
  position: { x: 10, y: 20 },
  largura: 500,
  altura: 300,
  membros: ['n1'],
  ...(recolhido ? { recolhido } : {}),
});

describe('moldurasParaFlow (D-31)', () => {
  // Sem `width`/`height` no nó, o ReactFlow 11 perdia a medida da moldura a
  // cada render: ela ficava invisível e as setas do grupo recolhido sumiam.
  it('leva a medida no próprio nó, igual ao style, com o grupo expandido', () => {
    const [m] = moldurasParaFlow([grupo(false)], false);
    expect(m).toMatchObject({ width: 500, height: 300, style: { width: 500, height: 300 } });
  });

  it('recolhido, a medida é a do bloco', () => {
    const [m] = moldurasParaFlow([grupo(true)], false);
    expect(m).toMatchObject({
      width: GRUPO_RECOLHIDO.largura,
      height: GRUPO_RECOLHIDO.altura,
      style: { width: GRUPO_RECOLHIDO.largura, height: GRUPO_RECOLHIDO.altura },
    });
  });

  it('em visualização a moldura não arrasta', () => {
    expect(moldurasParaFlow([grupo(false)], true)[0]!.draggable).toBe(false);
    expect(moldurasParaFlow([grupo(false)], false)[0]!.draggable).toBe(true);
  });
});
