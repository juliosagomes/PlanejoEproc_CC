import type { DobraAresta } from '@/domain';

/* ============================================================================
 * GEOMETRIA DO COTOVELO (modo Diagrama) — ver decisoes.md#D-21
 *
 * O `getSmoothStepPath` do ReactFlow aceita `centerX`/`centerY` como override
 * do ponto onde a linha ortogonal dobra; sem eles, usa o meio geométrico. Este
 * módulo é a ponte entre o que guardamos no plano e essas coordenadas, mais a
 * matemática inversa (arrastar) e a geometria do segmento que vira alça.
 *
 * Replica o ramo de "handles opostos" do `getPoints` do ReactFlow 11.11
 * (`node_modules/@reactflow/core/dist/esm/index.js`) para o único caso que o
 * app produz: origem em `Position.Right`, destino em `Position.Left` — é só o
 * que `LocalizadorNode` expõe. Se um dia houver alça em cima ou embaixo, este
 * arquivo precisa ser revisto junto; há teste de contrato com a lib para que
 * uma divergência apareça como falha, e não como seta torta na tela.
 *
 * Fica fora do componente porque é o único jeito de testá-lo: o projeto não
 * tem @testing-library, então só lógica pura e store são cobertas.
 * ========================================================================== */

/**
 * Mesmo default do `getSmoothStepPath`. Passado explicitamente na chamada para
 * que a conta daqui e a de lá não possam divergir num upgrade da lib.
 */
export const OFFSET_SMOOTHSTEP = 20;

/**
 * Abaixo disto o segmento é curto demais para servir de alvo, e mexer nele não
 * muda o desenho — a alça não é renderizada.
 */
export const MIN_SEGMENTO_ARRASTAVEL = 12;

export interface GeometriaAresta {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}

/**
 * `vertical` — o segmento do cotovelo é vertical e o parâmetro livre é
 * `centerX` (destino folgadamente à direita).
 * `horizontal` — o segmento é horizontal e o parâmetro livre é `centerY`
 * (destino atrás da origem, ou perto demais).
 */
export type OrientacaoDobra = 'vertical' | 'horizontal';

