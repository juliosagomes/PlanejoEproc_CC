import { describe, expect, it } from 'vitest';
import { getSmoothStepPath, Position } from 'reactflow';
import {
  centroDaDobra,
  desvioDaDobra,
  dobraArrastavel,
  dobraComArrasto,
  fracaoDaDobra,
  orientacaoDaDobra,
  segmentoDaDobra,
  temDobraManual,
  vaoHorizontal,
  xDaFracao,
  yDoDesvio,
  MIN_SEGMENTO_ARRASTAVEL,
  OFFSET_SMOOTHSTEP,
  type GeometriaAresta,
} from './dobra';

/** Destino folgadamente à direita e mais abaixo → cotovelo vertical. */
const VERTICAL: GeometriaAresta = { sourceX: 100, sourceY: 100, targetX: 400, targetY: 300 };
/** Destino atrás da origem, mesma altura → cotovelo horizontal. É a seta que
 *  volta para trás, o caso que mais pede o ajuste manual. */
const HORIZONTAL: GeometriaAresta = { sourceX: 400, sourceY: 200, targetX: 100, targetY: 200 };

describe('orientacaoDaDobra', () => {
  it('é vertical quando o destino está folgadamente à direita', () => {
    expect(orientacaoDaDobra(VERTICAL)).toBe('vertical');
  });

  it('é horizontal quando o destino está atrás da origem', () => {
    expect(orientacaoDaDobra(HORIZONTAL)).toBe('horizontal');
  });

  // A lib compara os pontos já afastados pelo offset dos dois lados, com teste
  // estrito — o empate exato cai no ramo horizontal. É o detalhe fácil de
  // errar ao replicar o `getDirection`.
  it('trata o empate exato como horizontal, igual à lib', () => {
    const g = (targetX: number): GeometriaAresta => ({
      sourceX: 100,
      sourceY: 0,
      targetX,
      targetY: 50,
    });
    expect(orientacaoDaDobra(g(100 + 2 * OFFSET_SMOOTHSTEP - 1))).toBe('horizontal');
    expect(orientacaoDaDobra(g(100 + 2 * OFFSET_SMOOTHSTEP))).toBe('horizontal');
    expect(orientacaoDaDobra(g(100 + 2 * OFFSET_SMOOTHSTEP + 1))).toBe('vertical');
  });
});

describe('eixo x — fração', () => {
  it('fração 0.5 cai exatamente no meio geométrico, que é o automático', () => {
    // Os offsets se cancelam: midpoint(sx+off, tx-off) === (sx+tx)/2.
    expect(xDaFracao(0.5, VERTICAL)).toBe((VERTICAL.sourceX + VERTICAL.targetX) / 2);
  });

  it('0 e 1 encostam nas duas pontas do vão', () => {
    const { a, b } = vaoHorizontal(VERTICAL);
    expect(xDaFracao(0, VERTICAL)).toBe(a);
    expect(xDaFracao(1, VERTICAL)).toBe(b);
  });

  it('faz round-trip com fracaoDaDobra', () => {
    for (const f of [0, 0.25, 0.5, 0.75, 1]) {
      expect(fracaoDaDobra(xDaFracao(f, VERTICAL), VERTICAL)).toBeCloseTo(f);
    }
  });

  // Grampeada porque deixar o cotovelo passar por trás do cartão faria a seta
  // sair à direita e voltar por cima do próprio nó.
  it('grampeia nas duas direções, na leitura e na escrita', () => {
    expect(fracaoDaDobra(-9999, VERTICAL)).toBe(0);
    expect(fracaoDaDobra(9999, VERTICAL)).toBe(1);
    expect(xDaFracao(-3, VERTICAL)).toBe(xDaFracao(0, VERTICAL));
    expect(xDaFracao(3, VERTICAL)).toBe(xDaFracao(1, VERTICAL));
  });

  it('devolve o valor neutro em vez de NaN quando o vão é nulo', () => {
    const colados: GeometriaAresta = { sourceX: 0, sourceY: 0, targetX: 40, targetY: 0 };
    expect(vaoHorizontal(colados)).toEqual({ a: 20, b: 20 });
    expect(fracaoDaDobra(123, colados)).toBe(0.5);
  });
});

