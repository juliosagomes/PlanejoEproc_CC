import type { Cobertura } from '@/domain';

/** Verde o coberto, cinza o fora de propósito; o vazio que sobra é o descoberto. */
export function BarraCobertura({ c, className }: { c: Cobertura; className?: string }) {
  const pct = (n: number) => (c.total ? `${(n / c.total) * 100}%` : '0%');
  return (
    <div
      className={`flex h-[5px] rounded-full overflow-hidden bg-superficie-2 border border-borda ${className ?? ''}`}
      role="img"
      aria-label={`${c.cobertos} cobertos, ${c.fora} fora de propósito, ${c.descobertos} descobertos`}
    >
      <span className="h-full bg-ok" style={{ width: pct(c.cobertos) }} />
      <span className="h-full bg-borda-forte" style={{ width: pct(c.fora) }} />
    </div>
  );
}