export interface SegmentoDobra {
  orientacao: OrientacaoDobra;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  comprimento: number;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Espelha o `getDirection` do ReactFlow, que compara os pontos **já deslocados
 * pelo offset** — daí a folga dos dois lados, e não um simples
 * `targetX > sourceX`. Empate exato cai em `horizontal`, como na lib (o teste
 * `<` é estrito).
 */
export function orientacaoDaDobra(g: GeometriaAresta): OrientacaoDobra {
  return g.sourceX + OFFSET_SMOOTHSTEP < g.targetX - OFFSET_SMOOTHSTEP
    ? 'vertical'
    : 'horizontal';
}

/** O vão onde o segmento vertical pode andar: entre as duas alças, com folga. */
export function vaoHorizontal(g: GeometriaAresta): { a: number; b: number } {
  return { a: g.sourceX + OFFSET_SMOOTHSTEP, b: g.targetX - OFFSET_SMOOTHSTEP };
}

/**
 * Fração -> abscissa. Grampeada em [0,1]: deixar o cotovelo passar por trás do
 * cartão de origem faz a seta sair à direita, voltar por cima do próprio nó e
 * só então seguir — desenho que ninguém quer e que o roteador não desvia.
 */
export function xDaFracao(fracao: number, g: GeometriaAresta): number {
  const { a, b } = vaoHorizontal(g);
  return a + clamp01(fracao) * (b - a);
}

/**
 * Abscissa -> fração. O vão é positivo por construção sempre que a orientação
 * é `vertical` (é a própria condição que escolhe esse ramo), mas a guarda
 * existe para dado vindo de um plano gravado sob outro layout: sem ela seria
 * `NaN`.
 */
export function fracaoDaDobra(x: number, g: GeometriaAresta): number {
  const { a, b } = vaoHorizontal(g);
  if (a === b) return 0.5;
  return clamp01((x - a) / (b - a));
}

/** Desvio -> ordenada, a partir da linha média entre as duas alças. */
export function yDoDesvio(desvio: number, g: GeometriaAresta): number {
  return (g.sourceY + g.targetY) / 2 + desvio;
}

/**
 * Ordenada -> desvio. Sem clamp de propósito: esticar o laço para longe da
 * linha média é exatamente o recurso quando a seta volta para trás.
 */
export function desvioDaDobra(y: number, g: GeometriaAresta): number {
  return y - (g.sourceY + g.targetY) / 2;
}

/**
 * O centro que vai para o `getSmoothStepPath` — **só o eixo da orientação
 * ativa**, nunca os dois.
 *
 * Motivo sutil: o `getPoints` devolve `centerX` e `centerY` como `labelX` e
 * `labelY` independentemente de qual split escolheu. Passar `centerY` estando
 * no split vertical não muda o caminho, mas faz o **rótulo pular** para aquela
 * altura. Como o eixo ocioso é preservado no plano (ver `dobraComArrasto`),
 * essa combinação acontece de verdade: basta o usuário ajustar os dois eixos
 * em layouts diferentes e voltar ao primeiro.
 */
export function centroDaDobra(
  g: GeometriaAresta,
  dobra: DobraAresta | undefined,
): { centerX?: number; centerY?: number } {
  if (orientacaoDaDobra(g) === 'vertical') {
    return dobra?.fracaoX === undefined ? {} : { centerX: xDaFracao(dobra.fracaoX, g) };
  }
  return dobra?.desvioY === undefined ? {} : { centerY: yDoDesvio(dobra.desvioY, g) };
}

/**
 * Os dois extremos do segmento arrastável — o cotovelo que o usuário agarra.
 * Espelha os `verticalSplit`/`horizontalSplit` do `getPoints`.
 */
export function segmentoDaDobra(
  g: GeometriaAresta,
  dobra: DobraAresta | undefined,
): SegmentoDobra {
  if (orientacaoDaDobra(g) === 'vertical') {
    const cx = xDaFracao(dobra?.fracaoX ?? 0.5, g);
    return {
      orientacao: 'vertical',
      x1: cx,
      y1: g.sourceY,
      x2: cx,
      y2: g.targetY,
      comprimento: Math.abs(g.targetY - g.sourceY),
    };
  }
  const cy = yDoDesvio(dobra?.desvioY ?? 0, g);
  const { a, b } = vaoHorizontal(g);
  return {
    orientacao: 'horizontal',
    x1: a,
    y1: cy,
    x2: b,
    y2: cy,
    comprimento: Math.abs(b - a),
  };
}

/**
 * `false` quando mexer no cotovelo não mudaria o desenho — dois nós na mesma
 * altura com o destino à direita desenham uma reta, e ali a alça só roubaria o
 * clique de quem quer selecionar a aresta.
 */
export function dobraArrastavel(g: GeometriaAresta): boolean {
  return segmentoDaDobra(g, undefined).comprimento >= MIN_SEGMENTO_ARRASTAVEL;
}

/**
 * Aplica o deslocamento do ponteiro (já convertido para unidades de fluxo) à
 * dobra, no eixo da orientação ativa.
 *
 * O eixo ocioso é mantido de propósito: quando o usuário arrasta um
 * localizador para o outro lado, a orientação troca, e desfazer esse movimento
 * precisa trazer o ajuste antigo de volta em vez de encontrá-lo apagado.
 */
export function dobraComArrasto(
  g: GeometriaAresta,
  inicial: DobraAresta | undefined,
  delta: { dx: number; dy: number },
): DobraAresta {
  if (orientacaoDaDobra(g) === 'vertical') {
    const x = xDaFracao(inicial?.fracaoX ?? 0.5, g) + delta.dx;
    return { ...inicial, fracaoX: fracaoDaDobra(x, g) };
  }
  return { ...inicial, desvioY: (inicial?.desvioY ?? 0) + delta.dy };
}

/** `true` quando a aresta tem algum ajuste manual — controla o botão de reset. */
export function temDobraManual(dobra: DobraAresta | undefined): boolean {
  return dobra?.fracaoX !== undefined || dobra?.desvioY !== undefined;
}
