import {
  PREF_TIPOS,
  TIPO_CONTROLE_VALUES,
  type AtpFiltros,
  type AtpRule,
  type AtpTrigger,
  type EdgeData,
  type PrefRule,
  type PrefTipo,
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

/* ============================================================================
 * Modal de detalhamento de ATP / Preferência.
 *
 * Recebe `edgeData.atp` ou `edgeData.pref` e devolve patches via `onChange`.
 * Os campos do bloco do gatilho (trigger) variam conforme o `tipo` escolhido:
 * só o subset relevante é exibido.
 * ========================================================================== */

interface EdgeDetailModalProps {
  open: boolean;
  onClose: () => void;
  edgeData: EdgeData;
  /** Patch parcial sobre EdgeData (em geral mudando atp/pref). */
  onChange: (patch: Partial<EdgeData>) => void;
}

export function EdgeDetailModal({ open, onClose, edgeData, onChange }: EdgeDetailModalProps) {
  if (!open || edgeData.kind === 'manual') return null;

  if (edgeData.kind === 'atp') {
    return (
      <AtpModal
        rule={edgeData.atp}
        resumo={edgeData.resumo}
        subitemsCount={edgeData.subitems.length}
        onClose={onClose}
        onChange={(rule) => onChange({ atp: rule })}
      />
    );
  }
  return (
    <PrefModal
      rule={edgeData.pref}
      resumo={edgeData.resumo}
      subitemsCount={edgeData.subitems.length}
      onClose={onClose}
      onChange={(rule) => onChange({ pref: rule })}
    />
  );
}

/* ====================== Pref ============================================== */

interface PrefModalProps {
  rule: PrefRule | undefined;
  resumo: string;
  subitemsCount: number;
  onClose: () => void;
  onChange: (rule: PrefRule) => void;
}

function PrefModal({ rule, resumo, subitemsCount, onClose, onChange }: PrefModalProps) {
  const r: PrefRule = rule ?? { implantar: false, ja_criado: false, nome: '' };
  const setR = (patch: Partial<PrefRule>) => onChange({ ...r, ...patch });
  return (
    <ModalShell
      titulo={r.nome || resumo || 'Preferência'}
      subtitulo="Preferência"
      onClose={onClose}
    >
      <ImplantarRow rule={r} setR={setR} cat="Preferência" />

      <Field label="Nome da preferência">
        <input
          className="input"
          placeholder="Ex.: Preferência de processos com prioridade legal"
          value={r.nome}
          onChange={(e) => setR({ nome: e.target.value })}
        />
      </Field>

      <Field label="Tipo de preferência">
        <div className="grid grid-cols-2 gap-1.5">
          {PREF_TIPOS.map((opt) => (
            <button
              key={opt}
              type="button"
              className={cn('btn btn-sm justify-center', r.tipo === opt && 'btn-primary')}
              onClick={() => setR({ tipo: opt as PrefTipo })}
            >
              {opt}
            </button>
          ))}
        </div>
      </Field>

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

      <RecursosResumo n={subitemsCount} cat="Preferência" />
    </ModalShell>
  );
}

/* ====================== ATP =============================================== */

interface AtpModalProps {
  rule: AtpRule | undefined;
  resumo: string;
  subitemsCount: number;
  onClose: () => void;
  onChange: (rule: AtpRule) => void;
}

function AtpModal({ rule, resumo, subitemsCount, onClose, onChange }: AtpModalProps) {
  const r: AtpRule = rule ?? { implantar: false, ja_criado: false, nome: '' };
  const setR = (patch: Partial<AtpRule>) => onChange({ ...r, ...patch });
  const setTrigger = (patch: AtpTrigger) => setR({ trigger: patch });
  const setFiltros = (patch: Partial<AtpFiltros>) =>
    setR({ filtros: { ...(r.filtros ?? {}), ...patch } });

  return (
    <ModalShell
      titulo={r.nome || resumo || 'Regra de ATP'}
      subtitulo="ATP"
      onClose={onClose}
    >
      <ImplantarRow rule={r} setR={setR} cat="Regra de ATP" />

      <Field label="Nome da regra">
        <input
          className="input"
          placeholder="Ex.: Após citação válida, mover para conclusão"
          value={r.nome}
          onChange={(e) => setR({ nome: e.target.value })}
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

      <RecursosResumo n={subitemsCount} cat="Regra de ATP" />
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

interface ImplantarRowProps {
  rule: { implantar: boolean; ja_criado: boolean };
  setR: (patch: { implantar?: boolean; ja_criado?: boolean }) => void;
  cat: 'Regra de ATP' | 'Preferência';
}

function ImplantarRow({ rule, setR, cat }: ImplantarRowProps) {
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
        checked={rule.implantar}
        onChange={(e) => setR({ implantar: e.target.checked })}
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
        checked={rule.ja_criado}
        onChange={(e) => setR({ ja_criado: e.target.checked })}
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
  n: number;
  cat: 'Regra de ATP' | 'Preferência';
}

function RecursosResumo({ n, cat }: RecursosResumoProps) {
  if (n === 0) return null;
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
        {n} recurso{n === 1 ? '' : 's'} atrelado{n === 1 ? '' : 's'}
      </div>
      No checklist, aparecerão como subitens d
      {cat === 'Preferência' ? 'esta preferência' : 'esta regra'}.
    </div>
  );
}

interface ModalShellProps {
  titulo: string;
  subtitulo: 'ATP' | 'Preferência';
  onClose: () => void;
  children: React.ReactNode;
}

function ModalShell({ titulo, subtitulo, onClose, children }: ModalShellProps) {
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
              Marque <span className="mono">Implantar no checklist</span> para que esta{' '}
              {subtitulo === 'Preferência' ? 'preferência' : 'regra'} apareça como item
              a ser criado no Eproc, com seus recursos atrelados como subitens.
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

        <div
          className="px-5 py-4 flex flex-col gap-3.5 overflow-auto"
          style={{ maxHeight: '60vh' }}
        >
          {children}
        </div>

        <div
          className="px-5 py-3 flex items-center gap-2 no-print"
          style={{ borderTop: '1px solid var(--borda)' }}
        >
          <div className="text-xs text-texto-3">
            As alterações são salvas automaticamente no quadro.
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
