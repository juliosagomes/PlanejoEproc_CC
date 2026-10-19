import { useMemo, useState, type ReactNode } from 'react';
import {
  COMPORTAMENTOS_ORIGEM,
  OPCOES_MULTIPLOS_LOCALIZADORES,
  estadoBlocosAtp,
  type AtpRule,
  type ComportamentoOrigem,
  type EfeitoSemMover,
  type OpcaoMultiplosLocalizadores,
  type TipoControle,
} from '@/domain';
import { TIPOS_CONTROLE } from '@/data';
import { CatalogMulti } from '@/components/CatalogMulti';
import { Icon } from '@/components/Icon';
import { fraseAtp, fraseTexto } from '@/features/checklist/fraseAtp';
import { AcoesBloco } from './AcoesBloco';
import { FiltrosBloco } from './FiltrosBloco';
import { FraseRegra } from './FraseRegra';
import { GatilhoCampos, trocarTipoControle } from './GatilhoCampos';
import { ModalShell } from './ModalShell';
import { NavBlocos, type SecaoAtp } from './NavBlocos';
import type { RegraModalProps } from './PrefModal';
import { Field, ImplantarRow, RecursosResumo } from './pecas';
import { SugestoesProvider, useSugestoes } from './sugestoes';
import { useRolagemBlocos } from './useRolagemBlocos';

/* ============================================================================
 * Detalhamento da regra de ATP, nos três blocos da tela "Cadastrar Nova Regra
 * de ATP" do Eproc — Regras, Executar Ação, Filtros Opcionais —, com os mesmos
 * rótulos (decisoes.md#D-27). A ideia é que preencher aqui e cadastrar lá
 * sejam o mesmo gesto, na mesma ordem.
 * ========================================================================== */

interface AtpModalProps extends RegraModalProps {
  rule: AtpRule | undefined;
  /** Nomes dos localizadores nas pontas da aresta. */
  origem: string;
  destino: string;
  /**
   * Regra pendurada num localizador (decisoes.md#D-38): entra sempre no
   * checklist, então a caixa "Implantar" e o resumo dos recursos da aresta
   * não dizem nada — sobra o "já criado". O efeito muda a frase em português.
   */
  pendurada?: { efeito: EfeitoSemMover; tira?: string };
}

interface SecaoProps {
  titulo: string;
  secao: SecaoAtp;
  children: ReactNode;
}

function Secao({ titulo, secao, children }: SecaoProps) {
  return (
    <section
      data-secao={secao}
      className="flex flex-col gap-3"
      style={{ border: '1px solid var(--borda)', borderRadius: 8, padding: '12px 14px 14px' }}
    >
      <h3 className="text-[13px] font-semibold m-0">{titulo}</h3>
      {children}
    </section>
  );
}

interface PontaProps {
  rotulo: string;
  /** A ponta da aresta: é a seta no quadro, e aqui não se edita. */
  nome: string;
  outros: string[];
  setOutros: (outros: string[]) => void;
  somenteLeitura?: boolean;
}

/**
 * O Eproc aceita vários localizadores de origem e de destino na mesma regra
 * (decisoes.md#D-42). O primeiro é a ponta da aresta; os outros são só nomes,
 * e não desenham seta.
 */
function Ponta({ rotulo, nome, outros, setOutros, somenteLeitura }: PontaProps) {
  const sugestoes = useSugestoes('localizador');
  const opcoes = useMemo(
    () =>
      sugestoes
        .filter((s) => s !== nome.trim())
        .map((s) => ({ value: s, label: s })),
    [sugestoes, nome],
  );

  return (
    <div className="min-w-0 flex flex-col gap-1.5">
      <div className="label">{rotulo}</div>
      <div
        className="text-[13px] truncate"
        style={{
          padding: '6px 9px',
          border: '1px solid var(--borda)',
          borderRadius: 6,
          background: 'var(--superficie-2)',
        }}
        title={nome}
      >
        {nome.trim() || <span className="text-texto-3">(sem nome)</span>}
      </div>
      {!(somenteLeitura && outros.length === 0) && (
        <CatalogMulti
          values={outros}
          options={opcoes}
          onChange={(v) => setOutros(v.filter((x) => x.trim() && x.trim() !== nome.trim()))}
          criavel
          placeholder="Outros localizadores: digite e tecle Enter…"
          ariaLabel={`Outros localizadores — ${rotulo}`}
        />
      )}
    </div>
  );
}

