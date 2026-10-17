import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCanvasStore } from '@/features/canvas/store';
import { listMapas, loadMapa, setEscopo } from '@/infra/storage';
import { flushMapas, useMapasStore } from './store';

const acoes = () => useMapasStore.getState();

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  setEscopo({ tipo: 'local' });
  useCanvasStore.setState({ somenteLeitura: false });
  acoes().hidratar();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('store dos mapas', () => {
  it('criar grava e abre o mapa novo, nos dois formatos', () => {
    acoes().criar('retrato');
    acoes().criar('paisagem');
    expect(acoes().aberto?.formato).toBe('paisagem');
    expect(listMapas().map((e) => e.formato).sort()).toEqual(['paisagem', 'retrato']);
  });

  it('a edição espera a digitação parar, e o flush grava na hora', () => {
    acoes().criar('retrato');
    const id = acoes().aberto!.id;
    acoes().mudar((m) => (m.formato === 'retrato' ? { ...m, html: '<p>novo</p>' } : m));
    const antes = loadMapa(id);
    expect(antes?.formato === 'retrato' && antes.html).not.toBe('<p>novo</p>');
    flushMapas();
    const gravado = loadMapa(id);
    expect(gravado?.formato === 'retrato' && gravado.html).toBe('<p>novo</p>');
  });

  it('trocar de mapa grava o que estava pendente no anterior', () => {
    acoes().criar('retrato');
    const primeiro = acoes().aberto!.id;
    acoes().criar('paisagem');
    acoes().abrir(primeiro);
    acoes().renomear('Manual da secretaria');
    const segundo = acoes().indice.find((e) => e.id !== primeiro)!.id;
    acoes().abrir(segundo);
    expect(loadMapa(primeiro)?.nome).toBe('Manual da secretaria');
  });

  it('excluir o aberto abre o próximo e devolve o mapa para o desfazer', () => {
    acoes().criar('retrato');
    acoes().criar('paisagem');
    const aberto = acoes().aberto!;
    const excluido = acoes().excluir(aberto.id);
    expect(excluido?.id).toBe(aberto.id);
    expect(acoes().aberto?.id).not.toBe(aberto.id);
    acoes().restaurar(excluido!);
    expect(listMapas()).toHaveLength(2);
  });

  it('em sessão de visualização nada grava (D-19)', () => {
    acoes().criar('retrato');
    const id = acoes().aberto!.id;
    useCanvasStore.setState({ somenteLeitura: true });
    acoes().criar('paisagem');
    acoes().renomear('não pode');
    flushMapas();
    expect(acoes().excluir(id)).toBeNull();
    expect(listMapas()).toHaveLength(1);
    expect(loadMapa(id)?.nome).toBe('Documento sem título');
  });

  it('trocar de silo traz os mapas daquele silo', () => {
    acoes().criar('retrato');
    setEscopo({ tipo: 'lotacao', workspaceId: 'w1' });
    acoes().hidratar();
    expect(acoes().indice).toEqual([]);
    expect(acoes().aberto).toBeNull();
  });
});
