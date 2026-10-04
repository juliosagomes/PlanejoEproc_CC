import type { CSSProperties } from 'react';
import { chaveLocalizador, type GrupoPreferencias } from '@/domain';
import { useGruposDoEproc } from '../dados';

/** Prefixo do valor que pede um grupo novo, com o nome vindo do Eproc. */
export const NOVO_GRUPO = 'novo:';

interface SeletorGrupoProps {
  /** Id de um grupo do painel, `NOVO_GRUPO + nome`, ou `''` para "sem grupo". */
  value: string;
  grupos: GrupoPreferencias[];
  onChange: (valor: string) => void;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * Seletor de grupo de preferências: os grupos do painel e, depois deles, os que
 * a sincronização viu no Eproc e o painel ainda não tem (D-37). Escolher um
 * destes não cria nada aqui — quem chama resolve com `criarGrupo` na hora certa.
 */
export function SeletorGrupo({ value, grupos, onChange, disabled, className, style }: SeletorGrupoProps) {
  const doEproc = useGruposDoEproc();
  const conhecidos = new Set(grupos.map((g) => chaveLocalizador(g.nome)));
  const novos = doEproc.filter((n) => !conhecidos.has(chaveLocalizador(n)));

  return (
    <select
      className={className ?? 'select'}
      style={style}
      aria-label="Grupo de preferências"
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Sem grupo</option>
      {grupos.map((g) => (
        <option key={g.id} value={g.id}>
          {g.nome}
        </option>
      ))}
      {novos.length > 0 && (
        <optgroup label="Do Eproc">
          {novos.map((n) => (
            <option key={n} value={NOVO_GRUPO + n}>
              {n}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}
