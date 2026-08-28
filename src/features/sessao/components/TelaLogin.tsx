import { useState } from 'react';
import { BrandMark } from '@/components/BrandMark';
import { Icon } from '@/components/Icon';
import type { LotacaoConhecida } from '@/infra/sync/lotacoes';
import { baixarPlanosLocais, contarPlanosLocais } from '../planosLocais';
import { useSessaoStore } from '../store';
import { BackupCachePrompt } from './BackupCachePrompt';
import { SeloPermissao } from './SeloPermissao';

/* ============================================================================
 * TELA DE ENTRADA
 *
 * Primeira coisa que o usuário vê. Existe para responder uma pergunta antes
 * de qualquer outra: "de quem são os planos que eu vou ver agora?". Sem ela,
 * planos locais e planos de lotações diferentes apareciam misturados na mesma
 * lista, sem procedência.
 *
 * Aparece sempre — inclusive para quem só usa o modo local — mas as lotações
 * já usadas ficam guardadas, então reentrar é um clique, sem redigitar código.
 * ========================================================================== */

type Modo = 'menu' | 'codigo' | 'criar';

/** Ação escolhida, à espera da decisão sobre o backup dos planos locais. */
type AcaoPendente =
  | { tipo: 'codigo'; codigo: string }
  | { tipo: 'criar'; nome: string; levarPlanosLocais: boolean };

export function TelaLogin() {
  const entrando = useSessaoStore((s) => s.entrando);
  const erro = useSessaoStore((s) => s.erro);
  const lotacoes = useSessaoStore((s) => s.lotacoes);
  const entrarLocal = useSessaoStore((s) => s.entrarLocal);
  const entrarComCodigo = useSessaoStore((s) => s.entrarComCodigo);
  const criarLotacao = useSessaoStore((s) => s.criarLotacao);
  const esquecer = useSessaoStore((s) => s.esquecer);
  const resetMensagens = useSessaoStore((s) => s.resetMensagens);

  const [modo, setModo] = useState<Modo>('menu');
  const [codigo, setCodigo] = useState('');
  const [nomeNova, setNomeNova] = useState('');
  const [levarPlanos, setLevarPlanos] = useState(false);
  const [pendente, setPendente] = useState<AcaoPendente | null>(null);

  // Lido a cada render em vez de guardado em estado: baixar o bundle não muda
  // a contagem, e a tela é montada uma vez só por sessão.
  const totalLocais = contarPlanosLocais();

  const executar = (acao: AcaoPendente) => {
    setPendente(null);
    if (acao.tipo === 'codigo') {
      void entrarComCodigo(acao.codigo);
    } else {
      void criarLotacao(acao.nome, acao.levarPlanosLocais);
    }
  };

  // Entrar numa lotação nunca apaga os planos locais (silos separados), mas é
  // o momento em que o usuário troca de contexto — e o pedido do produto é
  // oferecer a cópia em arquivo aqui.
  const iniciar = (acao: AcaoPendente) => {
    resetMensagens();
    if (totalLocais > 0) setPendente(acao);
    else executar(acao);
  };

  const voltarAoMenu = () => {
    resetMensagens();
    setModo('menu');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-fundo">
      <div className="w-full" style={{ maxWidth: 460 }}>
        <div className="flex items-center gap-2.5 mb-5">
          <BrandMark tamanho={30} />
          <div>
            <div className="font-semibold text-[15px] leading-tight">PlanejoEproc</div>
            <div className="text-[12px] text-texto-3 leading-tight">
              Planejamento de fluxos de trabalho no Eproc
            </div>
          </div>
        </div>

        <div
          className="rounded-xl bg-superficie border border-borda overflow-hidden"
          style={{ boxShadow: '0 1px 3px rgba(20, 22, 28, 0.06)' }}
        >
          {modo === 'menu' && (
            <MenuEntrada
              lotacoes={lotacoes}
              entrando={entrando}
              onEntrarLotacao={(l) => iniciar({ tipo: 'codigo', codigo: l.codigo })}
              onEsquecer={esquecer}
              onIrParaCodigo={() => {
                resetMensagens();
                setModo('codigo');
              }}
              onIrParaCriar={() => {
                resetMensagens();
                setModo('criar');
              }}
              onModoLocal={entrarLocal}
            />
          )}

          {modo === 'codigo' && (
            <FormCodigo
              codigo={codigo}
              onCodigoChange={setCodigo}
              entrando={entrando}
              onVoltar={voltarAoMenu}
              onEntrar={() => iniciar({ tipo: 'codigo', codigo })}
            />
          )}

          {modo === 'criar' && (
            <FormCriar
              nome={nomeNova}
              onNomeChange={setNomeNova}
              levarPlanos={levarPlanos}
              onLevarPlanosChange={setLevarPlanos}
              totalLocais={totalLocais}
              entrando={entrando}
              onVoltar={voltarAoMenu}
              onCriar={() =>
                iniciar({
                  tipo: 'criar',
                  nome: nomeNova,
                  levarPlanosLocais: levarPlanos && totalLocais > 0,
                })
              }
            />
          )}

          {erro && (
            <div
              className="mx-5 mb-5 px-4 py-3 rounded-lg text-[12.5px]"
              style={{
                background: 'var(--aviso-suave)',
                border: '1px solid var(--aviso)',
                color: 'var(--texto)',
              }}
              role="alert"
            >
              <div className="font-semibold mb-0.5">Não foi possível continuar</div>
              <div className="text-texto-2 leading-snug">{erro}</div>
            </div>
          )}
        </div>

        <p className="text-[11.5px] text-texto-3 leading-snug mt-4 text-center">
          O modo local funciona sem internet. Entrar numa lotação exige conexão
          apenas no momento de baixar ou enviar planos.
        </p>
      </div>

      <BackupCachePrompt
        open={pendente !== null}
        quantidade={totalLocais}
        onBaixar={baixarPlanosLocais}
        onContinuar={() => pendente && executar(pendente)}
        onCancelar={() => setPendente(null)}
      />
    </div>
  );
}