export function AtpModal({
  nome,
  jaCriado,
  rule,
  origem,
  destino,
  resumo,
  recursosComuns,
  outrasRegras,
  somenteLeitura,
  onClose,
  onChange,
  pendurada,
}: AtpModalProps) {
  const r: AtpRule = rule ?? { implantar: false };
  const setR = (patch: Partial<AtpRule>) => onChange({ atp: { ...r, ...patch } });
  const outrasOrigens = r.outrasOrigens ?? [];
  const outrosDestinos = r.outrosDestinos ?? [];
  // Lista vazia vira ausência, para o plano não carregar `[]` que não diz nada.
  const lista = (v: string[]) => (v.length > 0 ? v : undefined);

  const { corpoRef, atual, irSecao, irCampo } = useRolagemBlocos();
  const estado = estadoBlocosAtp(r);
  const pendente = (alvo: string) => estado.pendencias.some((p) => p.alvo === alvo);
  const trechos = fraseAtp(r, { origem, destino, pendurada });
  const [copiada, setCopiada] = useState(false);
  const copiar = () => {
    void navigator.clipboard?.writeText(fraseTexto(trechos)).then(() => {
      setCopiada(true);
      window.setTimeout(() => setCopiada(false), 1800);
    });
  };

  return (
    <ModalShell
      titulo={nome || resumo || 'Regra de ATP'}
      subtitulo="ATP"
      somenteLeitura={somenteLeitura}
      largo
      onClose={onClose}
      rota={
        <div className="text-[11.5px] text-texto-2 mt-0.5 truncate">
          {origem.trim() || '(sem nome)'} → {destino.trim() || '(sem nome)'}
        </div>
      }
      faixa={<FraseRegra trechos={trechos} onIr={irCampo} />}
      nav={<NavBlocos estado={estado} atual={atual} onIr={irSecao} />}
      corpoRef={corpoRef}
      rodape={
        <button type="button" className="btn" onClick={copiar} title="Copia a regra em português, para conferir ou mandar a quem vai cadastrar">
          <Icon.Copy /> {copiada ? 'Frase copiada' : 'Copiar frase'}
        </button>
      }
    >
      <SugestoesProvider>
        {pendurada ? (
          <label className="flex items-center gap-2 cursor-pointer text-[12.5px]">
            <input
              type="checkbox"
              className="pj-check"
              checked={jaCriado}
              onChange={(e) => onChange({ ja_criado: e.target.checked })}
            />
            Já criada no Eproc
            <span className="text-[11.5px] text-texto-3">
              · regra que não move: entra sempre no checklist
            </span>
          </label>
        ) : (
          <ImplantarRow
            implantar={r.implantar}
            jaCriado={jaCriado}
            setImplantar={(v) => setR({ implantar: v })}
            setJaCriado={(v) => onChange({ ja_criado: v })}
            cat="Regra de ATP"
          />
        )}

        <Field
          label="Nome da regra"
          ajuda="Só existe no plano: o Eproc identifica a regra por número, não por nome."
        >
          <input
            className="input"
            placeholder="Ex.: Após citação válida, mover para conclusão"
            value={nome}
            onChange={(e) => onChange({ nome: e.target.value })}
          />
        </Field>

        <Secao titulo="Regras" secao="regras">
          <div className="grid grid-cols-2 gap-3">
            <Ponta
              rotulo="Localizador ORIGEM"
              nome={origem}
              outros={outrasOrigens}
              setOutros={(v) => setR({ outrasOrigens: lista(v) })}
              somenteLeitura={somenteLeitura}
            />
            <Ponta
              rotulo="Localizador DESTINO"
              nome={destino}
              outros={outrosDestinos}
              setOutros={(v) => setR({ outrosDestinos: lista(v) })}
              somenteLeitura={somenteLeitura}
            />
          </div>

          {outrasOrigens.length > 0 && (
            <Field label="Opção para múltiplos localizadores" alvo="multiplos" pendente={pendente('multiplos')}>
              <select
                className="select"
                value={r.opcaoMultiplosLocalizadores ?? ''}
                onChange={(e) =>
                  setR({
                    opcaoMultiplosLocalizadores: (e.target.value || undefined) as
                      | OpcaoMultiplosLocalizadores
                      | undefined,
                  })
                }
              >
                <option value="">— selecione —</option>
                {OPCOES_MULTIPLOS_LOCALIZADORES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Comportamento do Localizador ORIGEM" alvo="comportamento" pendente={pendente('comportamento')}>
            <select
              className="select"
              value={r.comportamentoOrigem ?? ''}
              onChange={(e) =>
                setR({
                  comportamentoOrigem: (e.target.value || undefined) as
                    | ComportamentoOrigem
                    | undefined,
                })
              }
            >
              <option value="">— selecione —</option>
              {COMPORTAMENTOS_ORIGEM.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Tipo de Controle" alvo="tipoControle" pendente={pendente('tipoControle')}>
            <select
              className="select"
              value={r.trigger?.tipo ?? ''}
              onChange={(e) => {
                const tipo = e.target.value as TipoControle | '';
                if (!tipo) return;
                setR({ trigger: trocarTipoControle(r.trigger, tipo) });
              }}
            >
              <option value="">— selecione —</option>
              {TIPOS_CONTROLE.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>

          {r.trigger && (
            <div data-alvo="gatilho" className="flex flex-col gap-3">
              <GatilhoCampos trigger={r.trigger} setTrigger={(trigger) => setR({ trigger })} />
            </div>
          )}
        </Secao>

        <Secao titulo="Executar Ação" secao="acao">
          <AcoesBloco acoes={r.acoes ?? []} setAcoes={(acoes) => setR({ acoes })} />
        </Secao>

        <Secao titulo="Filtros Opcionais" secao="filtros">
          <FiltrosBloco filtros={r.filtros ?? {}} setFiltros={(filtros) => setR({ filtros })} />
        </Secao>

        <Field label="Observações" secao="obs">
          <textarea
            className="textarea"
            rows={3}
            placeholder="O que não couber nos campos acima: exceções, dependências, ordem em relação a outras regras…"
            value={r.observacoes ?? ''}
            onChange={(e) => setR({ observacoes: e.target.value })}
          />
        </Field>

        {!pendurada && (
          <RecursosResumo
            comuns={recursosComuns}
            outrasRegras={outrasRegras}
            cat="Regra de ATP"
          />
        )}
      </SugestoesProvider>
    </ModalShell>
  );
}
