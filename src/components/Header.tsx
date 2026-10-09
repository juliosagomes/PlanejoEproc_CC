import type { Sessao } from '@/domain';
import { GlifoMarca } from '@/components/BrandMark';
import { Icon } from '@/components/Icon';
import { ItemMenu, MenuSuspenso, SeparadorMenu, TituloMenu } from '@/components/MenuSuspenso';
import { PlanSwitcher } from '@/features/plans/PlanSwitcher';
import { SessaoBadge } from '@/features/sessao/components/SessaoBadge';
import { useTemaStore } from '@/features/tema/store';
import type { PlanIndexEntry } from '@/infra/storage';
import { cn } from '@/utils/cn';

/** Progresso de implantação do plano ativo — a mesma conta do checklist. */
export interface HeaderStats {
  total: number;
  criados: number;
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
   * que criam, abrem ou renomeiam.
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
  /** Abre a tela geral dos setores da unidade (decisoes.md#D-26). */
  onSetores: () => void;
  onDescarte: () => void;
  onChecklist: () => void;
  onVerTutorial: () => void;
  stats: HeaderStats;
  /** O canvas do plano ou o painel da unidade (decisoes.md#D-33). */
  tela: TelaEditor;
  onTelaChange: (tela: TelaEditor) => void;
}

export type TelaEditor = 'fluxo' | 'painel';

const TELA_OPTIONS: ReadonlyArray<{ id: TelaEditor; label: string }> = [
  { id: 'fluxo', label: 'Fluxo' },
  { id: 'painel', label: 'Painel da unidade' },
];

