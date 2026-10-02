import type { ReactNode } from 'react';

/* ============================================================================
 * Peças comuns aos modais de detalhamento de ATP e de Preferência.
 * ========================================================================== */

type CategoriaRegra = 'Regra de ATP' | 'Preferência';

interface FieldProps {
  label: string;
  ajuda?: string;
  className?: string;
  children: ReactNode;
}

export function Field({ label, ajuda, className, children }: FieldProps) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
      {ajuda && <div className="text-[11px] text-texto-3 mt-1">{ajuda}</div>}
    </div>
  );
}

/**
 * As duas caixas moram na mesma linha mas em lugares diferentes do dado:
 * `implantar` é da regra, e "já criado" é do recurso — é o mesmo checkbox da
 * linha do painel e do checklist (decisoes.md#D-24).
 */
interface ImplantarRowProps {
  implantar: boolean;
  jaCriado: boolean;
  setImplantar: (valor: boolean) => void;
  setJaCriado: (valor: boolean) => void;
  cat: CategoriaRegra;
}

export function ImplantarRow({
  implantar,
  jaCriado,
  setImplantar,
  setJaCriado,
  cat,
}: ImplantarRowProps) {
  return (
    <label
      className="flex items-center gap-2 cursor-pointer"
      style={{
        padding: '8px 10px',
        border: '1px solid var(--destaque-borda)',
        background: 'var(--destaque-suave)',
        borderRadius: 8,
      }}
    >
      <input
        type="checkbox"
        className="pj-check"
        checked={implantar}
        onChange={(e) => setImplantar(e.target.checked)}
      />
      <div className="flex-1">
        <div className="text-[13px] font-semibold">Implantar no checklist</div>
        <div className="text-[11.5px] text-texto-2">
          A {cat === 'Preferência' ? 'preferência' : 'regra'} entra como item próprio
          na seção "{cat}".
        </div>
      </div>
      <input
        type="checkbox"
        className="pj-check ml-auto"
        title="Já criado no Eproc"
        checked={jaCriado}
        onChange={(e) => setJaCriado(e.target.checked)}
      />
      <span className="mono text-[10.5px] text-texto-3">já criado</span>
    </label>
  );
}

interface RecursosResumoProps {
  comuns: number;
  outrasRegras: number;
  cat: CategoriaRegra;
}

/**
 * Diz o que o checklist vai fazer com os outros recursos da mesma aresta. A
 * resposta depende de haver ou não outra regra: com uma só, os recursos são
 * subitens dela; com duas ou mais, não há a quem pendurá-los, e cada um vai
 * para a própria seção (ver `features/checklist/derive.ts`).
 */
export function RecursosResumo({ comuns, outrasRegras, cat }: RecursosResumoProps) {
  if (comuns === 0 && outrasRegras === 0) return null;
  const esta = cat === 'Preferência' ? 'esta preferência' : 'esta regra';
  return (
    <div
      className="text-[11.5px] text-texto-2"
      style={{
        padding: '10px 12px',
        border: '1px solid var(--borda)',
        borderRadius: 8,
        background: 'var(--superficie-2)',
      }}
    >
      <div className="font-semibold mb-1 text-texto">
        {comuns} recurso{comuns === 1 ? '' : 's'} atrelado{comuns === 1 ? '' : 's'}
        {outrasRegras > 0 && (
          <>
            {' '}
            e mais {outrasRegras} regra{outrasRegras === 1 ? '' : 's'} nesta transição
          </>
        )}
      </div>
      {outrasRegras > 0
        ? `Como a transição tem mais de uma regra, o checklist lista cada uma como item próprio e os demais recursos nas seções deles.`
        : comuns > 0
          ? `No checklist, aparecerão como subitens d${esta}.`
          : null}
    </div>
  );
}
