import { beforeEach, describe, expect, it } from 'vitest';
import { useCanvasStore } from '@/features/canvas/store';
import { loadPainel, setEscopo } from '@/infra/storage';
import { usePainelStore } from './store';

const acoes = () => usePainelStore.getState();
const painel = () => usePainelStore.getState().painel;

beforeEach(() => {
  localStorage.clear();
  setEscopo({ tipo: 'local' });
  useCanvasStore.setState({ somenteLeitura: false });
  acoes().hidratar();
});

describe('store do painel', () => {
  it('grava a cada mudança', () => {
    acoes().criarFila({ nome: ' TRIAGEM ', origem: 'relatorioGeral', setorId: 's1', ja_criado: false });
    expect(painel().filas[0]?.nome).toBe('TRIAGEM');
    expect(loadPainel()).toEqual(painel());
  });

  it('fila de qualquer das três telas leva grupo (D-37)', () => {
    acoes().criarFila({ nome: 'X', origem: 'areaMinutas', setorId: 's1', grupoId: 'g1', ja_criado: false });
    expect(painel().filas[0]?.grupoId).toBe('g1');
  });

  it('criar grupo com nome que já existe devolve o mesmo grupo', () => {
    const a = acoes().criarGrupo('Preferências de Secretaria');
    const b = acoes().criarGrupo('  preferencias de secretaria ');
    expect(b).toBe(a);
    expect(painel().grupos).toHaveLength(1);
  });

  it('não repete o localizador na fila, nem por diferença de maiúsculas', () => {
    acoes().criarFila({ nome: 'X', origem: 'relatorioGeral', setorId: 's1', ja_criado: false });
    const id = painel().filas[0]!.id;
    acoes().incluirLocalizador(id, 'Cumprir despacho');
    acoes().incluirLocalizador(id, 'cumprir DESPACHO');
    expect(painel().filas[0]?.localizadores).toEqual(['Cumprir despacho']);
    acoes().tirarLocalizador(id, 'CUMPRIR despacho');
    expect(painel().filas[0]?.localizadores).toEqual([]);
  });

  it('apagar o grupo solta as filas dele', () => {
    acoes().criarGrupo('Filas da Secretaria');
    const g = painel().grupos[0]!.id;
    acoes().criarFila({ nome: 'X', origem: 'relatorioGeral', setorId: 's1', grupoId: g, ja_criado: false });
    acoes().removerGrupo(g);
    expect(painel().grupos).toEqual([]);
    expect(painel().filas[0]).not.toHaveProperty('grupoId');
  });

  it('fora de propósito exige motivo e troca o anterior', () => {
    acoes().deixarDeFora('Arquivo', '   ');
    expect(painel().foraDasFilas).toEqual([]);
    acoes().deixarDeFora('Arquivo', 'a');
    acoes().deixarDeFora('arquivo', 'b');
    expect(painel().foraDasFilas).toEqual([{ nome: 'arquivo', motivo: 'b' }]);
    acoes().desfazerFora('ARQUIVO');
    expect(painel().foraDasFilas).toEqual([]);
  });

  it('em visualização não muda nem grava', () => {
    useCanvasStore.setState({ somenteLeitura: true });
    acoes().criarGrupo('Grupo');
    expect(painel().grupos).toEqual([]);
    expect(loadPainel()).toBeNull();
  });
});
