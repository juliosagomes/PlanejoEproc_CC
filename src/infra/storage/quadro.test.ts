import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, type Plano } from '@/domain';
import { PlanoSchema } from './schema';

// D-38: notas, entradas e regras penduradas são opcionais e sem bump — o plano
// gravado antes delas continua validando, e o novo volta inteiro.
describe('plano com as peças do D-38', () => {
  const plano: Plano = {
    version: SCHEMA_VERSION,
    planoNome: 'Triagem',
    flowMode: 'sharp',
    flags: [],
    nodes: [
      {
        id: 'pi',
        position: { x: 0, y: 0 },
        data: {
          nome: 'PETIÇÃO INICIAL',
          ja_criado: true,
          flags: [],
          regrasSemMover: [
            {
              id: 'r1',
              categoria: 'Regra de ATP',
              nome: 'Regra 92',
              ja_criado: false,
              efeito: 'automatica',
              destino: '‎',
              atp: { implantar: false, trigger: { tipo: 'E', eventoIds: ['1'] } },
            },
          ],
        },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'ev1',
        target: 'pi',
        data: { kind: 'atp', resumo: '', observacao: '', subitems: [] },
      },
    ],
    notas: [{ id: 'nt1', position: { x: 10, y: 10 }, texto: 'Regra 54 e 55' }],
    entradas: [{ id: 'ev1', position: { x: -200, y: 0 }, rotulo: 'Classe Processual Retificada' }],
  };

  it('faz o round-trip sem perda', () => {
    const r = PlanoSchema.safeParse(JSON.parse(JSON.stringify(plano)));
    expect(r.success).toBe(true);
    expect(r.success && r.data).toEqual(plano);
  });

  it('recusa grupo desconhecido na regra pendurada', () => {
    const ruim = JSON.parse(JSON.stringify(plano));
    ruim.nodes[0].data.regrasSemMover[0].efeito = 'outra';
    expect(PlanoSchema.safeParse(ruim).success).toBe(false);
  });
});
