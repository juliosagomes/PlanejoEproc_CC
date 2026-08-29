import type { CSSProperties, ReactNode } from 'react';
import type { EdgeKind } from '@/domain';
import { cn } from '@/utils/cn';

/* ============================================================================
 * PEÇAS DAS ILUSTRAÇÕES
 *
 * As cenas do tutorial são montadas com as MESMAS classes CSS do app real —
 * `.pj-node`, `.edge-label`, `.edge-tooltip`, `.subitem`, `.edge-swatch`,
 * `.input`, `.btn`. Sai idêntico ao produto, custa zero byte de CSS (as classes
 * já existem em `src/index.css`) e acompanha mudança de tema sem manutenção
 * paralela.
 *
 * ┌─ MANUTENÇÃO ────────────────────────────────────────────────────────────┐
 * │ Classes emprestadas daqui: pj-node / not-created / created / selected,  │
 * │ ok-corner, pj-node-name, pj-node-desc, react-flow__handle, edge-label,  │
 * │ edge-tooltip, edge-swatch (+ .line/.active), subitem, pj-check, input,  │
 * │ textarea, select, label, section-h, btn (+ variantes).                  │
 * │ Renomeou alguma delas? Passe o grep aqui também — o tutorial não tem    │
 * │ teste de render que avise.                                              │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * O que NÃO dá para reusar, e por quê:
 *  - `LocalizadorNode` renderiza `<Handle>` do ReactFlow: fora do
 *    `ReactFlowProvider` (que só envolve o `FlowCanvas`) ele quebra.
 *  - `PjEdge` chama `useReactFlow()` e recebe geometria calculada pelo canvas.
 *  - `LocalizadorNomeInput` portaliza o menu do react-select em `zIndex: 60`,
 *    acima do `.modal` (51) — o menu escaparia por cima da moldura do slide.
 * Daí as cópias fiéis abaixo, em HTML puro.
 * ========================================================================== */

/** Cores do traço, iguais às de `EDGE_STYLES` em `features/canvas/.../PjEdge.tsx`. */
const TRACO: Record<EdgeKind, { cor: string; largura: number; dash?: string }> = {
  atp: { cor: 'var(--aresta-atp)', largura: 1.8, dash: '6 4' },
  pref: { cor: 'var(--aresta-pref)', largura: 1.8 },
  manual: { cor: 'var(--aresta-manual)', largura: 1.6, dash: '4 4' },
};

const ROTULO_CURTO: Record<EdgeKind, string> = {
  atp: 'ATP',
  pref: 'Pref.',
  manual: 'Manual',
};

/**
 * Área de desenho de **altura fixa**.
 *
 * Fixa porque o `.modal` se dimensiona pelo conteúdo: com palcos de alturas
 * diferentes, o modal cresceria e encolheria a cada "Próximo" e o botão fugiria
 * de debaixo do cursor.
 */
export function Palco({
  children,
  grade = false,
  altura = 196,
}: {
  children: ReactNode;
  /** Grade pontilhada do canvas, para as cenas que acontecem nele. */
  grade?: boolean;
  altura?: number;
}) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-lg border border-borda"
      style={{
        height: altura,
        background: grade
          ? 'radial-gradient(var(--grade-ponto) 1px, transparent 1px) 0 0 / 16px 16px, var(--fundo)'
          : 'var(--fundo)',
      }}
    >
      {/* Caixa interna de largura fixa: as cenas posicionam por coordenada
          absoluta, e sem um referencial estável cada uma se desmontaria numa
          largura de janela diferente. Centralizada, uma janela estreita corta
          simétrico em vez de empurrar tudo para um lado. */}
      <div
        className="absolute top-0"
        style={{ left: '50%', transform: 'translateX(-50%)', width: LARGURA_CENA, height: '100%' }}
      >
        {children}
      </div>
    </div>
  );
}

/** Referencial das coordenadas de todas as cenas. */
export const LARGURA_CENA = 520;

/** Posiciona qualquer peça dentro do `Palco`. */
export function Em({
  children,
  ...pos
}: { children: ReactNode } & Pick<CSSProperties, 'left' | 'top' | 'right' | 'bottom'>) {
  return (
    <div className="absolute" style={pos}>
      {children}
    </div>
  );
}

/**
 * Cópia estática do `LocalizadorNode`. `criado` reproduz o estado que o usuário
 * vê ao escolher um localizador do catálogo: borda verde e o sinal no canto.
 */
export function NoFalso({
  nome,
  descricao,
  criado = false,
  largura = 168,
}: {
  nome: string;
  descricao?: string;
  criado?: boolean;
  largura?: number;
}) {
  return (
    <div
      className={cn('pj-node', criado ? 'created' : 'not-created')}
      style={{ width: largura, minWidth: 0 }}
    >
      {criado && (
        <span className="ok-corner">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
            <path
              d="m2 5.2 2 2 4-4.4"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )}
      <div className="pj-node-name">{nome}</div>
      {descricao !== undefined && <div className="pj-node-desc">{descricao}</div>}
    </div>
  );
}

