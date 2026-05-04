/**
 * Página de teste visual da Fase 3 — confere que os tokens portados do BETA_2
 * funcionam como utilitárias do Tailwind e que a Inter está carregando local.
 *
 * Substituída na Fase 6 pelo App real (Header + Sidebar + FlowCanvas + painéis).
 */

interface Token {
  classe: string;
  rotulo: string;
  /** True para fundos claros que precisam de texto escuro para contraste. */
  claro?: boolean;
}

const FUNDOS: Token[] = [
  { classe: 'bg-fundo', rotulo: 'fundo', claro: true },
  { classe: 'bg-superficie', rotulo: 'superficie', claro: true },
  { classe: 'bg-superficie-2', rotulo: 'superficie-2', claro: true },
];

const ACENTOS: Token[] = [
  { classe: 'bg-destaque text-superficie', rotulo: 'destaque' },
  { classe: 'bg-destaque-suave text-destaque', rotulo: 'destaque-suave', claro: true },
  { classe: 'bg-ok text-superficie', rotulo: 'ok' },
  { classe: 'bg-ok-suave text-ok', rotulo: 'ok-suave', claro: true },
  { classe: 'bg-aviso text-superficie', rotulo: 'aviso' },
  { classe: 'bg-aviso-suave text-aviso', rotulo: 'aviso-suave', claro: true },
];

const ARESTAS: Token[] = [
  { classe: 'bg-aresta-atp text-superficie', rotulo: 'aresta-atp' },
  { classe: 'bg-aresta-pref text-superficie', rotulo: 'aresta-pref' },
  { classe: 'bg-aresta-manual text-superficie', rotulo: 'aresta-manual' },
];

function ChipsRow({ tokens }: { tokens: Token[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tokens.map((t) => (
        <span
          key={t.rotulo}
          className={[
            'inline-flex items-center px-3 h-7 rounded-md text-xs font-medium border border-borda',
            t.claro ? 'text-texto-2' : '',
            t.classe,
          ].join(' ')}
        >
          {t.rotulo}
        </span>
      ))}
    </div>
  );
}

export default function App() {
  return (
    <main className="min-h-screen bg-fundo p-8">
      <header className="mb-6">
        <div className="text-xs uppercase tracking-wider text-texto-3 font-semibold">
          Fase 3 · teste visual
        </div>
        <h1 className="text-xl font-semibold text-texto mt-1">PlanejoEproc</h1>
        <p className="text-sm text-texto-2 mt-1">
          Tokens portados do BETA_2 · Inter local · família mono em fallback de sistema.
        </p>
      </header>

      <section className="space-y-5 max-w-3xl">
        <div>
          <div className="text-xs uppercase tracking-wider text-texto-3 font-semibold mb-2">
            Estrutura
          </div>
          <ChipsRow tokens={FUNDOS} />
        </div>

        <div>
          <div className="text-xs uppercase tracking-wider text-texto-3 font-semibold mb-2">
            Acentos
          </div>
          <ChipsRow tokens={ACENTOS} />
        </div>

        <div>
          <div className="text-xs uppercase tracking-wider text-texto-3 font-semibold mb-2">
            Tipos de aresta
          </div>
          <ChipsRow tokens={ARESTAS} />
        </div>

        <div>
          <div className="text-xs uppercase tracking-wider text-texto-3 font-semibold mb-2">
            Tipografia
          </div>
          <div className="space-y-1 bg-superficie border border-borda rounded-md p-4">
            <div className="text-base font-normal">Inter 400 — corpo de texto.</div>
            <div className="text-base font-medium">Inter 500 — ênfase média.</div>
            <div className="text-base font-semibold">Inter 600 — títulos.</div>
            <div className="text-base font-bold">Inter 700 — destaque máximo.</div>
            <div className="text-sm font-mono text-texto-2 mt-2">
              JetBrains Mono → <span className="text-texto">fallback ui-monospace</span>{' '}
              (não embutido).
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
