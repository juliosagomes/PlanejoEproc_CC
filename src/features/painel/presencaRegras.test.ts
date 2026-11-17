import { describe, expect, it } from 'vitest';
import type { Edge, Localizador, RegraAtpUnidade, Subitem } from '@/domain';
import { presencaDasRegras, type PlanoDoSilo } from './presencaRegras';

const no = (id: string, nome: string, extra: Partial<Localizador['data']> = {}): Localizador => ({
  id,
  position: { x: 0, y: 0 },
  data: { nome, ja_criado: true, flags: [], ...extra },
});

const atp = (nome: string, extra: Partial<Subitem> = {}): Subitem => ({
  id: nome,
  categoria: 'Regra de ATP',
  nome,
  ja_criado: true,
  ...extra,
});

const aresta = (source: string, target: string, subitems: Subitem[]): Edge => ({
  id: `${source}-${target}`,
  source,
  target,
  data: { kind: 'atp', resumo: '', observacao: '', subitems },
});

const regra = (numero: number, r: Partial<RegraAtpUnidade> = {}): RegraAtpUnidade => ({
  numero,
  ativa: true,
  tipoOrigem: 'localizadores',
  origens: ['Ag. Laudo'],
  destinos: ['Dar Andamento ➡️➡️'],
  tipoControle: 'Por Evento',
  ...r,
});

const plano = (p: Partial<PlanoDoSilo['plano']>): PlanoDoSilo => ({
  id: 'p1',
  nome: 'Perícia',
  plano: { nodes: [], edges: [], ...p },
});

describe('presencaDasRegras (D-46)', () => {
  const nodes = [no('a', 'Ag. Laudo'), no('b', 'Dar Andamento ➡️ ➡️'), no('c', 'Outro')];

  it('nº vinculado confere por nome, ignorando emoji e espaço', () => {
    const p = plano({ nodes, edges: [aresta('a', 'b', [atp('Laudo juntado', { eprocAtp: 181 })])] });
    const r = presencaDasRegras([p], [regra(181), regra(182)]);
    expect(r.porNumero.get(181)?.estado).toBe('emPlano');
    expect(r.porNumero.get(182)?.estado).toBe('ausente');
  });

  it('nº escrito no nome também cita, e destino diferente diverge', () => {
    const p = plano({ nodes, edges: [aresta('a', 'c', [atp('Regra 181: laudo')])] });
    const r = presencaDasRegras([p], [regra(181)]);
    expect(r.porNumero.get(181)?.estado).toBe('divergente');
    expect(r.porNumero.get(181)?.citacoes[0]?.divergencias[0]).toMatch(/^Destino no Eproc/);
  });

  it('origem "Nenhum" confere pelo localizador do filtro', () => {
    const p = plano({ nodes, edges: [aresta('a', 'b', [atp('x', { eprocAtp: 182 })])] });
    const r = presencaDasRegras(
      [p],
      [regra(182, { tipoOrigem: 'nenhum', origens: [], filtroContem: ['Ag. Laudo'] })],
    );
    expect(r.porNumero.get(182)?.estado).toBe('emPlano');
  });

  it('pendurada confere quando o destino no Eproc é descarte; desativada sempre diverge', () => {
    const p = plano({
      nodes: [no('a', 'Ag. Laudo', { regrasSemMover: [{ ...atp('Regra 66'), categoria: 'Regra de ATP', efeito: 'automatica' }] })],
    });
    const ok = presencaDasRegras([p], [regra(66, { destinos: ['P'] })], ['P']);
    expect(ok.porNumero.get(66)?.estado).toBe('emPlano');
    const off = presencaDasRegras([p], [regra(66, { destinos: ['P'], ativa: false })], ['P']);
    expect(off.porNumero.get(66)?.citacoes[0]?.divergencias).toEqual(['Desativada no Eproc.']);
  });

  it('lista os nºs citados que o Eproc não tem', () => {
    const p = plano({ notas: [{ id: 'n', position: { x: 0, y: 0 }, texto: 'Regra 50 e 181' }] });
    const r = presencaDasRegras([p], [regra(181)]);
    expect(r.porNumero.get(181)?.estado).toBe('emPlano');
    expect(r.citadasInexistentes.map((c) => c.numero)).toEqual([50]);
  });
});
