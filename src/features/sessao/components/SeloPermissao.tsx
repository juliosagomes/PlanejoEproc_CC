import type { Permissao } from '@/domain';
import { cn } from '@/utils/cn';

/**
 * Rótulo do que a sessão permite fazer. Aparece na tela de entrada e no
 * cabeçalho: saber se está em "só leitura" antes de investir tempo editando
 * evita a frustração de descobrir na hora de enviar.
 */
export function SeloPermissao({
  permissao,
  className,
}: {
  permissao: Permissao;
  className?: string;
}) {
  const edicao = permissao === 'edicao';
  return (
    <span
      className={cn(
        'inline-block px-1.5 py-px rounded text-[10px] font-semibold uppercase tracking-wide',
        className,
      )}
      style={
        edicao
          ? {
              background: 'var(--destaque-suave)',
              border: '1px solid var(--destaque-borda)',
              color: 'var(--destaque)',
            }
          : {
              background: 'var(--superficie-2)',
              border: '1px solid var(--borda)',
              color: 'var(--texto-3)',
            }
      }
    >
      {edicao ? 'Edição' : 'Visualização'}
    </span>
  );
}
