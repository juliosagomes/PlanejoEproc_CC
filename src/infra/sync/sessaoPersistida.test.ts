import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PREFS_PADRAO,
  getPrefs,
  getUltimaLotacao,
  getUltimaSincronizacao,
  limparUltimaLotacao,
  marcarSincronizacao,
  setPrefs,
  setUltimaLotacao,
} from './sessaoPersistida';

const ULTIMA_KEY = 'planejoeproc:sessao:ultima';
const PREFS_KEY = 'planejoeproc:sync:prefs';

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('última lotação', () => {
  it('nasce vazia e sobrevive à gravação', () => {
    expect(getUltimaLotacao()).toBeNull();
    setUltimaLotacao('ws-1');
    expect(getUltimaLotacao()).toBe('ws-1');
  });

  it('limpar volta ao estado de modo local', () => {
    setUltimaLotacao('ws-1');
    limparUltimaLotacao();
    expect(getUltimaLotacao()).toBeNull();
  });

  it('ignora valor corrompido em vez de propagar lixo', () => {
    localStorage.setItem(ULTIMA_KEY, '{ não é json');
    expect(getUltimaLotacao()).toBeNull();
  });

  it('ignora shape inesperado', () => {
    localStorage.setItem(ULTIMA_KEY, JSON.stringify({ outraCoisa: 1 }));
    expect(getUltimaLotacao()).toBeNull();
  });
});

describe('preferências', () => {
  it('o padrão não envia automaticamente', () => {
    // Se este teste falhar, alguém tornou o push automático o comportamento
    // padrão — leia decisoes.md#D-13 antes de "corrigir" o teste.
    expect(getPrefs()).toEqual(PREFS_PADRAO);
    expect(PREFS_PADRAO.autoPush).toBe(false);
  });

  it('grava e relê a escolha do usuário', () => {
    setPrefs({ intervaloMin: 60, autoPush: true, notificar: false });
    expect(getPrefs()).toEqual({ intervaloMin: 60, autoPush: true, notificar: false });
  });

  it('aceita intervalo nulo (automático desligado)', () => {
    setPrefs({ ...PREFS_PADRAO, intervaloMin: null });
    expect(getPrefs().intervaloMin).toBeNull();
  });

  it('cai no padrão quando o valor guardado é inválido', () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ intervaloMin: 7, autoPush: 'sim' }));
    expect(getPrefs()).toEqual(PREFS_PADRAO);
  });
});

describe('marca da última sincronização', () => {
  it('nasce nula e registra o instante', () => {
    expect(getUltimaSincronizacao()).toBeNull();
    const quando = '2026-08-26T12:00:00.000Z';
    marcarSincronizacao(quando);
    expect(getUltimaSincronizacao()).toBe(quando);
  });

  it('rejeita string que não é data ISO', () => {
    localStorage.setItem('planejoeproc:sync:ultimo', JSON.stringify('ontem'));
    expect(getUltimaSincronizacao()).toBeNull();
  });
});
