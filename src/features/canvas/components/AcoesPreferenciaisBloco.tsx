import { useMemo, useState } from 'react';
import {
  atalhosPara,
  atpsManuaisSaindo,
  canonPreferencia,
  linhasAcoesPreferenciais,
  nomeDaPonta,
  type LinhaAcaoPreferencial,
} from '@/domain';
import { Icon } from '@/components/Icon';
import { SugestoesInput } from '@/components/SugestoesInput';
import {
  useAcoesPreferenciaisDoLocalizador,
  useSugestoesSubitem,
} from '@/features/catalogo/sugestoes';
import { useCanvasStore, type FlowNode } from '../store';

const VISIVEIS = 6;

interface AcoesPreferenciaisBlocoProps {
  node: FlowNode;
}

/**
 * "Ações Preferenciais Vinculadas" do localizador, com as três origens lado a
 * lado (decisoes.md#D-28): o que o Eproc já tem, o que o usuário planejou e as
 * ATPs "Por Ação Manual" que saem daqui. O "como está" e o "como vai ficar" na
 * mesma lista, cada linha dizendo de onde veio.
 */
export function AcoesPreferenciaisBloco({ node }: AcoesPreferenciaisBlocoProps) {
  const edges = useCanvasStore((s) => s.edges);
  const nodes = useCanvasStore((s) => s.nodes);
  const grupos = useCanvasStore((s) => s.grupos);
  const somenteLeitura = useCanvasStore((s) => s.somenteLeitura);
  const addAcao = useCanvasStore((s) => s.addAcaoPreferencial);
  const updateAcao = useCanvasStore((s) => s.updateAcaoPreferencial);
  const removeAcao = useCanvasStore((s) => s.removeAcaoPreferencial);
  const setSelectedId = useCanvasStore((s) => s.setSelectedId);

  const doEproc = useAcoesPreferenciaisDoLocalizador(node.data.nome);
  const sugestoes = useSugestoesSubitem('Preferência');
  const planejadas = node.data.acoesPreferenciais;
  // As transições que saem de um atalho são deste localizador (D-30).
  const atps = useMemo(
    () =>
      [node.id, ...atalhosPara(nodes, node.id)].flatMap((id) => atpsManuaisSaindo(id, edges)),
    [node.id, nodes, edges],
  );
  const linhas = useMemo(
    () => linhasAcoesPreferenciais(doEproc, planejadas ?? [], atps),
    [doEproc, planejadas, atps],
  );

  const [expandido, setExpandido] = useState(false);
  const [novo, setNovo] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const opcoes = useMemo(
    () =>
      sugestoes.map((s) =>
        s.outroOrgao ? { valor: s.nome, detalhe: `de ${s.outroOrgao}` } : { valor: s.nome },
      ),
    [sugestoes],
  );

  const vincular = () => {
    const nome = novo.trim();
    if (!nome) return;
    const canon = canonPreferencia(nome);
    if ((planejadas ?? []).some((a) => canonPreferencia(a.nome) === canon)) {
      setAviso('Essa preferência já está planejada aqui.');
      return;
    }
    // Já vinculada no Eproc: planejar continua válido (o usuário quer que ela
    // fique), mas nasce marcada — não há o que fazer lá.
    addAcao(node.id, nome, doEproc.some((p) => canonPreferencia(p) === canon));
    setNovo('');
    setAviso(null);
  };

  const mostrando = expandido ? linhas : linhas.slice(0, VISIVEIS);
  const restantes = linhas.length - mostrando.length;
  const contagem = {
    eproc: doEproc.length,
    planejadas: planejadas?.length ?? 0,
    atp: atps.length,
  };

  return (
    <div
      className="rounded-lg px-3 py-2.5"
      style={{ background: 'var(--superficie-2)', border: '1px solid var(--borda)' }}
    >
      <div className="label" style={{ marginBottom: 6 }}>
        Ações Preferenciais Vinculadas
        {linhas.length > 0 && (
          <span
            className="mono ml-2 text-[10.5px] font-medium normal-case tracking-normal text-texto-3"
            title={`${contagem.eproc} no Eproc · ${contagem.planejadas} planejadas · ${contagem.atp} ATP manual`}
          >
            {linhas.length}
          </span>
        )}
      </div>

      {linhas.length === 0 ? (
        <div className="text-[11.5px] text-texto-3 leading-snug">
          Nenhuma ainda. Vincule as preferências que devem aparecer para quem
          trabalha este localizador.
        </div>
      ) : (
        <ul className="flex flex-col">
          {mostrando.map((l) => (
            <LinhaAcao
              key={chaveLinha(l)}
              linha={l}
              somenteLeitura={somenteLeitura}
              nomeDestino={(id) => nomeDaPonta(nodes, grupos, id) || 'sem nome'}
              onMarcar={(id, ja) => updateAcao(node.id, id, { ja_criado: ja })}
              onRemover={(id) => removeAcao(node.id, id)}
              onVerAresta={(id) => setSelectedId(id)}
            />
          ))}
        </ul>
      )}
      {restantes > 0 && (
        <button
          type="button"
          className="btn btn-sm btn-ghost mt-1"
          style={{ height: 22, fontSize: 11 }}
          onClick={() => setExpandido(true)}
        >
          mostrar mais {restantes}
        </button>
      )}

      {!somenteLeitura && (
        <div className="mt-2">
          <div className="flex gap-1.5">
            <SugestoesInput
              className="input"
              style={{ height: 26, padding: '2px 7px', fontSize: 12 }}
              placeholder={sugestoes.length > 0 ? 'Vincular preferência (há sugestões)' : 'Vincular preferência'}
              aria-label="Nome da preferência a vincular"
              value={novo}
              sugestoes={opcoes}
              onValueChange={(valor) => {
                setNovo(valor);
                setAviso(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  vincular();
                }
              }}
            />
            <button type="button" className="btn btn-sm" style={{ height: 26 }} onClick={vincular} disabled={!novo.trim()}>
              <Icon.Plus /> Vincular
            </button>
          </div>
          {aviso && <div className="text-[11px] text-aviso mt-1">{aviso}</div>}
        </div>
      )}
    </div>
  );
}

