import type { CSSProperties } from 'react';
import {
  PREF_TIPOS,
  type PrefMinutaModo,
  type PrefRule,
  type PrefTipo,
  type Subitem,
} from '@/domain';
import { cn } from '@/utils/cn';
import { ModalShell } from './ModalShell';
import { Field, ImplantarRow, RecursosResumo } from './pecas';

export interface RegraModalProps {
  nome: string;
  jaCriado: boolean;
  resumo: string;
  recursosComuns: number;
  outrasRegras: number;
  somenteLeitura: boolean;
  onClose: () => void;
  onChange: (patch: Partial<Subitem>) => void;
}

interface PrefModalProps extends RegraModalProps {
  rule: PrefRule | undefined;
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

export function PrefModal({
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