/* ========================================================================== */

function MenuEntrada({
  lotacoes,
  entrando,
  onEntrarLotacao,
  onEsquecer,
  onIrParaCodigo,
  onIrParaCriar,
  onModoLocal,
}: {
  lotacoes: LotacaoConhecida[];
  entrando: boolean;
  onEntrarLotacao: (l: LotacaoConhecida) => void;
  onEsquecer: (workspaceId: string) => void;
  onIrParaCodigo: () => void;
  onIrParaCriar: () => void;
  onModoLocal: () => void;
}) {
  return (
    <>
      {lotacoes.length > 0 && (
        <section className="px-5 pt-5 pb-4" style={{ borderBottom: '1px solid var(--borda)' }}>
          <div className="section-h mb-2.5">Lotações usadas neste navegador</div>
          <ul className="flex flex-col gap-1.5">
            {lotacoes.map((l) => (
              <li
                key={l.workspaceId}
                className="group flex items-center gap-2 px-2.5 py-2 rounded-lg border border-borda hover:bg-superficie-2"
              >
                <span className="text-texto-3 flex-shrink-0">
                  <Icon.Predio />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-medium truncate">{l.nome}</span>
                  <SeloPermissao permissao={l.permissao} />
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-icon btn-ghost opacity-0 group-hover:opacity-100 focus:opacity-100"
                  onClick={() => onEsquecer(l.workspaceId)}
                  title="Esquecer esta lotação (não apaga os planos)"
                  aria-label={`Esquecer a lotação ${l.nome}`}
                >
                  <Icon.X />
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={entrando}
                  onClick={() => onEntrarLotacao(l)}
                >
                  Entrar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="p-5 flex flex-col gap-2">
        <button
          type="button"
          className="btn justify-start"
          style={{ height: 40 }}
          onClick={onIrParaCodigo}
          disabled={entrando}
        >
          <Icon.Share />
          <span className="flex-1 text-left">Entrar com código de lotação</span>
        </button>
        <button
          type="button"
          className="btn justify-start"
          style={{ height: 40 }}
          onClick={onIrParaCriar}
          disabled={entrando}
        >
          <Icon.Plus />
          <span className="flex-1 text-left">Criar nova lotação</span>
        </button>
        <button
          type="button"
          className="btn justify-start"
          style={{ height: 40 }}
          onClick={onModoLocal}
          disabled={entrando}
        >
          <Icon.Cadeado />
          <span className="flex-1 text-left">Abrir modo local</span>
        </button>
      </section>
    </>
  );
}

function FormCodigo({
  codigo,
  onCodigoChange,
  entrando,
  onVoltar,
  onEntrar,
}: {
  codigo: string;
  onCodigoChange: (v: string) => void;
  entrando: boolean;
  onVoltar: () => void;
  onEntrar: () => void;
}) {
  const podeEntrar = codigo.trim().length > 0 && !entrando;

  return (
    <form
      className="p-5 flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (podeEntrar) onEntrar();
      }}
    >
      <div className="section-h">Entrar com código de lotação</div>
      <p className="text-[12.5px] text-texto-3 leading-snug">
        Cole o código que você recebeu. Ele pode ser de{' '}
        <strong className="text-texto-2">visualização</strong> (só baixa planos)
        ou de <strong className="text-texto-2">edição</strong> (também envia
        alterações) — o app reconhece qual é sozinho.
      </p>
      <input
        className="input"
        value={codigo}
        onChange={(e) => onCodigoChange(e.target.value)}
        placeholder="Cole o código aqui"
        aria-label="Código da lotação"
        autoFocus
      />
      <div className="flex items-center gap-2 mt-1">
        <button type="button" className="btn btn-ghost" onClick={onVoltar}>
          Voltar
        </button>
        <div className="flex-1" />
        <button type="submit" className="btn btn-primary" disabled={!podeEntrar}>
          {entrando ? 'Entrando…' : 'Entrar'}
        </button>
      </div>
    </form>
  );
}

function FormCriar({
  nome,
  onNomeChange,
  levarPlanos,
  onLevarPlanosChange,
  totalLocais,
  entrando,
  onVoltar,
  onCriar,
}: {
  nome: string;
  onNomeChange: (v: string) => void;
  levarPlanos: boolean;
  onLevarPlanosChange: (v: boolean) => void;
  totalLocais: number;
  entrando: boolean;
  onVoltar: () => void;
  onCriar: () => void;
}) {
  const podeCriar = nome.trim().length > 0 && !entrando;

  return (
    <form
      className="p-5 flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (podeCriar) onCriar();
      }}
    >
      <div className="section-h">Criar nova lotação</div>
      <p className="text-[12.5px] text-texto-3 leading-snug">
        Uma lotação guarda os planos da sua unidade no servidor e gera dois
        códigos para compartilhar com a equipe.
      </p>
      <div>
        <label className="label" htmlFor="nova-lotacao-nome">
          Nome da lotação
        </label>
        <input
          id="nova-lotacao-nome"
          className="input"
          value={nome}
          onChange={(e) => onNomeChange(e.target.value)}
          placeholder="Ex.: 2ª Vara Cível de Contagem"
          autoFocus
        />
      </div>

      {totalLocais > 0 && (
        <label className="flex items-start gap-2 text-[12.5px] text-texto-2 cursor-pointer">
          <input
            type="checkbox"
            className="pj-check mt-0.5 flex-shrink-0"
            checked={levarPlanos}
            onChange={(e) => onLevarPlanosChange(e.target.checked)}
          />
          <span className="leading-snug">
            Copiar para a lotação os {totalLocais} plano
            {totalLocais === 1 ? '' : 's'} do modo local
            <span className="block text-texto-3">
              Os originais continuam no modo local.
            </span>
          </span>
        </label>
      )}

      <div className="flex items-center gap-2 mt-1">
        <button type="button" className="btn btn-ghost" onClick={onVoltar}>
          Voltar
        </button>
        <div className="flex-1" />
        <button type="submit" className="btn btn-primary" disabled={!podeCriar}>
          {entrando ? 'Criando…' : 'Criar lotação'}
        </button>
      </div>
    </form>
  );
}
