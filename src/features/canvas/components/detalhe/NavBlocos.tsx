import type { EstadoBloco, EstadoBlocosAtp } from '@/domain';

export type SecaoAtp = 'regras' | 'acao' | 'filtros' | 'obs';

interface NavBlocosProps {
  estado: EstadoBlocosAtp;
  atual: SecaoAtp;
  onIr: (secao: SecaoAtp) => void;
}

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

/**
 * Os três blocos da tela do Eproc, com o estado de cada um, à esquerda do
 * modal (decisoes.md#D-45). Quem está em Filtros vê, sem rolar, que falta o
 * comportamento da origem lá em cima.
 */
export function NavBlocos({ estado, atual, onIr }: NavBlocosProps) {
  const faltaRegras = estado.pendencias.find((p) => !p.alvo.startsWith('acao:'));
  const itens: { secao: SecaoAtp; n: string; titulo: string; estado?: EstadoBloco; sub: string }[] = [
    {
      secao: 'regras',
      n: '1',
      titulo: 'Regras',
      estado: estado.regras,
      sub: faltaRegras ? `falta ${faltaRegras.texto}` : 'completo',
    },
    {
      secao: 'acao',
      n: '2',
      titulo: 'Executar Ação',
      estado: estado.acao,
      sub:
        estado.acoes === 0
          ? 'nenhuma (opcional)'
          : `${plural(estado.acoes, 'ação', 'ações')}${estado.acao === 'parcial' ? ' · falta o tipo' : ''}`,
    },
    {
      secao: 'filtros',
      n: '3',
      titulo: 'Filtros Opcionais',
      estado: estado.filtros,
      sub: estado.filtrosPreenchidos ? plural(estado.filtrosPreenchidos, 'filtro', 'filtros') : 'nenhum (opcional)',
    },
    { secao: 'obs', n: '4', titulo: 'Observações', sub: 'texto livre' },
  ];

  return (
    <nav className="nav-blocos" aria-label="Blocos da regra">
      {itens.map((it) => (
        <button key={it.secao} type="button" aria-current={atual === it.secao} onClick={() => onIr(it.secao)}>
          <span className={`nav-n ${it.estado ?? ''}`} aria-hidden>
            {it.estado === 'completo' ? '✓' : it.estado === 'parcial' ? '◐' : it.n}
          </span>
          <span className="min-w-0">
            {it.titulo}
            <small>{it.sub}</small>
          </span>
        </button>
      ))}
    </nav>
  );
}
