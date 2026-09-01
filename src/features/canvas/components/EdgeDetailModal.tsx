import type { CSSProperties } from 'react';
import {
  PREF_TIPOS,
  TIPO_CONTROLE_VALUES,
  type AtpFiltros,
  type AtpRule,
  type AtpTrigger,
  type PrefMinutaModo,
  type PrefRule,
  type PrefTipo,
  type Subitem,
  type TipoControle,
} from '@/domain';
import {
  CLASSES_JUDICIAIS,
  COMPETENCIAS,
  EVENTOS,
  STATUS_PROCESSO,
  TIPOS_ACAO_PROGRAMADA,
  TIPOS_CONTROLE,
} from '@/data';
import { CatalogMulti } from '@/components/CatalogMulti';
import { Icon } from '@/components/Icon';
import { cn } from '@/utils/cn';
import { useCanvasStore } from '../store';

/* ============================================================================
 * Modal de detalhamento de ATP / Preferência.
 *
 * Recebe o recurso da aresta que carrega a regra e devolve patches sobre ele
 * via `onChange`. Os campos do bloco do gatilho (trigger) variam conforme o
 * `tipo` escolhido: só o subset relevante é exibido.
 * ========================================================================== */

interface EdgeDetailModalProps {
  open: boolean;
  onClose: () => void;
  /** O recurso em edição — dele saem o nome e a regra. */
  subitem: Subitem;
  /** Resumo da aresta, usado como título quando o recurso ainda não tem nome. */
  resumo: string;
  /** Recursos comuns da mesma aresta (nem ATP, nem Preferência). */
  recursosComuns: number;
  /** Outras regras da mesma aresta — mudam como o checklist agrupa. */
  outrasRegras: number;
  onChange: (patch: Partial<Subitem>) => void;
}

/**
 * Modal de detalhamento de um recurso do tipo ATP ou Preferência.
 *
 * Uma aresta pode ter vários (decisoes.md#D-24), então o modal recebe **o
 * recurso**, e não a aresta: quem decide qual abrir é o `EdgePanel`.
 */
export function EdgeDetailModal({
  open,
  onClose,
  subitem,
  resumo,
  recursosComuns,
  outrasRegras,
  onChange,
}: EdgeDetailModalProps) {
  // Numa sessão de visualização o modal continua abrindo: o detalhamento é
  // conteúdo do plano, e esconder é pior do que mostrar travado. O que muda é
  // que os campos vêm desabilitados (ver `ModalShell`).
  const somenteLeitura = useCanvasStore((s) => s.somenteLeitura);

  if (!open) return null;

  if (subitem.categoria === 'Regra de ATP') {
    return (
      <AtpModal
        nome={subitem.nome}
        jaCriado={subitem.ja_criado}
        rule={subitem.atp}
        resumo={resumo}
        recursosComuns={recursosComuns}
        outrasRegras={outrasRegras}
        somenteLeitura={somenteLeitura}
        onClose={onClose}
        onChange={(patch) => onChange(patch)}
      />
    );
  }
  if (subitem.categoria === 'Preferência') {
    return (
      <PrefModal
        nome={subitem.nome}
        jaCriado={subitem.ja_criado}
        rule={subitem.pref}
        resumo={resumo}
        recursosComuns={recursosComuns}
        outrasRegras={outrasRegras}
        somenteLeitura={somenteLeitura}
        onClose={onClose}
        onChange={(patch) => onChange(patch)}
      />
    );
  }
  return null;
}

/* ====================== Pref ============================================== */

interface PrefModalProps {
  nome: string;
  jaCriado: boolean;
  rule: PrefRule | undefined;
  resumo: string;
  recursosComuns: number;
  outrasRegras: number;
  somenteLeitura: boolean;
  onClose: () => void;
  onChange: (patch: Partial<Subitem>) => void;
}

/** Mapeia cada tipo à variável CSS de cor (definida em index.css). */
const PREF_TIPO_COR: Record<PrefTipo, string> = {
  Minuta: 'var(--pref-minuta)',
  'Movimentação': 'var(--pref-mov)',
  'Intimação': 'var(--pref-int)',
  'Automatização': 'var(--pref-aut)',
};

const MINUTA_MODO_LABEL: Record<PrefMinutaModo, string> = {
  modelo: 'Modelo',
  texto_padrao: 'Texto padrão',
};