/** Alça de conexão. A classe é estilizada pelo próprio `index.css:238`. */
export function Alca({ destacada = false, ...pos }: {
  destacada?: boolean;
} & Pick<CSSProperties, 'left' | 'top' | 'right'>) {
  return (
    <span
      className="react-flow__handle absolute"
      style={{
        ...pos,
        borderRadius: 999,
        ...(destacada
          ? { borderColor: 'var(--destaque)', background: 'var(--destaque-suave)' }
          : {}),
      }}
      aria-hidden
    />
  );
}

/**
 * Curva entre dois pontos, no mesmo traço da aresta real.
 *
 * A ATP fica **estática** aqui de propósito: o `<animate>` do `PjEdge` não
 * respeita `prefers-reduced-motion`, e movimento não é assunto de nenhum passo.
 */
export function LinhaAresta({
  de,
  para,
  kind,
}: {
  de: { x: number; y: number };
  para: { x: number; y: number };
  kind: EdgeKind;
}) {
  const t = TRACO[kind];
  const meio = (de.x + para.x) / 2;
  const d = `M ${de.x},${de.y} C ${meio},${de.y} ${meio},${para.y} ${para.x},${para.y}`;
  const seta = `seta-${kind}`;
  return (
    <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
      <defs>
        <marker
          id={seta}
          markerWidth="7"
          markerHeight="7"
          refX="6"
          refY="3.5"
          orient="auto"
        >
          <path d="M0,0 L7,3.5 L0,7 z" fill={t.cor} />
        </marker>
      </defs>
      <path
        d={d}
        fill="none"
        stroke={t.cor}
        strokeWidth={t.largura}
        strokeDasharray={t.dash}
        markerEnd={`url(#${seta})`}
      />
    </svg>
  );
}

/**
 * Pílula do meio da aresta.
 *
 * A cor **não** vem da classe: `PjEdge.tsx:118` a aplica inline. Sem repetir
 * isso aqui, o rótulo sairia cinza e sem borda.
 */
export function RotuloAresta({ kind }: { kind: EdgeKind }) {
  const { cor } = TRACO[kind];
  return (
    <span className="edge-label" style={{ border: `1px solid ${cor}`, color: cor }}>
      {ROTULO_CURTO[kind]}
    </span>
  );
}

/**
 * Balão do hover.
 *
 * `absolute` inline, e não a `position: fixed` da classe: dentro do `.modal`,
 * que tem `transform`, o `fixed` resolve contra o modal por acidente de
 * especificação. Escrever o posicionamento explicita a intenção.
 */
export function BalaoResumo({
  texto,
  ...pos
}: { texto: string } & Pick<CSSProperties, 'left' | 'top'>) {
  return (
    <div className="edge-tooltip" style={{ position: 'absolute', ...pos }}>
      {texto}
    </div>
  );
}

/** Ponteiro do mouse — a única peça que não existe no app. */
export function Cursor({ ...pos }: Pick<CSSProperties, 'left' | 'top'>) {
  return (
    <svg
      className="absolute"
      style={{ ...pos, filter: 'drop-shadow(0 1px 2px rgba(20,22,28,.35))' }}
      width="17"
      height="17"
      viewBox="0 0 17 17"
      aria-hidden
    >
      <path
        d="M2 1.5 12.5 9H7.6l-1.9 4.6z"
        fill="var(--superficie)"
        stroke="var(--texto)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Marca "2×" do duplo clique. */
export function MarcaDuploClique({ ...pos }: Pick<CSSProperties, 'left' | 'top'>) {
  return (
    <span
      className="mono absolute"
      style={{
        ...pos,
        fontSize: 10,
        fontWeight: 600,
        color: 'var(--destaque)',
        background: 'var(--destaque-suave)',
        border: '1px solid var(--destaque-borda)',
        borderRadius: 999,
        padding: '1px 6px',
      }}
    >
      2×
    </span>
  );
}

/** Os três cartões de tipo, iguais aos do `EdgePanel`. */
export function TiposDeConexao({ ativo }: { ativo: EdgeKind }) {
  const opcoes: ReadonlyArray<{ kind: EdgeKind; label: string }> = [
    { kind: 'atp', label: 'ATP' },
    { kind: 'pref', label: 'Preferência' },
    { kind: 'manual', label: 'Manual' },
  ];
  return (
    <div className="grid grid-cols-3 gap-1.5" style={{ width: 260 }}>
      {opcoes.map((o) => (
        <div key={o.kind} className={cn('edge-swatch', o.kind, ativo === o.kind && 'active')}>
          <span className="line" />
          <span>{o.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Aviso da ficção dos passos 1 e 2. */
export function AvisoIlustracao() {
  return (
    <p className="mt-2 text-[10.5px] text-texto-3">
      Ilustração — o tutorial não grava nada nem altera o seu catálogo.
    </p>
  );
}
