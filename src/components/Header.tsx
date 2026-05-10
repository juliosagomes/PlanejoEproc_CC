import type { FlowMode } from '@/domain';
import { Icon } from '@/components/Icon';
import { PlanSwitcher } from '@/features/plans/PlanSwitcher';
import { SalvarCopiaButton } from '@/features/plans/SalvarCopiaButton';
import type { PlanIndexEntry } from '@/infra/storage';
import { cn } from '@/utils/cn';

export interface HeaderStats {
  nodes: number;
  edges: number;
  /** Total de itens (nós ou subitens) ainda não marcados como criados. */
  pendentes: number;
}

export interface HeaderProps {
  planoNome: string;
  onPlanoNomeChange: (nome: string) => void;
  // Multi-plano
  planos: PlanIndexEntry[];
  ativoId: string | null;
  onSwitchPlano: (id: string) => void;
  onRenomearPlano: (id: string) => void;
  onDuplicarPlano: (id: string) => void;
  onExcluirPlano: (id: string) => void;
  // Ações de fluxo
  onNovo: () => void;
  onAbrirArquivo: () => void;
  onSalvarCopiaAtivo: () => void;
  onSalvarTodos: () => void;
  onCatalogoOrgao: () => void;
  onChecklist: () => void;
  flowMode: FlowMode;
  onFlowModeChange: (mode: FlowMode) => void;
  stats: HeaderStats;
}

const FLOW_MODE_OPTIONS: ReadonlyArray<{ id: FlowMode; label: string }> = [
  { id: 'organic', label: 'Orgânico' },
  { id: 'sharp', label: 'Diagrama' },
];

/**
 * Cabeçalho do app: marca + switcher de plano + nome editável do ativo + toggle
 * de modo de fluxo + estatísticas + ações (novo, abrir arquivo, salvar cópia,
 * checklist).
 *
 * O switcher aparece à esquerda do input de nome porque ele responde "qual
 * plano estou editando"; o input edita o nome do ativo inline (renomeação
 * por debounce).
 */
export function Header({
  planoNome,
  onPlanoNomeChange,
  planos,
  ativoId,
  onSwitchPlano,
  onRenomearPlano,
  onDuplicarPlano,
  onExcluirPlano,
  onNovo,
  onAbrirArquivo,
  onSalvarCopiaAtivo,
  onSalvarTodos,
  onCatalogoOrgao,
  onChecklist,
  flowMode,
  onFlowModeChange,
  stats,
}: HeaderProps) {
  return (
    <header
      className="flex items-center gap-3 px-4 no-print bg-superficie border-b border-borda flex-shrink-0"
      style={{ height: 50 }}
    >
      <div className="flex items-center gap-2">
        <span className="brand-mark">eP</span>
        <span className="font-semibold text-[13px]">PlanejoEproc</span>
      </div>

      <PlanSwitcher
        planos={planos}
        ativoId={ativoId}
        ativoNomeLive={planoNome}
        onSwitch={onSwitchPlano}
        onRenomear={onRenomearPlano}
        onDuplicar={onDuplicarPlano}
        onExcluir={onExcluirPlano}
      />

      <input
        className="input"
        style={{ width: 240, height: 28, padding: '4px 10px', fontWeight: 500 }}
        value={planoNome}
        onChange={(e) => onPlanoNomeChange(e.target.value)}
        placeholder="Nome do plano"
        aria-label="Nome do plano ativo"
      />

      <div className="flex-1" />

      <div
        role="group"
        aria-label="Modo de fluxo"
        className="inline-flex p-0.5 rounded-md bg-superficie-2 border border-borda mr-2"
      >
        {FLOW_MODE_OPTIONS.map((opt) => {
          const ativo = flowMode === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onFlowModeChange(opt.id)}
              aria-pressed={ativo}
              className={cn(
                'px-2.5 py-0.5 text-[11.5px] font-medium rounded-[5px] border-0 cursor-pointer transition-all',
                ativo
                  ? 'bg-superficie text-texto shadow-sm ring-1 ring-borda'
                  : 'bg-transparent text-texto-2',
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <div className="hidden md:flex items-center gap-3 mono text-[11px] text-texto-3">
        <span>
          <span className="text-texto-2">{stats.nodes}</span> nós
        </span>
        <span className="text-borda-forte">·</span>
        <span>
          <span className="text-texto-2">{stats.edges}</span> arestas
        </span>
        <span className="text-borda-forte">·</span>
        <span>
          <span className={stats.pendentes > 0 ? 'text-aviso' : 'text-ok'}>
            {stats.pendentes}
          </span>{' '}
          a criar
        </span>
      </div>

      <button
        type="button"
        className="btn btn-sm"
        onClick={onNovo}
        title="Cria um plano em branco e troca para ele (não apaga o atual)"
      >
        <Icon.File /> Novo plano
      </button>
      <button
        type="button"
        className="btn btn-sm"
        onClick={onAbrirArquivo}
        title="Abre um JSON de plano salvo (cria nova entrada no switcher)"
      >
        <Icon.Upload /> Abrir arquivo
      </button>
      <SalvarCopiaButton
        totalPlanos={planos.length}
        onSalvarAtivo={onSalvarCopiaAtivo}
        onSalvarTodos={onSalvarTodos}
      />
      <button
        type="button"
        className="btn btn-sm"
        onClick={onCatalogoOrgao}
        title="Importa os localizadores do órgão para usar como sugestão"
      >
        <Icon.Library /> Catálogo órgão
      </button>
      <button type="button" className="btn btn-sm btn-accent" onClick={onChecklist}>
        <Icon.Bolt /> Gerar Checklist
      </button>
    </header>
  );
}
