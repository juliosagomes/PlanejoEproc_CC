import { describe, expect, it } from 'vitest';
import type { RegraAtpUnidade } from '@/domain';
import { conferirRegra, regraDoEproc } from './conferirRegra';

const r182: RegraAtpUnidade = {
  numero: 182,
  ativa: true,
  tipoOrigem: 'nenhum',
  origens: [],
  destinos: ['Vista Laudo ➡️ MP ⏳', '🟢Sistema AJ'],
  filtroContem: ['Ag. Laudo Pericial ⏳'],
  tipoControle: 'Por Evento ou Petição ou Documento',
  detalhe: {
    implantar: false,
    trigger: { tipo: 'A', peticaoTipoIds: ['48'] },
    acoes: [{ id: 'eproc-1', tipo: 'LBT', parametros: { Validade: 30 } }],
  },
};
const pontas = { origem: 'Ag. Laudo Pericial ⏳', destino: 'Vista Laudo ➡️ MP ⏳' };

describe('conferirRegra (D-46)', () => {
  it('monta a regra do Eproc relativa às pontas, sem tocar implantar e observações', () => {
    const r = regraDoEproc(r182, { implantar: true, observacoes: 'minha nota' }, pontas);
    expect(r).toMatchObject({
      implantar: true,
      observacoes: 'minha nota',
      outrosDestinos: ['🟢Sistema AJ'],
      trigger: { tipo: 'A', peticaoTipoIds: ['48'] },
    });
    expect(r.outrasOrigens).toBeUndefined();
  });

  it('confere depois de preencher, e aponta o campo mudado à mão', () => {
    const preenchida = regraDoEproc(r182, undefined, pontas);
    expect(conferirRegra(r182, preenchida, pontas)).toEqual({ pontas: [], campos: [], comDetalhe: true });

    const mexida = { ...preenchida, acoes: [{ id: 'x', tipo: 'LBT', parametros: { Validade: 15 } }] };
    const c = conferirRegra(r182, mexida, pontas);
    expect(c.campos.map((d) => d.label)).toEqual(['Ação programada']);
  });

  it('ponta diferente só avisa; sem detalhe, só as pontas', () => {
    const c = conferirRegra({ ...r182, detalhe: undefined }, undefined, { ...pontas, destino: 'Outro' });
    expect(c.comDetalhe).toBe(false);
    expect(c.pontas).toEqual(['No Eproc o destino é Vista Laudo ➡️ MP ⏳ E 🟢Sistema AJ.']);
  });
});
