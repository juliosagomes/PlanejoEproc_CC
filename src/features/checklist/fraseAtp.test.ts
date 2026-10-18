import { describe, expect, it } from 'vitest';
import { EVENTOS, TIPOS_PETICAO } from '@/data';
import { estadoBlocosAtp, type AtpRule } from '@/domain';
import { fraseAtp, fraseHtml, frasePref, fraseTexto, type ContextoFrase } from './fraseAtp';

const ctx = { origem: 'Ag. Contestação', destino: 'Analisar Reconvenção' };
const texto = (r: AtpRule | undefined, c: ContextoFrase = ctx) => fraseTexto(fraseAtp(r, c));

const evento = EVENTOS[0]!;
const peticao = TIPOS_PETICAO[0]!;

describe('fraseAtp', () => {
  it('regra em branco: diz o que falta, no lugar certo', () => {
    expect(texto(undefined)).toBe(
      'Quando [falta tipo de controle], o processo que estiver em Ag. Contestação vai para Analisar Reconvenção e [falta comportamento da origem].',
    );
  });

  it('regra completa por petição, com polo e ação programada', () => {
    const r: AtpRule = {
      implantar: true,
      comportamentoOrigem: '0',
      trigger: { tipo: 'P', peticaoTipoIds: [peticao.value], restringirA: 'A' },
      acoes: [{ id: 'a1', tipo: 'E', parametros: { txtEventoAutomatico: 'Concluso para despacho' } }],
    };
    expect(texto(r)).toBe(
      `Quando for juntada petição do tipo ${peticao.label} por PÓLO ATIVO, o processo que estiver em Ag. Contestação vai para Analisar Reconvenção e sai de Ag. Contestação. ` +
        'Então o Eproc executa Lançar evento automatizado (Evento Automatizado: Concluso para despacho).',
    );
  });

  it('várias origens sem a condição: a dúvida fica no lugar do "ou"', () => {
    const r: AtpRule = { implantar: false, outrasOrigens: ['B'], comportamentoOrigem: '3', trigger: { tipo: 'M' } };
    expect(texto(r)).toContain('em Ag. Contestação [falta “ou” ou “e”] em B vai para');
    expect(texto({ ...r, opcaoMultiplosLocalizadores: 'AND' })).toContain('ao mesmo tempo em Ag. Contestação e em B');
    expect(texto({ ...r, opcaoMultiplosLocalizadores: 'OR' })).toContain('continua também em Ag. Contestação e B');
  });

  it('tempo no localizador e periodicidade', () => {
    expect(texto({ implantar: false, trigger: { tipo: 'L', dias: 15, diasUteis: true } })).toMatch(/^Depois de 15 dias úteis no localizador, /);
    expect(texto({ implantar: false, trigger: { tipo: 'D', tipoData: 'S', diaSemana: '6' } })).toMatch(/^Todo sábado, /);
    expect(texto({ implantar: false, trigger: { tipo: 'D', tipoData: 'D', data: '2026-10-08' } })).toMatch(/^Em 08\/10\/2026, /);
  });

  it('muitos eventos avulsos viram "e outros N"', () => {
    const ids = EVENTOS.slice(0, 7).map((e) => e.value);
    const t = texto({ implantar: false, trigger: { tipo: 'E', eventoIds: ids } });
    expect(t).toContain('um dos eventos');
    expect(t).toContain('e outros 4');
  });

  it('regra pendurada não "vai para" o descarte', () => {
    const t = texto(
      { implantar: false, comportamentoOrigem: '3', trigger: { tipo: 'M' } },
      { origem: 'Cumprimento', destino: 'P', pendurada: { efeito: 'manual' } },
    );
    expect(t).toContain('em Cumprimento fica onde está (o destino P só preenche o campo que o Eproc exige)');
    expect(t).not.toContain('vai para');
  });

  it('o HTML escapa e marca valores e faltas', () => {
    const html = fraseHtml(fraseAtp(undefined, { origem: 'A <b>', destino: 'B' }));
    expect(html).toContain('<b>A &lt;b&gt;</b>');
    expect(html).toContain('<em>[falta tipo de controle]</em>');
  });
});

describe('estadoBlocosAtp', () => {
  it('as pendências são as mesmas faltas da frase', () => {
    const r: AtpRule = { implantar: false, trigger: { tipo: 'E' }, acoes: [{ id: 'x' }] };
    const e = estadoBlocosAtp(r);
    expect(e.regras).toBe('parcial');
    expect(e.acao).toBe('parcial');
    expect(e.filtros).toBe('vazio');
    const faltas = fraseAtp(r, ctx).filter((x) => x.tipo === 'falta').map((x) => x.texto);
    expect(new Set(faltas)).toEqual(new Set(e.pendencias.map((p) => `falta ${p.texto}`)));
  });

  it('completo quando Regras está preenchido; ação e filtro vazios não pendem', () => {
    const e = estadoBlocosAtp({ implantar: false, comportamentoOrigem: '1', trigger: { tipo: 'E', eventoIds: [evento.value] } });
    expect(e).toMatchObject({ regras: 'completo', acao: 'vazio', filtros: 'vazio', pendencias: [] });
  });

  it('regra em branco é vazia, não parcial', () => {
    expect(estadoBlocosAtp(undefined).regras).toBe('vazio');
  });
});

describe('frasePref', () => {
  it('tipo, efeito e conteúdo da minuta', () => {
    const t = fraseTexto(frasePref({ implantar: true, tipo: 'Minuta', acao: 'gera despacho', minutaModo: 'modelo', minutaConteudo: 'Despacho X' }));
    expect(t).toBe('Preferência de minuta: gera despacho. Usa o modelo Despacho X.');
  });
});