function PrefModal({
  nome,
  jaCriado,
  rule,
  resumo,
  recursosComuns,
  outrasRegras,
  somenteLeitura,
  onClose,
  onChange,
}: PrefModalProps) {
  const r: PrefRule = rule ?? { implantar: false };
  const setR = (patch: Partial<PrefRule>) => onChange({ pref: { ...r, ...patch } });

  // Toggle do modo: clicar no já ativo desmarca; clicar no outro troca.
  // Manter `minutaConteudo` ao trocar — o texto digitado em "Modelo" pode
  // valer também como "Texto padrão" se o usuário só errou a categoria.
  const setMinutaModo = (modo: PrefMinutaModo) => {
    setR({ minutaModo: r.minutaModo === modo ? undefined : modo });
  };

  return (
    <ModalShell
      titulo={nome || resumo || 'Preferência'}
      subtitulo="Preferência"
      somenteLeitura={somenteLeitura}
      onClose={onClose}
    >
      <ImplantarRow
        implantar={r.implantar}
        jaCriado={jaCriado}
        setImplantar={(v) => setR({ implantar: v })}
        setJaCriado={(v) => onChange({ ja_criado: v })}
        cat="Preferência"
      />

      <Field label="Nome da preferência">
        <input
          className="input"
          placeholder="Ex.: Preferência de processos com prioridade legal"
          value={nome}
          onChange={(e) => onChange({ nome: e.target.value })}
        />
      </Field>

      <Field label="Tipo de preferência">
        <div className="grid grid-cols-2 gap-1.5">
          {PREF_TIPOS.map((opt) => (
            <button
              key={opt}
              type="button"
              className={cn(
                'btn btn-sm justify-center pref-tipo-btn',
                r.tipo === opt && 'active',
              )}
              style={{ ['--pref-cor' as string]: PREF_TIPO_COR[opt] } as CSSProperties}
              onClick={() => setR({ tipo: opt as PrefTipo })}
              aria-pressed={r.tipo === opt}
            >
              {opt}
            </button>
          ))}
        </div>
      </Field>

      {r.tipo === 'Minuta' && (
        <Field label="Conteúdo da minuta">
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            {(['modelo', 'texto_padrao'] as const).map((modo) => (
              <button
                key={modo}
                type="button"
                className={cn(
                  'btn btn-sm justify-center',
                  r.minutaModo === modo && 'btn-primary',
                )}
                onClick={() => setMinutaModo(modo)}
                aria-pressed={r.minutaModo === modo}
              >
                {MINUTA_MODO_LABEL[modo]}
              </button>
            ))}
          </div>
          {r.minutaModo && (
            <textarea
              className="textarea"
              rows={4}
              placeholder={
                r.minutaModo === 'modelo'
                  ? 'Conteúdo do modelo (minuta/template)…'
                  : 'Texto padrão (trecho reutilizável)…'
              }
              value={r.minutaConteudo ?? ''}
              onChange={(e) => setR({ minutaConteudo: e.target.value })}
            />
          )}
        </Field>
      )}

      <Field label="Efeito da preferência">
        <textarea
          className="textarea"
          rows={3}
          placeholder="Ex.: conclusão para despacho"
          value={r.acao ?? ''}
          onChange={(e) => setR({ acao: e.target.value })}
        />
      </Field>

      <Field label="Observações">
        <textarea
          className="textarea"
          rows={2}
          placeholder="Notas, exceções, dependências…"
          value={r.observacoes ?? ''}
          onChange={(e) => setR({ observacoes: e.target.value })}
        />
      </Field>

      <RecursosResumo comuns={recursosComuns} outrasRegras={outrasRegras} cat="Preferência" />
    </ModalShell>
  );
}

/* ====================== ATP =============================================== */

interface AtpModalProps {
  nome: string;
  jaCriado: boolean;
  rule: AtpRule | undefined;
  resumo: string;
  recursosComuns: number;
  outrasRegras: number;
  somenteLeitura: boolean;
  onClose: () => void;
  onChange: (patch: Partial<Subitem>) => void;
}