function Alternador<T extends string>({
  rotulo,
  opcoes,
  valor,
  onChange,
}: {
  rotulo: string;
  opcoes: ReadonlyArray<{ id: T; label: string }>;
  valor: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={rotulo}
      className="inline-flex p-0.5 rounded-md bg-superficie-2 border border-borda flex-shrink-0"
    >
      {opcoes.map((opt) => {
        const ativo = valor === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            aria-pressed={ativo}
            className={cn(
              'px-2.5 py-0.5 text-[11.5px] font-medium rounded-[5px] border-0 cursor-pointer transition-all whitespace-nowrap',
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
  );
}

/**
 * Antes só aparecia em telas a partir de 2000px. Fica sempre à mostra porque
 * é a pergunta de quem volta a um plano — "quanto falta?" — e abre o
 * checklist, que é onde se responde "o quê".
 */
function ProgressoImplantacao({ stats, onClick }: { stats: HeaderStats; onClick: () => void }) {
  if (stats.total === 0) return null;
  const pct = Math.round((stats.criados / stats.total) * 100);
  return (
    <button
      type="button"
      className="progresso-implantacao flex-shrink-0"
      onClick={onClick}
      title={`${stats.criados} de ${stats.total} itens já existem no Eproc. Abrir o checklist`}
    >
      <span className="trilho" aria-hidden>
        <span style={{ width: `${pct}%` }} />
      </span>
      <span>
        <span className="text-texto font-semibold">{stats.criados}</span> de {stats.total}{' '}
        criados
      </span>
    </button>
  );
}

interface MenuPlanoProps {
  somenteLeitura: boolean;
  emLotacao: boolean;
  podeEnviar: boolean;
  totalPlanos: number;
  sincronizando: boolean;
  publicando: boolean;
  onNovo: () => void;
  onAbrirArquivo: () => void;
  onSalvarCopiaAtivo: () => void;
  onSalvarTodos: () => void;
  onPull: () => void;
  onPush: () => void;
}

function MenuPlano(p: MenuPlanoProps) {
  // O trabalho com o servidor foi para dentro do menu; é o rótulo do botão
  // que avisa que ele está em curso.
  const ocupado = p.sincronizando ? 'Baixando…' : p.publicando ? 'Enviando…' : null;
  return (
    <MenuSuspenso
      lado="direita"
      largura={280}
      title="Criar, abrir e salvar cópia de planos"
      gatilho={
        <>
          {ocupado ?? 'Plano'} <Icon.ChevronDown />
        </>
      }
    >
      {/* Criar e importar escrevem no silo — fora numa sessão de visualização.
          Salvar cópia continua: baixar uma cópia é leitura. */}
      {!p.somenteLeitura && (
        <>
          <ItemMenu
            icone={<Icon.File />}
            rotulo="Novo plano"
            descricao="Em branco, sem apagar o atual"
            onSelect={p.onNovo}
          />
          <ItemMenu
            icone={<Icon.Upload />}
            rotulo="Abrir arquivo…"
            descricao="Um plano ou um pacote de planos em JSON"
            onSelect={p.onAbrirArquivo}
          />
          <SeparadorMenu />
        </>
      )}
      <ItemMenu
        icone={<Icon.Download />}
        rotulo="Salvar cópia deste plano"
        onSelect={p.onSalvarCopiaAtivo}
      />
      <ItemMenu
        icone={<Icon.Download />}
        rotulo={`Salvar cópia de todos (${p.totalPlanos})`}
        descricao="Um arquivo só, com todos os planos do navegador"
        disabled={p.totalPlanos <= 1}
        onSelect={p.onSalvarTodos}
      />
      {p.emLotacao && (
        <>
          <SeparadorMenu />
          <TituloMenu>Servidor da lotação</TituloMenu>
          <ItemMenu
            icone={<Icon.CloudDown />}
            rotulo={p.sincronizando ? 'Baixando…' : 'Baixar do servidor'}
            descricao="Substitui os planos desta lotação pela versão do servidor"
            disabled={p.sincronizando || p.publicando}
            onSelect={p.onPull}
          />
          {p.podeEnviar && (
            <ItemMenu
              icone={<Icon.CloudUp />}
              rotulo={p.publicando ? 'Enviando…' : 'Enviar ao servidor'}
              descricao="Envia todos os planos desta lotação e propaga as exclusões"
              disabled={p.sincronizando || p.publicando}
              onSelect={p.onPush}
            />
          )}
        </>
      )}
    </MenuSuspenso>
  );
}

interface MenuUnidadeProps {
  sincronizandoUnidade: boolean;
  onSincronizarUnidade: () => void;
  onCatalogoOrgao: () => void;
  onSetores: () => void;
  onDescarte: () => void;
}

function MenuUnidade(p: MenuUnidadeProps) {
  return (
    <MenuSuspenso
      lado="direita"
      largura={300}
      title="Localizadores, catálogo e setores da unidade"
      gatilho={
        <>
          {p.sincronizandoUnidade ? 'Sincronizando…' : 'Unidade'} <Icon.ChevronDown />
        </>
      }
    >
      <ItemMenu
        icone={<Icon.Sincronizar />}
        rotulo={p.sincronizandoUnidade ? 'Sincronizando…' : 'Sincronizar com a unidade'}
        descricao="Lê localizadores, modelos e textos padrão direto do Eproc, na aba em que você está logado"
        disabled={p.sincronizandoUnidade}
        onSelect={p.onSincronizarUnidade}
      />
      <ItemMenu
        icone={<Icon.Library />}
        rotulo="Catálogo do órgão"
        descricao="Importa o XLS de localizadores e mostra tudo o que já foi mapeado"
        onSelect={p.onCatalogoOrgao}
      />
      <SeparadorMenu />
      {/* Vale em visualização: a tela é o inventário de quem trabalha o quê,
          e a edição da lista é que fica travada lá dentro. */}
      <ItemMenu
        icone={<Icon.Etiqueta />}
        rotulo="Setores"
        descricao="Quem trabalha cada localizador, em todos os planos"
        onSelect={p.onSetores}
      />
      <ItemMenu
        icone={<Icon.Trash />}
        rotulo="Destinos de descarte"
        descricao="Localizadores como “P”, que só preenchem o destino de regra que não move"
        onSelect={p.onDescarte}
      />
    </MenuSuspenso>
  );
}

/** O item de tema mostra para onde o clique leva, não o tema atual. */
function MenuMais({ onVerTutorial }: { onVerTutorial: () => void }) {
  const tema = useTemaStore((s) => s.tema);
  const alternarTema = useTemaStore((s) => s.alternar);
  return (
    <MenuSuspenso
      lado="direita"
      largura={220}
      ariaLabel="Mais opções"
      title="Mais opções"
      className="btn btn-sm btn-ghost btn-icon"
      gatilho={<Icon.Reticencias />}
    >
      <ItemMenu
        icone={tema === 'escuro' ? <Icon.Sol /> : <Icon.Lua />}
        rotulo={tema === 'escuro' ? 'Usar tema claro' : 'Usar tema escuro'}
        onSelect={alternarTema}
      />
      <ItemMenu icone={<Icon.Ajuda />} rotulo="Ver tutorial" onSelect={onVerTutorial} />
    </MenuSuspenso>
  );
}

/**
 * Cabeçalho do app. À esquerda, "onde estou": marca, sessão e o plano ativo,
 * que é também o seletor e o lugar de renomear. No meio, Fluxo | Painel. À
 * direita, o progresso e as ações agrupadas por assunto — Plano (arquivo e
 * servidor da lotação) e Unidade (Eproc, catálogo, setores) —, antes
 * espalhadas em oito botões que estouravam a barra em tela de notebook.
 *
 * O painel da unidade olha todos os planos; nele somem o seletor, o progresso
 * e o checklist, que são do plano ativo.
 */
export function Header(props: HeaderProps) {
  const { sessao, tela, planos } = props;
  const emLotacao = sessao.tipo === 'lotacao';
  const podeEnviar = emLotacao && sessao.permissao === 'edicao';
  const noFluxo = tela === 'fluxo';
  const rotuloSidebar = props.sidebarVisivel
    ? 'Ocultar a barra lateral'
    : 'Mostrar a barra lateral';
  return (
    <header
      className="flex items-center gap-2 px-3 no-print bg-superficie border-b border-borda flex-shrink-0"
      style={{ height: 50 }}
    >
      <button
        type="button"
        className="brand-mark"
        onClick={props.onAlternarSidebar}
        aria-expanded={props.sidebarVisivel}
        aria-controls="pj-sidebar"
        title={rotuloSidebar}
        aria-label={rotuloSidebar}
      >
        <GlifoMarca width={17} height={17} />
      </button>

      <SessaoBadge sessao={sessao} onTrocar={props.onTrocarSessao} />

      {noFluxo && (
        <>
          <span className="text-borda-forte select-none" aria-hidden>
            /
          </span>
          <PlanSwitcher
            planos={planos}
            ativoId={props.ativoId}
            ativoNomeLive={props.planoNome}
            onRenomearAtivo={props.onPlanoNomeChange}
            somenteLeitura={props.somenteLeitura}
            onSwitch={props.onSwitchPlano}
            onRenomear={props.onRenomearPlano}
            onDuplicar={props.onDuplicarPlano}
            onExcluir={props.onExcluirPlano}
            onApagarTodos={props.onApagarTodosPlanos}
          />
        </>
      )}

      <div className="flex-1" />
      <Alternador rotulo="Tela" opcoes={TELA_OPTIONS} valor={tela} onChange={props.onTelaChange} />
      <div className="flex-1" />

      <div className="flex items-center gap-1 flex-shrink-0">
        {noFluxo && (
          <span className="mr-1">
            <ProgressoImplantacao stats={props.stats} onClick={props.onChecklist} />
          </span>
        )}
        <MenuPlano
          somenteLeitura={props.somenteLeitura}
          emLotacao={emLotacao}
          podeEnviar={podeEnviar}
          totalPlanos={planos.length}
          sincronizando={props.sincronizando}
          publicando={props.publicando}
          onNovo={props.onNovo}
          onAbrirArquivo={props.onAbrirArquivo}
          onSalvarCopiaAtivo={props.onSalvarCopiaAtivo}
          onSalvarTodos={props.onSalvarTodos}
          onPull={props.onPull}
          onPush={props.onPush}
        />
        <MenuUnidade
          sincronizandoUnidade={props.sincronizandoUnidade}
          onSincronizarUnidade={props.onSincronizarUnidade}
          onCatalogoOrgao={props.onCatalogoOrgao}
          onSetores={props.onSetores}
          onDescarte={props.onDescarte}
        />
        <MenuMais onVerTutorial={props.onVerTutorial} />
        {noFluxo && (
          <button type="button" className="btn btn-sm btn-accent ml-1" onClick={props.onChecklist}>
            <Icon.Bolt /> Checklist
          </button>
        )}
      </div>
    </header>
  );
}
