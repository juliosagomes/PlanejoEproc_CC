import type { ReactNode } from 'react';
import {
  COMPORTAMENTOS_ORIGEM,
  type AtpRule,
  type ComportamentoOrigem,
  type TipoControle,
} from '@/domain';
import { TIPOS_CONTROLE } from '@/data';
import { AcoesBloco } from './AcoesBloco';
import { FiltrosBloco } from './FiltrosBloco';
import { GatilhoCampos, trocarTipoControle } from './GatilhoCampos';
import { ModalShell } from './ModalShell';
import type { RegraModalProps } from './PrefModal';
import { Field, ImplantarRow, RecursosResumo } from './pecas';
import { SugestoesProvider } from './sugestoes';

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
}

interface SecaoProps {
  titulo: string;
  children: ReactNode;
}

function Secao({ titulo, children }: SecaoProps) {
  return (
    <section
      className="flex flex-col gap-3"
      style={{ border: '1px solid var(--borda)', borderRadius: 8, padding: '12px 14px 14px' }}
    >
      <h3 className="text-[13px] font-semibold m-0">{titulo}</h3>
      {children}
    </section>
  );
}

function Ponta({ rotulo, nome }: { rotulo: string; nome: string }) {
  return (
    <div className="min-w-0">
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
}: AtpModalProps) {
  const r: AtpRule = rule ?? { implantar: false };
  const setR = (patch: Partial<AtpRule>) => onChange({ atp: { ...r, ...patch } });

  return (
    <ModalShell
      titulo={nome || resumo || 'Regra de ATP'}
      subtitulo="ATP"
      somenteLeitura={somenteLeitura}
      largo
      onClose={onClose}
    >
      <SugestoesProvider>
        <ImplantarRow
          implantar={r.implantar}
          jaCriado={jaCriado}
          setImplantar={(v) => setR({ implantar: v })}
          setJaCriado={(v) => onChange({ ja_criado: v })}
          cat="Regra de ATP"
        />

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

        <Secao titulo="Regras">
          <div className="grid grid-cols-2 gap-3">
            <Ponta rotulo="Localizador ORIGEM" nome={origem} />
            <Ponta rotulo="Localizador DESTINO" nome={destino} />
          </div>

          <Field label="Comportamento do Localizador ORIGEM">
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

          <Field label="Tipo de Controle">
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
            <GatilhoCampos trigger={r.trigger} setTrigger={(trigger) => setR({ trigger })} />
          )}
        </Secao>

        <Secao titulo="Executar Ação">
          <AcoesBloco acoes={r.acoes ?? []} setAcoes={(acoes) => setR({ acoes })} />
        </Secao>

        <Secao titulo="Filtros Opcionais">
          <FiltrosBloco filtros={r.filtros ?? {}} setFiltros={(filtros) => setR({ filtros })} />
        </Secao>

        <Field label="Observações">
          <textarea
            className="textarea"
            rows={3}
            placeholder="O que não couber nos campos acima: exceções, dependências, ordem em relação a outras regras…"
            value={r.observacoes ?? ''}
            onChange={(e) => setR({ observacoes: e.target.value })}
          />
        </Field>

        <RecursosResumo
          comuns={recursosComuns}
          outrasRegras={outrasRegras}
          cat="Regra de ATP"
        />
      </SugestoesProvider>
    </ModalShell>
  );
}
