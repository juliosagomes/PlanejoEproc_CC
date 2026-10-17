import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAPA_VERSION, type Mapa } from '@/domain';
import { setEscopo } from './escopo';
import { excluirMapa, listMapas, loadMapa, mapaKey, mapasIndexKey, saveMapa } from './mapas';
import { BACKUP_KEY_PREFIX } from './storage';

function retrato(id: string, atualizadoEm: string): Mapa {
  return {
    version: MAPA_VERSION,
    id,
    nome: `Manual ${id}`,
    criadoEm: '2026-10-16T10:00:00.000Z',
    atualizadoEm,
    formato: 'retrato',
    html: '<h1>Manual</h1><p>Vai para <span class="mencao" data-tipo="loc" data-chave="ag. replica">Ag. Réplica</span>.</p>',
  };
}

function paisagem(id: string): Mapa {
  return {
    version: MAPA_VERSION,
    id,
    nome: 'Rotina',
    criadoEm: '2026-10-16T10:00:00.000Z',
    atualizadoEm: '2026-10-16T11:00:00.000Z',
    origem: { planoId: 'p1', planoNome: 'Família', localizadores: 4 },
    formato: 'paisagem',
    slides: [
      {
        id: 's1',
        elementos: [
          { id: 'e1', tipo: 'texto', x: 10, y: 10, w: 300, h: 80, html: 'Título' },
          { id: 'e2', tipo: 'imagem', x: 400, y: 10, w: 200, h: 150, src: 'data:image/png;base64,AAAA' },
          {
            id: 'e3',
            tipo: 'fluxo',
            x: 10,
            y: 200,
            w: 900,
            h: 500,
            fluxo: {
              planoId: 'p1',
              planoNome: 'Família',
              nos: ['a', 'b'],
              fora: true,
              assinatura: 'abc',
              svg: '<svg></svg>',
              desenhadoEm: '2026-10-16T11:00:00.000Z',
            },
          },
        ],
      },
    ],
  };
}

beforeEach(() => {
  localStorage.clear();
  setEscopo(null);
  vi.restoreAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('mapas no storage', () => {
  it('não lê nem grava sem sessão', () => {
    expect(saveMapa(retrato('m1', '2026-10-16T10:00:00.000Z'))).toBe(false);
    expect(listMapas()).toEqual([]);
    expect(localStorage.length).toBe(0);
  });

  it('separa os silos: local e lotação não se misturam', () => {
    setEscopo({ tipo: 'local' });
    saveMapa(retrato('m1', '2026-10-16T10:00:00.000Z'));
    expect(mapaKey('m1')).toBe('planejoeproc:mapa:m1');
    setEscopo({ tipo: 'lotacao', workspaceId: 'w1' });
    expect(listMapas()).toEqual([]);
    expect(mapasIndexKey()).toBe('planejoeproc:lot:w1:mapas:index');
  });

  it('faz o round-trip dos dois formatos sem perda', () => {
    setEscopo({ tipo: 'local' });
    const a = retrato('m1', '2026-10-16T10:00:00.000Z');
    const b = paisagem('m2');
    saveMapa(a);
    saveMapa(b);
    expect(loadMapa('m1')).toEqual(a);
    expect(loadMapa('m2')).toEqual(b);
  });

  it('lista o mais recente primeiro, com o resumo de cada um', () => {
    setEscopo({ tipo: 'local' });
    saveMapa(retrato('m1', '2026-10-16T09:00:00.000Z'));
    saveMapa(paisagem('m2'));
    saveMapa(retrato('m3', '2026-10-16T12:00:00.000Z'));
    const lista = listMapas();
    expect(lista.map((e) => e.id)).toEqual(['m3', 'm2', 'm1']);
    expect(lista[1]?.resumo).toBe('1 slide · do plano Família');
    expect(lista[0]?.resumo).toBe('Documento');
  });

  it('regravar atualiza a linha do índice em vez de duplicar', () => {
    setEscopo({ tipo: 'local' });
    const m = retrato('m1', '2026-10-16T09:00:00.000Z');
    saveMapa(m);
    saveMapa({ ...m, nome: 'Novo nome', atualizadoEm: '2026-10-16T13:00:00.000Z' });
    expect(listMapas()).toHaveLength(1);
    expect(listMapas()[0]?.nome).toBe('Novo nome');
  });

  it('excluir tira o mapa e a linha do índice', () => {
    setEscopo({ tipo: 'local' });
    saveMapa(retrato('m1', '2026-10-16T09:00:00.000Z'));
    excluirMapa('m1');
    expect(loadMapa('m1')).toBeNull();
    expect(listMapas()).toEqual([]);
  });

  it('manda o mapa irreconhecível para o backup em vez de apagar', () => {
    setEscopo({ tipo: 'local' });
    saveMapa(retrato('m1', '2026-10-16T09:00:00.000Z'));
    localStorage.setItem('planejoeproc:mapa:m1', '{"formato":"outro"}');
    expect(loadMapa('m1')).toBeNull();
    const backup = Object.keys(localStorage).find((k) => k.startsWith(`${BACKUP_KEY_PREFIX}mapa:m1:`));
    expect(backup).toBeDefined();
    expect(localStorage.getItem('planejoeproc:mapa:m1')).toBeNull();
    expect(listMapas()).toEqual([]);
  });
});
