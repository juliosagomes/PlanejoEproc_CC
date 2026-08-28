import type { FlowMode, Sessao } from '@/domain';
import { GlifoMarca } from '@/components/BrandMark';
import { Icon } from '@/components/Icon';
import { PlanSwitcher } from '@/features/plans/PlanSwitcher';
import { SalvarCopiaButton } from '@/features/plans/SalvarCopiaButton';
import { SessaoBadge } from '@/features/sessao/components/SessaoBadge';
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
  // Barra lateral (a marca à esquerda é o botão que a mostra/esconde)
  sidebarVisivel: boolean;
  onAlternarSidebar: () => void;
  // Sessão (modo local ou lotação)
  sessao: Sessao;
  onTrocarSessao: () => void;
  /**
   * Sessão de visualização: nada aqui pode alterar o plano. Some com as ações
   * que criam, abrem ou renomeiam, e trava o nome do plano ativo.
   */
  somenteLeitura: boolean;
  onPull: () => void;
  onPush: () => void;
  sincronizando: boolean;
  publicando: boolean;
  // Multi-plano
  planos: PlanIndexEntry[];
  ativoId: string | null;
  onSwitchPlano: (id: string) => void;
  onRenomearPlano: (id: string) => void;
  onDuplicarPlano: (id: string) => void;
  onExcluirPlano: (id: string) => void;
  /** Só existe no modo local (decisoes.md#D-18); ausente esconde a opção. */
  onApagarTodosPlanos?: () => void;
  // Ações de fluxo
  onNovo: () => void;
  onAbrirArquivo: () => void;
  onSalvarCopiaAtivo: () => void;
  onSalvarTodos: () => void;
  onCatalogoOrgao: () => void;
  onSincronizarUnidade: () => void;
  sincronizandoUnidade: boolean;
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
 * Cabeçalho do app: marca + indicador de sessão + switcher de plano + nome
 * editável do ativo + toggle de modo de fluxo + estatísticas + ações.
 *
 * A ordem à esquerda responde perguntas cada vez mais específicas: o
 * `SessaoBadge` diz "de quem são estes planos", o switcher diz "qual deles
 * estou editando", e o input edita o nome do ativo inline (renomeação por
 * debounce).
 */
export function Header({
  planoNome,
  onPlanoNomeChange,
  sidebarVisivel,
  onAlternarSidebar,
  sessao,
  onTrocarSessao,
  somenteLeitura,
  onPull,
  onPush,
  sincronizando,
  publicando,
  planos,
  ativoId,
  onSwitchPlano,
  onRenomearPlano,
  onDuplicarPlano,
  onExcluirPlano,
  onApagarTodosPlanos,
  onNovo,
  onAbrirArquivo,
  onSalvarCopiaAtivo,
  onSalvarTodos,
  onCatalogoOrgao,
  onSincronizarUnidade,
  sincronizandoUnidade,
  onChecklist,
  flowMode,
  onFlowModeChange,
  stats,
}: HeaderProps) {
  const emLotacao = sessao.tipo === 'lotacao';
  const podeEnviar = emLotacao && sessao.permissao === 'edicao';
  return (
    <header
      className="flex items-center gap-2 px-4 no-print bg-superficie border-b border-borda flex-shrink-0"
      style={{ height: 50 }}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="brand-mark"
          onClick={onAlternarSidebar}
          aria-expanded={sidebarVisivel}
          aria-controls="pj-sidebar"
          title={
            sidebarVisivel ? 'Ocultar a barra lateral' : 'Mostrar a barra lateral'
          }
          aria-label={
            sidebarVisivel ? 'Ocultar a barra lateral' : 'Mostrar a barra lateral'
          }
        >
          <GlifoMarca width={17} height={17} />
        </button>
        <span className="font-semibold text-[13px]">PlanejoEproc</span>
      </div>

      <SessaoBadge sessao={sessao} onTrocar={onTrocarSessao} />

      <PlanSwitcher
        planos={planos}
        ativoId={ativoId}
        ativoNomeLive={planoNome}
        somenteLeitura={somenteLeitura}
        onSwitch={onSwitchPlano}
        onRenomear={onRenomearPlano}
        onDuplicar={onDuplicarPlano}
        onExcluir={onExcluirPlano}
        onApagarTodos={onApagarTodosPlanos}
      />

      {/* O elástico do cabeçalho: é este input que cede espaço quando a barra
          aperta, para as ações à direita manterem a largura natural. */}
      <input
        className="input"
        style={{
          flex: '1 1 240px',
          minWidth: 140,
          height: 28,
          padding: '4px 10px',
          fontWeight: 500,
        }}
        value={planoNome}
        onChange={(e) => onPlanoNomeChange(e.target.value)}
        readOnly={somenteLeitura}
        placeholder="Nome do plano"
        aria-label="Nome do plano ativo"
        title={somenteLeitura ? 'Sessão de visualização — nome travado' : undefined}
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

      {/* Informativo, não acionável: some primeiro quando a barra aperta, para
          o nome do plano e as ações manterem espaço utilizável. */}
      <div className="hidden min-[2000px]:flex items-center gap-3 mono text-[11px] text-texto-3 flex-shrink-0 whitespace-nowrap">
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

      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Criar e importar escrevem no silo — fora numa sessão de visualização.
            Exportar (SalvarCopiaButton) continua: baixar uma cópia é leitura. */}
        {!somenteLeitura && (
          <>
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
          </>
        )}
        <SalvarCopiaButton
          totalPlanos={planos.length}
          onSalvarAtivo={onSalvarCopiaAtivo}
          onSalvarTodos={onSalvarTodos}
        />
        {emLotacao && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={onPull}
            disabled={sincronizando || publicando}
            title="Substitui os planos desta lotação pela versão do servidor"
          >
            <Icon.CloudDown /> {sincronizando ? 'Baixando…' : 'Baixar do servidor'}
          </button>
        )}
        {podeEnviar && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={onPush}
            disabled={sincronizando || publicando}
            title="Envia todos os planos desta lotação e propaga as exclusões"
          >
            <Icon.CloudUp /> {publicando ? 'Enviando…' : 'Enviar ao servidor'}
          </button>
        )}
        <button
          type="button"
          className="btn btn-sm"
          onClick={onSincronizarUnidade}
          disabled={sincronizandoUnidade}
          title="Lê os localizadores direto do Eproc, na aba onde você está logado"
        >
          <Icon.CloudDown />{' '}
          {sincronizandoUnidade ? 'Sincronizando…' : 'Sincronizar com a unidade'}
        </button>
        <button
          type="button"
          className="btn btn-sm"
          onClick={onCatalogoOrgao}
          title="Importa os localizadores do órgão a partir do XLS exportado do Eproc"
        >
          <Icon.Library /> Catálogo órgão
        </button>
        <button type="button" className="btn btn-sm btn-accent" onClick={onChecklist}>
          <Icon.Bolt /> Gerar Checklist
        </button>
      </div>
    </header>
  );
}