describe('eixo y — desvio', () => {
  it('desvio 0 cai na linha média, que é o automático', () => {
    expect(yDoDesvio(0, HORIZONTAL)).toBe(200);
  });

  it('faz round-trip com desvioDaDobra', () => {
    expect(desvioDaDobra(yDoDesvio(-80, HORIZONTAL), HORIZONTAL)).toBe(-80);
  });

  // Este é o teste que documenta por que o eixo y NÃO é fração: aqui origem e
  // destino têm a mesma altura, então uma fração do vão entre elas seria
  // sempre a mesma coordenada, e arrastar não moveria nada.
  it('funciona com origem e destino na mesma altura', () => {
    expect(HORIZONTAL.sourceY).toBe(HORIZONTAL.targetY);
    expect(yDoDesvio(-60, HORIZONTAL)).toBe(140);
    expect(yDoDesvio(60, HORIZONTAL)).toBe(260);
  });

  it('não grampeia — esticar o laço é o recurso', () => {
    expect(yDoDesvio(-500, HORIZONTAL)).toBe(-300);
  });
});

describe('centroDaDobra', () => {
  it('sem dobra não passa eixo nenhum, e a lib cai no automático', () => {
    expect(centroDaDobra(VERTICAL, undefined)).toEqual({});
    expect(centroDaDobra(HORIZONTAL, undefined)).toEqual({});
  });

  // Regressão: o getPoints devolve centerX e centerY como labelX/labelY
  // independentemente do split, então passar o eixo ocioso não mudaria o
  // caminho mas faria o rótulo pular.
  it('nunca devolve os dois eixos, mesmo com os dois gravados', () => {
    const dobra = { fracaoX: 0.2, desvioY: 90 };
    expect(centroDaDobra(VERTICAL, dobra)).toEqual({ centerX: xDaFracao(0.2, VERTICAL) });
    expect(centroDaDobra(HORIZONTAL, dobra)).toEqual({ centerY: yDoDesvio(90, HORIZONTAL) });
  });

  it('ignora o eixo que não é o da orientação ativa', () => {
    expect(centroDaDobra(VERTICAL, { desvioY: 90 })).toEqual({});
    expect(centroDaDobra(HORIZONTAL, { fracaoX: 0.2 })).toEqual({});
  });
});

describe('segmentoDaDobra', () => {
  it('no ramo vertical liga as alturas das duas alças', () => {
    const s = segmentoDaDobra(VERTICAL, { fracaoX: 0.25 });
    const cx = xDaFracao(0.25, VERTICAL);
    expect(s).toEqual({
      orientacao: 'vertical',
      x1: cx,
      y1: VERTICAL.sourceY,
      x2: cx,
      y2: VERTICAL.targetY,
      comprimento: 200,
    });
  });

  it('no ramo horizontal usa o vão com offset nas duas pontas', () => {
    const s = segmentoDaDobra(HORIZONTAL, { desvioY: -50 });
    expect(s).toEqual({
      orientacao: 'horizontal',
      x1: HORIZONTAL.sourceX + OFFSET_SMOOTHSTEP,
      y1: 150,
      x2: HORIZONTAL.targetX - OFFSET_SMOOTHSTEP,
      y2: 150,
      comprimento: 340,
    });
  });
});

describe('dobraArrastavel', () => {
  it('é falso quando o segmento vertical degenera (nós na mesma altura)', () => {
    expect(dobraArrastavel({ sourceX: 0, sourceY: 50, targetX: 300, targetY: 50 })).toBe(false);
  });

  it('é falso logo abaixo do mínimo e verdadeiro a partir dele', () => {
    const g = (targetY: number): GeometriaAresta => ({
      sourceX: 0,
      sourceY: 0,
      targetX: 300,
      targetY,
    });
    expect(dobraArrastavel(g(MIN_SEGMENTO_ARRASTAVEL - 1))).toBe(false);
    expect(dobraArrastavel(g(MIN_SEGMENTO_ARRASTAVEL))).toBe(true);
  });

  it('é verdadeiro no ramo horizontal mesmo com os nós na mesma altura', () => {
    expect(dobraArrastavel(HORIZONTAL)).toBe(true);
  });

  // Self-loop: a alça sai à direita do cartão e entra à esquerda dele mesmo,
  // ou seja, o destino fica atrás da origem. Cai no ramo horizontal e funciona
  // sem código especial.
  it('é verdadeiro num self-loop', () => {
    expect(dobraArrastavel({ sourceX: 300, sourceY: 100, targetX: 100, targetY: 100 })).toBe(
      true,
    );
  });
});

