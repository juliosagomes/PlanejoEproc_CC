import { useId, useMemo } from 'react';
import {
  campoVisivel,
  definirParametro,
  type CampoDef,
  type CampoSimplesDef,
  type OpcaoCampo,
  type Parametros,
  type ValorCampo,
  type ValorSimples,
} from '@/domain';
import { CATALOGOS } from '@/data';
import { CatalogMulti } from '@/components/CatalogMulti';
import { Icon } from '@/components/Icon';
import { cn } from '@/utils/cn';
import { Field } from './pecas';
import { useSugestoes } from './sugestoes';

/* ============================================================================
 * Renderizador único dos campos descritos em `domain/atp/`.
 *
 * As 24 ações programadas e os filtros opcionais do Eproc são desenhados por
 * aqui; nenhum deles tem JSX próprio. Um tipo de campo novo entra em
 * `CampoDef` e ganha um ramo no `Controle` — o `never` no fim garante que o
 * compilador cobre.
 * ========================================================================== */

type Emitir = (valor: ValorCampo | undefined) => void;

// Referência estável: `opcoesDoCampo` alimenta um `useMemo`.
const SEM_OPCOES: ReadonlyArray<OpcaoCampo> = [];

function opcoesDoCampo(campo: CampoSimplesDef): ReadonlyArray<OpcaoCampo> {
  if ((campo.tipo === 'select' || campo.tipo === 'multi') && campo.catalogo) {
    return CATALOGOS[campo.catalogo];
  }
  if (campo.tipo === 'select' || campo.tipo === 'multi' || campo.tipo === 'texto') {
    return campo.opcoes ?? SEM_OPCOES;
  }
  return SEM_OPCOES;
}

interface ControleProps {
  campo: CampoSimplesDef;
  valor: ValorCampo | undefined;
  onChange: Emitir;
}

