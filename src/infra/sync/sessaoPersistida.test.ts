import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PREFS_PADRAO,
  getPendente,
  getPrefs,
  getUltimaLotacao,
  getUltimaSincronizacao,
  getUltimaVerificacao,
  limparUltimaLotacao,
  marcarSincronizacao,
  marcarVerificacao,
  setPendente,
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
  it('só resta o intervalo de verificação', () => {
    // Se este teste falhar porque alguém devolveu `autoPush`, leia
    // decisoes.md#D-17 antes de "corrigir" o teste: publicar sem o usuário
    // mandar é justamente o que foi removido.
    expect(getPrefs()).toEqual(PREFS_PADRAO);
    expect(Object.keys(PREFS_PADRAO)).toEqual(['intervaloMin']);
  });

  it('grava e relê a escolha do usuário', () => {
    setPrefs({ intervaloMin: 60 });
    expect(getPrefs()).toEqual({ intervaloMin: 60 });
  });

  it('aceita intervalo nulo (verificação automática desligada)', () => {
    setPrefs({ intervaloMin: null });
    expect(getPrefs().intervaloMin).toBeNull();
  });

  it('cai no padrão quando o valor guardado é inválido', () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ intervaloMin: 7 }));
    expect(getPrefs()).toEqual(PREFS_PADRAO);
  });

  it('descarta as prefs antigas sem perder o intervalo escolhido', () => {
    // Quem já usava a extensão tem `autoPush`/`notificar` gravados; o schema
    // ignora chave desconhecida em vez de invalidar tudo e voltar ao padrão.
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ intervaloMin: 30, autoPush: true, notificar: false }),
    );
    expect(getPrefs()).toEqual({ intervaloMin: 30 });
  });
});

describe('marcas d’água', () => {
  it('a de sincronização nasce nula e registra o instante', () => {
    expect(getUltimaSincronizacao()).toBeNull();
    const quando = '2026-08-26T12:00:00.000Z';
    marcarSincronizacao(quando);
    expect(getUltimaSincronizacao()).toBe(quando);
  });

  it('rejeita string que não é data ISO', () => {
    localStorage.setItem('planejoeproc:sync:ultimo', JSON.stringify('ontem'));
    expect(getUltimaSincronizacao()).toBeNull();
  });

  it('verificação e sincronização são marcas separadas', () => {
    // Verificar não baixa nada (decisoes.md#D-17): se as duas fossem a mesma
    // chave, o popup diria "baixado agora há pouco" sem ter baixado.
    marcarVerificacao('2026-08-27T10:00:00.000Z');
    expect(getUltimaVerificacao()).toBe('2026-08-27T10:00:00.000Z');
    expect(getUltimaSincronizacao()).toBeNull();
  });
});

describe('novidade pendente', () => {
  it('nasce nula, guarda o resumo e some quando limpa', () => {
    expect(getPendente()).toBeNull();
    setPendente({ recebidos: 1, atualizados: 2, removidos: 0 });
    expect(getPendente()).toEqual({ recebidos: 1, atualizados: 2, removidos: 0 });
    setPendente(null);
    expect(getPendente()).toBeNull();
  });

  it('ignora shape inesperado em vez de propagar lixo para o popup', () => {
    localStorage.setItem('planejoeproc:sync:pendente', JSON.stringify({ oi: 1 }));
    expect(getPendente()).toBeNull();
  });
});