function chaveLinha(l: LinhaAcaoPreferencial): string {
  if (l.origem === 'eproc') return `e:${l.nome}`;
  if (l.origem === 'planejada') return `p:${l.acao.id}`;
  return `a:${l.atp.edgeId}:${l.atp.subitemId}`;
}

interface LinhaAcaoProps {
  linha: LinhaAcaoPreferencial;
  somenteLeitura: boolean;
  nomeDestino: (nodeId: string) => string;
  onMarcar: (acaoId: string, ja: boolean) => void;
  onRemover: (acaoId: string) => void;
  onVerAresta: (edgeId: string) => void;
}

function LinhaAcao({ linha, somenteLeitura, nomeDestino, onMarcar, onRemover, onVerAresta }: LinhaAcaoProps) {
  if (linha.origem === 'eproc') {
    return (
      <li className="acao-pref">
        <span className="acao-pref-tag eproc" title="Já vinculada no Eproc, segundo a última sincronização">
          Eproc
        </span>
        <span className="acao-pref-nome">{linha.nome}</span>
      </li>
    );
  }
  if (linha.origem === 'planejada') {
    const { acao, tambemNoEproc } = linha;
    return (
      <li className="acao-pref">
        <input
          type="checkbox"
          className="pj-check"
          checked={acao.ja_criado}
          onChange={(e) => onMarcar(acao.id, e.target.checked)}
          title="Marcar como vinculada no Eproc"
          aria-label={`${acao.nome}: já vinculada no Eproc`}
        />
        <span
          className="acao-pref-tag planejada"
          title={tambemNoEproc ? 'Planejada, e a sincronização confirma que já existe no Eproc' : 'Planejada neste plano'}
        >
          {tambemNoEproc ? 'Planejada · Eproc' : 'Planejada'}
        </span>
        <span className="acao-pref-nome">{acao.nome}</span>
        {!somenteLeitura && (
          <button
            type="button"
            className="btn btn-icon btn-sm btn-ghost"
            style={{ width: 22, height: 22 }}
            onClick={() => onRemover(acao.id)}
            title="Remover"
            aria-label={`Remover ${acao.nome}`}
          >
            <Icon.X />
          </button>
        )}
      </li>
    );
  }
  const { atp } = linha;
  return (
    <li className="acao-pref">
      <span
        className="acao-pref-tag atp"
        title="Regra de ATP com tipo de controle “Por Ação Manual” numa transição que sai deste localizador"
      >
        ATP manual
      </span>
      <span className="acao-pref-nome">
        {atp.nome || <span className="italic text-texto-3">regra sem nome</span>}
        <button type="button" className="acao-pref-destino" onClick={() => onVerAresta(atp.edgeId)} title="Abrir a transição">
          → {nomeDestino(atp.destinoId)}
        </button>
      </span>
    </li>
  );
}