function Controle({ campo, valor, onChange }: ControleProps) {
  const id = useId();
  const sugestoes = useSugestoes(
    campo.tipo === 'texto' || campo.tipo === 'multi' ? campo.sugestao : undefined,
  );
  const opcoes = opcoesDoCampo(campo);

  const itensMulti = useMemo(
    () =>
      opcoes.length > 0 ? opcoes : sugestoes.map((nome) => ({ value: nome, label: nome })),
    [opcoes, sugestoes],
  );

  switch (campo.tipo) {
    case 'texto': {
      const lista = [...opcoes.map((o) => o.label), ...sugestoes];
      return (
        <>
          <input
            className="input"
            list={lista.length > 0 ? id : undefined}
            value={typeof valor === 'string' ? valor : ''}
            onChange={(e) => onChange(e.target.value)}
            aria-label={campo.rotulo}
          />
          {lista.length > 0 && (
            <datalist id={id}>
              {lista.map((nome) => (
                <option key={nome} value={nome} />
              ))}
            </datalist>
          )}
        </>
      );
    }
    case 'textarea':
      return (
        <textarea
          className="textarea"
          rows={3}
          value={typeof valor === 'string' ? valor : ''}
          onChange={(e) => onChange(e.target.value)}
          aria-label={campo.rotulo}
        />
      );
    case 'numero':
      return (
        <input
          className="input"
          type="number"
          min={0}
          value={typeof valor === 'number' ? valor : ''}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          aria-label={campo.rotulo}
        />
      );
    case 'data':
      return (
        <input
          className="input"
          type="date"
          value={typeof valor === 'string' ? valor : ''}
          onChange={(e) => onChange(e.target.value)}
          aria-label={campo.rotulo}
        />
      );
    case 'simNao':
      // Três estados, e não um checkbox: no plano, "não decidi" é diferente de
      // "Não" — e o checklist só lista o que foi decidido.
      return (
        <select
          className="select"
          value={valor === true ? 'S' : valor === false ? 'N' : ''}
          onChange={(e) =>
            onChange(e.target.value === '' ? undefined : e.target.value === 'S')
          }
          aria-label={campo.rotulo}
        >
          <option value="">—</option>
          <option value="S">Sim</option>
          <option value="N">Não</option>
        </select>
      );
    case 'select': {
      const atual = typeof valor === 'string' ? valor : '';
      const desconhecido = atual !== '' && !opcoes.some((o) => o.value === atual);
      return (
        <select
          className="select"
          value={atual}
          onChange={(e) => onChange(e.target.value)}
          aria-label={campo.rotulo}
        >
          <option value="">— selecione —</option>
          {/* Código gravado que o catálogo embutido não tem mais: continua
              visível, em vez de o select voltar calado para "selecione". */}
          {desconhecido && <option value={atual}>{atual}</option>}
          {opcoes.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    }
    case 'multi':
      return (
        <CatalogMulti
          values={
            Array.isArray(valor)
              ? (valor as unknown[]).filter((v): v is string => typeof v === 'string')
              : []
          }
          options={itensMulti}
          onChange={onChange}
          criavel={campo.livre === true}
          placeholder={campo.livre ? 'Digite e tecle Enter…' : 'Buscar…'}
          ariaLabel={campo.rotulo}
        />
      );
    default: {
      const _exaustivo: never = campo;
      return _exaustivo;
    }
  }
}

/** Campos curtos dividem a linha; os que precisam de largura ocupam as duas colunas. */
function largo(campo: CampoDef): boolean {
  return (
    campo.tipo === 'multi' ||
    campo.tipo === 'textarea' ||
    campo.tipo === 'lista' ||
    campo.tipo === 'texto'
  );
}

interface ParametrosFormProps {
  campos: ReadonlyArray<CampoDef>;
  valores: Parametros;
  onChange: (valores: Parametros) => void;
  /** Para o filtro de um campo só, cujo título já diz o que o campo é. */
  semRotulo?: boolean;
}

export function ParametrosForm({ campos, valores, onChange, semRotulo }: ParametrosFormProps) {
  if (campos.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
      {campos.map((campo) => {
        if (!campoVisivel(campo, valores)) return null;
        const emitir: Emitir = (v) => onChange(definirParametro(valores, campo.chave, v));
        const valor = valores[campo.chave];
        return (
          <div key={campo.chave} className={cn(largo(campo) && 'col-span-2')}>
            {campo.tipo === 'lista' ? (
              <ListaCampo campo={campo} valor={valor} onChange={emitir} />
            ) : semRotulo ? (
              <Controle campo={campo} valor={valor} onChange={emitir} />
            ) : (
              <Field label={campo.rotulo} ajuda={campo.ajuda}>
                <Controle campo={campo} valor={valor} onChange={emitir} />
              </Field>
            )}
          </div>
        );
      })}
    </div>
  );
}

type ItemLista = Record<string, ValorSimples>;

interface ListaCampoProps {
  campo: Extract<CampoDef, { tipo: 'lista' }>;
  valor: ValorCampo | undefined;
  onChange: Emitir;
}

/**
 * Lista de condições — "que contenha o(s) evento(s) X E que NÃO contenha…",
 * advogados, pessoas. No Eproc é um formulário com botão "Incluir" e uma
 * tabela embaixo; aqui cada item fica aberto para edição no lugar.
 */
function ListaCampo({ campo, valor, onChange }: ListaCampoProps) {
  const itens: ItemLista[] = Array.isArray(valor)
    ? (valor as unknown[]).filter(
        (v): v is ItemLista => typeof v === 'object' && v !== null,
      )
    : [];

  const trocar = (i: number, novo: Parametros) =>
    // Os subcampos são todos simples, então o que volta do formulário cabe em
    // `ItemLista` — o tipo de `Parametros` é só mais largo do que o necessário.
    onChange(itens.map((item, j) => (j === i ? (novo as ItemLista) : item)));

  return (
    <div className="flex flex-col gap-2">
      {itens.map((item, i) => (
        <div
          key={i}
          className="flex items-start gap-2"
          style={{
            padding: '8px 10px',
            border: '1px solid var(--borda)',
            borderRadius: 8,
            background: 'var(--superficie-2)',
          }}
        >
          <div className="flex-1 min-w-0">
            <ParametrosForm
              campos={campo.subcampos}
              valores={item}
              onChange={(novo) => trocar(i, novo)}
            />
          </div>
          <button
            type="button"
            className="btn btn-icon btn-sm btn-ghost"
            onClick={() => onChange(itens.filter((_, j) => j !== i))}
            title="Remover"
            aria-label="Remover"
          >
            <Icon.X />
          </button>
        </div>
      ))}
      <div>
        <button type="button" className="btn btn-sm" onClick={() => onChange([...itens, {}])}>
          <Icon.Plus /> {campo.rotuloItem}
        </button>
      </div>
    </div>
  );
}