describe('dobraComArrasto', () => {
  it('converte o deslocamento em fração no ramo vertical', () => {
    const { a, b } = vaoHorizontal(VERTICAL);
    const d = dobraComArrasto(VERTICAL, undefined, { dx: (b - a) / 4, dy: 999 });
    expect(d.fracaoX).toBeCloseTo(0.75);
    expect(d.desvioY).toBeUndefined();
  });

  it('acumula o deslocamento no ramo horizontal', () => {
    const d = dobraComArrasto(HORIZONTAL, { desvioY: -20 }, { dx: 999, dy: -30 });
    expect(d.desvioY).toBe(-50);
  });

  it('preserva o eixo ocioso, para o ajuste voltar se o layout voltar', () => {
    expect(dobraComArrasto(VERTICAL, { desvioY: 42 }, { dx: 10, dy: 0 }).desvioY).toBe(42);
    expect(dobraComArrasto(HORIZONTAL, { fracaoX: 0.3 }, { dx: 0, dy: 10 }).fracaoX).toBe(0.3);
  });

  it('deslocamento zero é idempotente', () => {
    const inicial = { fracaoX: 0.3 };
    expect(dobraComArrasto(VERTICAL, inicial, { dx: 0, dy: 0 }).fracaoX).toBeCloseTo(0.3);
  });
});

describe('temDobraManual', () => {
  it('reconhece ausência de ajuste', () => {
    expect(temDobraManual(undefined)).toBe(false);
    expect(temDobraManual({})).toBe(false);
  });

  it('reconhece ajuste em qualquer um dos eixos', () => {
    expect(temDobraManual({ fracaoX: 0.5 })).toBe(true);
    expect(temDobraManual({ desvioY: 0 })).toBe(true);
  });
});

/* ----------------------------------------------------------------------------
 * Contrato com o ReactFlow.
 *
 * Tudo acima presume que replicamos corretamente o `getPoints` da lib: qual
 * ramo é escolhido, onde o offset entra, e que o rótulo fica no meio do
 * segmento arrastável. Se um upgrade mudar esse comportamento, é aqui que
 * aparece — e não como seta torta na tela do usuário.
 * -------------------------------------------------------------------------- */
describe('contrato com getSmoothStepPath', () => {
  const chamar = (g: GeometriaAresta, dobra?: Parameters<typeof centroDaDobra>[1]) =>
    getSmoothStepPath({
      ...g,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      borderRadius: 0,
      offset: OFFSET_SMOOTHSTEP,
      ...centroDaDobra(g, dobra),
    });

  it.each([
    ['vertical', VERTICAL],
    ['horizontal', HORIZONTAL],
  ])('sem dobra, o rótulo cai no meio do nosso segmento (%s)', (_nome, g) => {
    const [, labelX, labelY] = chamar(g);
    const s = segmentoDaDobra(g, undefined);
    expect(labelX).toBe((s.x1 + s.x2) / 2);
    expect(labelY).toBe((s.y1 + s.y2) / 2);
  });

  // Conferimos as coordenadas, não os comandos em volta: o `getBend` escolhe
  // entre `L`/`Q` conforme o raio, e prender o teste a essa escolha o faria
  // falhar por mudança de estilo em vez de mudança de geometria.
  it('com dobra no ramo vertical, o caminho passa pela abscissa que calculamos', () => {
    const dobra = { fracaoX: 0.2 };
    const [d] = chamar(VERTICAL, dobra);
    const s = segmentoDaDobra(VERTICAL, dobra);
    expect(s.x1).toBe(172); // 120 + 0.2 * (380 - 120)
    expect(d).toContain(`${s.x1},${s.y1}`);
    expect(d).toContain(`${s.x2},${s.y2}`);
  });

  it('com dobra no ramo horizontal, o caminho passa pela ordenada que calculamos', () => {
    const dobra = { desvioY: -70 };
    const [d] = chamar(HORIZONTAL, dobra);
    const s = segmentoDaDobra(HORIZONTAL, dobra);
    expect(s.y1).toBe(130); // 200 - 70
    expect(d).toContain(`${s.x1},${s.y1}`);
    expect(d).toContain(`${s.x2},${s.y2}`);
  });
});