function AtpModal({
  nome,
  jaCriado,
  rule,
  resumo,
  recursosComuns,
  outrasRegras,
  somenteLeitura,
  onClose,
  onChange,
}: AtpModalProps) {
  const r: AtpRule = rule ?? { implantar: false };
  const setR = (patch: Partial<AtpRule>) => onChange({ atp: { ...r, ...patch } });
  const setTrigger = (patch: AtpTrigger) => setR({ trigger: patch });
  const setFiltros = (patch: Partial<AtpFiltros>) =>
    setR({ filtros: { ...(r.filtros ?? {}), ...patch } });

  return (
    <ModalShell
      titulo={nome || resumo || 'Regra de ATP'}
      subtitulo="ATP"
      somenteLeitura={somenteLeitura}
      onClose={onClose}
    >
      <ImplantarRow
        implantar={r.implantar}
        jaCriado={jaCriado}
        setImplantar={(v) => setR({ implantar: v })}
        setJaCriado={(v) => onChange({ ja_criado: v })}
        cat="Regra de ATP"
      />

      <Field label="Nome da regra">
        <input
          className="input"
          placeholder="Ex.: Após citação válida, mover para conclusão"
          value={nome}
          onChange={(e) => onChange({ nome: e.target.value })}
        />
      </Field>

      <Field label="Tipo de controle (gatilho)">
        <select
          className="select"
          value={r.trigger?.tipo ?? ''}
          onChange={(e) => {
            const v = e.target.value as TipoControle | '';
            if (!v) return;
            setTrigger(triggerVazioPara(v));
          }}
        >
          <option value="">— selecione —</option>
          {TIPOS_CONTROLE.map((t) => (
            <option key={t.value} value={t.value}>
              {t.value} — {t.label}
            </option>
          ))}
        </select>
      </Field>

      {r.trigger && <TriggerCampos trigger={r.trigger} setTrigger={setTrigger} />}

      <Field label="Ação programada (Eproc)">
        <select
          className="select"
          value={r.acaoTipo ?? ''}
          onChange={(e) => setR({ acaoTipo: e.target.value || undefined })}
        >
          <option value="">— selecione —</option>
          {TIPOS_ACAO_PROGRAMADA.map((t) => (
            <option key={t.value} value={t.value}>
              {t.value} — {t.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Detalhes da ação (livre)">
        <textarea
          className="textarea"
          rows={2}
          placeholder="Ex.: mover para localizador X; lançar movimento Y; intimar parte…"
          value={r.acao ?? ''}
          onChange={(e) => setR({ acao: e.target.value })}
        />
      </Field>

      <FiltrosBloco
        filtros={r.filtros ?? {}}
        setFiltros={setFiltros}
      />

      <Field label="Condições (texto livre)">
        <textarea
          className="textarea"
          rows={3}
          placeholder="Ex.: tipo do documento = Petição inicial; classe = Cumprimento de sentença…"
          value={r.condicoes ?? ''}
          onChange={(e) => setR({ condicoes: e.target.value })}
        />
      </Field>

      <Field label="Observações">
        <textarea
          className="textarea"
          rows={2}
          placeholder="Notas, exceções, dependências…"
          value={r.observacoes ?? ''}
          onChange={(e) => setR({ observacoes: e.target.value })}
        />
      </Field>

      <RecursosResumo comuns={recursosComuns} outrasRegras={outrasRegras} cat="Regra de ATP" />
    </ModalShell>
  );
}

/* ====================== Trigger campos por tipo =========================== */

function triggerVazioPara(tipo: TipoControle): AtpTrigger {
  switch (tipo) {
    case 'A':
      return { tipo: 'A' };
    case 'E':
      return { tipo: 'E' };
    case 'P':
      return { tipo: 'P' };
    case 'O':
      return { tipo: 'O' };
    case 'D':
      return { tipo: 'D' };
    case 'L':
      return { tipo: 'L' };
    case 'S':
      return { tipo: 'S' };
    case 'V':
      return { tipo: 'V' };
    case 'M':
      return { tipo: 'M' };
  }
}

interface TriggerCamposProps {
  trigger: AtpTrigger;
  setTrigger: (t: AtpTrigger) => void;
}

function TriggerCampos({ trigger, setTrigger }: TriggerCamposProps) {
  const t = trigger;
  if (t.tipo === 'E' || t.tipo === 'A') {
    return (
      <Field label="Eventos (gatilho)">
        <CatalogMulti
          values={(t.tipo === 'E' ? t.eventoIds : t.eventoIds) ?? []}
          options={EVENTOS}
          onChange={(ids) =>
            setTrigger(
              t.tipo === 'E' ? { tipo: 'E', eventoIds: ids } : { ...t, eventoIds: ids },
            )
          }
          placeholder="Buscar evento…"
          ariaLabel="Eventos do gatilho"
        />
      </Field>
    );
  }
  if (t.tipo === 'D') {
    return (
      <div className="grid grid-cols-2 gap-3">
        <Field label="Data">
          <input
            className="input"
            type="date"
            value={t.data ?? ''}
            onChange={(e) => setTrigger({ ...t, data: e.target.value || undefined })}
          />
        </Field>
        <Field label="Periodicidade (dias)">
          <input
            className="input"
            type="number"
            min={0}
            value={t.periodicidadeDias ?? ''}
            onChange={(e) =>
              setTrigger({
                ...t,
                periodicidadeDias: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
        </Field>
      </div>
    );
  }
  if (t.tipo === 'L') {
    return (
      <Field label="Dias no localizador">
        <input
          className="input"
          type="number"
          min={0}
          value={t.diasNoLocalizador ?? ''}
          onChange={(e) =>
            setTrigger({
              ...t,
              diasNoLocalizador: e.target.value ? Number(e.target.value) : undefined,
            })
          }
        />
      </Field>
    );
  }
  if (t.tipo === 'S') {
    return (
      <Field label="Dias na situação">
        <input
          className="input"
          type="number"
          min={0}
          value={t.diasNaSituacao ?? ''}
          onChange={(e) =>
            setTrigger({
              ...t,
              diasNaSituacao: e.target.value ? Number(e.target.value) : undefined,
            })
          }
        />
      </Field>
    );
  }
  if (t.tipo === 'V') {
    return (
      <Field label="Dias sem movimentação">
        <input
          className="input"
          type="number"
          min={0}
          value={t.diasSemMovimentacao ?? ''}
          onChange={(e) =>
            setTrigger({
              tipo: 'V',
              diasSemMovimentacao: e.target.value ? Number(e.target.value) : undefined,
            })
          }
        />
      </Field>
    );
  }
  // 'P', 'O', 'M' — sem campos extras nesta versão.
  return null;
}

/* ====================== Filtros (Bloco 3 — subset) ======================== */

interface FiltrosBlocoProps {
  filtros: AtpFiltros;
  setFiltros: (patch: Partial<AtpFiltros>) => void;
}

function FiltrosBloco({ filtros, setFiltros }: FiltrosBlocoProps) {
  return (
    <Field label="Filtros (Bloco 3 do Eproc)">
      <div className="flex flex-col gap-3">
        <div>
          <div className="text-[11px] text-texto-3 mb-1">Classes judiciais</div>
          <CatalogMulti
            values={filtros.classesJudiciaisIds ?? []}
            options={CLASSES_JUDICIAIS}
            onChange={(ids) => setFiltros({ classesJudiciaisIds: ids })}
            placeholder="Buscar classe judicial…"
            ariaLabel="Classes judiciais"
          />
        </div>
        <div>
          <div className="text-[11px] text-texto-3 mb-1">Competência</div>
          <CatalogMulti
            values={filtros.competenciaIds ?? []}
            options={COMPETENCIAS}
            onChange={(ids) => setFiltros({ competenciaIds: ids })}
            placeholder="Buscar competência…"
            ariaLabel="Competências"
          />
        </div>
        <div>
          <div className="text-[11px] text-texto-3 mb-1">Situação do processo</div>
          <CatalogMulti
            values={filtros.statusProcessoIds ?? []}
            options={STATUS_PROCESSO}
            onChange={(ids) => setFiltros({ statusProcessoIds: ids })}
            placeholder="Buscar situação…"
            ariaLabel="Situações do processo"
          />
        </div>
      </div>
    </Field>
  );
}

/* ====================== Componentes auxiliares ============================ */

void TIPO_CONTROLE_VALUES; // referenciado em tipos; importação não pode ser apagada

/**
 * As duas caixas moram na mesma linha mas em lugares diferentes do dado:
 * `implantar` é da regra, e "já criado" é do recurso — é o mesmo checkbox da
 * linha do painel e do checklist (decisoes.md#D-24).
 */
interface ImplantarRowProps {
  implantar: boolean;
  jaCriado: boolean;
  setImplantar: (valor: boolean) => void;
  setJaCriado: (valor: boolean) => void;
  cat: 'Regra de ATP' | 'Preferência';
}

function ImplantarRow({
  implantar,
  jaCriado,
  setImplantar,
  setJaCriado,
  cat,
}: ImplantarRowProps) {
  return (
    <label
      className="flex items-center gap-2 cursor-pointer"
      style={{
        padding: '8px 10px',
        border: '1px solid var(--destaque-borda)',
        background: 'var(--destaque-suave)',
        borderRadius: 8,
      }}
    >
      <input
        type="checkbox"
        className="pj-check"
        checked={implantar}
        onChange={(e) => setImplantar(e.target.checked)}
      />
      <div className="flex-1">
        <div className="text-[13px] font-semibold">Implantar no checklist</div>
        <div className="text-[11.5px] text-texto-2">
          A {cat === 'Preferência' ? 'preferência' : 'regra'} entra como item próprio
          na seção "{cat}".
        </div>
      </div>
      <input
        type="checkbox"
        className="pj-check ml-auto"
        title="Já criado no Eproc"
        checked={jaCriado}
        onChange={(e) => setJaCriado(e.target.checked)}
      />
      <span className="mono text-[10.5px] text-texto-3">já criado</span>
    </label>
  );
}

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

function Field({ label, children }: FieldProps) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

interface RecursosResumoProps {
  comuns: number;
  outrasRegras: number;
  cat: 'Regra de ATP' | 'Preferência';
}

/**
 * Diz o que o checklist vai fazer com os outros recursos da mesma aresta. A
 * resposta depende de haver ou não outra regra: com uma só, os recursos são
 * subitens dela; com duas ou mais, não há a quem pendurá-los, e cada um vai
 * para a própria seção (ver `features/checklist/derive.ts`).
 */
function RecursosResumo({ comuns, outrasRegras, cat }: RecursosResumoProps) {
  if (comuns === 0 && outrasRegras === 0) return null;
  const esta = cat === 'Preferência' ? 'esta preferência' : 'esta regra';
  return (
    <div
      className="text-[11.5px] text-texto-2"
      style={{
        padding: '10px 12px',
        border: '1px solid var(--borda)',
        borderRadius: 8,
        background: 'var(--superficie-2)',
      }}
    >
      <div className="font-semibold mb-1 text-texto">
        {comuns} recurso{comuns === 1 ? '' : 's'} atrelado{comuns === 1 ? '' : 's'}
        {outrasRegras > 0 && (
          <>
            {' '}
            e mais {outrasRegras} regra{outrasRegras === 1 ? '' : 's'} nesta transição
          </>
        )}
      </div>
      {outrasRegras > 0
        ? `Como a transição tem mais de uma regra, o checklist lista cada uma como item próprio e os demais recursos nas seções deles.`
        : comuns > 0
          ? `No checklist, aparecerão como subitens d${esta}.`
          : null}
    </div>
  );
}

interface ModalShellProps {
  titulo: string;
  subtitulo: 'ATP' | 'Preferência';
  somenteLeitura: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

function ModalShell({
  titulo,
  subtitulo,
  somenteLeitura,
  onClose,
  children,
}: ModalShellProps) {
  return (
    <>
      <div className="scrim no-print" onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true">
        <div
          className="px-5 pt-4 pb-3 flex items-start gap-3 no-print"
          style={{ borderBottom: '1px solid var(--borda)' }}
        >
          <div
            className="flex items-center justify-center text-destaque"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'var(--destaque-suave)',
              border: '1px solid var(--destaque-borda)',
            }}
          >
            <Icon.Bolt />
          </div>
          <div className="flex-1">
            <div className="section-h">Detalhamento de {subtitulo}</div>
            <div className="text-[14.5px] font-semibold">{titulo}</div>
            <div className="text-[11.5px] text-texto-3 mt-1">
              {somenteLeitura ? (
                <>
                  Sessão de visualização — os campos abaixo mostram como esta{' '}
                  {subtitulo === 'Preferência' ? 'preferência' : 'regra'} foi
                  modelada, mas não aceitam alteração.
                </>
              ) : (
                <>
                  Marque <span className="mono">Implantar no checklist</span> para que
                  esta {subtitulo === 'Preferência' ? 'preferência' : 'regra'} apareça
                  como item a ser criado no Eproc.
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-icon btn-ghost"
            onClick={onClose}
            aria-label="Fechar"
          >
            <Icon.X />
          </button>
        </div>

        {/* `fieldset[disabled]` alcança todo controle aninhado, inclusive os
            `react-select` dos catálogos — um lugar só para desligar o modal. */}
        <fieldset
          disabled={somenteLeitura}
          className="px-5 py-4 flex flex-col gap-3.5 overflow-auto border-0 m-0 min-w-0"
          style={{ maxHeight: '60vh' }}
        >
          {children}
        </fieldset>

        <div
          className="px-5 py-3 flex items-center gap-2 no-print"
          style={{ borderTop: '1px solid var(--borda)' }}
        >
          <div className="text-xs text-texto-3">
            {somenteLeitura
              ? 'Somente leitura — nada aqui altera o plano.'
              : 'As alterações são salvas automaticamente no quadro.'}
          </div>
          <div className="ml-auto flex gap-2">
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Concluído
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
