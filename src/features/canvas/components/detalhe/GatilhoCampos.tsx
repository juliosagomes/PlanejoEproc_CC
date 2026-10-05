import {
  DIAS_SEMANA,
  TIPOS_DATA_CONTROLE,
  type AtpTrigger,
  type TipoControle,
  type TipoDataControle,
} from '@/domain';
import { POLOS_PETICAO, STATUS_PROCESSO, TIPOS_PETICAO } from '@/data';
import { CatalogMulti } from '@/components/CatalogMulti';
import { EventosMulti } from '@/features/eventos/components/EventosMulti';
import { Field } from './pecas';

/* ============================================================================
 * Campos do gatilho, conforme o TIPO DE CONTROLE — os mesmos que a tela do
 * Eproc mostra ao trocar o select, com os mesmos rótulos.
 *
 * Escritos à mão, ao contrário das ações e dos filtros: são nove variantes
 * fixas e tipadas no domínio, e um descritor aqui só trocaria checagem de tipo
 * por indireção.
 * ========================================================================== */

/**
 * Troca o tipo de controle levando o que as duas variantes têm em comum. Sem
 * isso, corrigir "Por Evento" para "Por Evento OU Tipo de Petição OU
 * Documento" apagaria a lista de eventos já escolhida.
 */
export function trocarTipoControle(
  atual: AtpTrigger | undefined,
  tipo: TipoControle,
): AtpTrigger {
  const eventos =
    atual && (atual.tipo === 'A' || atual.tipo === 'E') && atual.eventoIds
      ? { eventoIds: atual.eventoIds }
      : {};
  const peticoes =
    atual && (atual.tipo === 'A' || atual.tipo === 'P')
      ? {
          ...(atual.peticaoTipoIds ? { peticaoTipoIds: atual.peticaoTipoIds } : {}),
          ...(atual.restringirA ? { restringirA: atual.restringirA } : {}),
          ...(atual.entidade ? { entidade: atual.entidade } : {}),
        }
      : {};
  const dias =
    atual && (atual.tipo === 'L' || atual.tipo === 'S' || atual.tipo === 'V') && atual.dias != null
      ? { dias: atual.dias }
      : {};
  const uteis =
    atual && (atual.tipo === 'L' || atual.tipo === 'S') && atual.diasUteis
      ? { diasUteis: true }
      : {};

  switch (tipo) {
    case 'A':
      return { tipo, ...eventos, ...peticoes };
    case 'E':
      return { tipo, ...eventos };
    case 'P':
      return { tipo, ...peticoes };
    case 'L':
      return { tipo, ...dias, ...uteis };
    case 'S':
      return { tipo, ...dias, ...uteis };
    case 'V':
      return { tipo, ...dias };
    case 'O':
    case 'D':
    case 'M':
      return { tipo };
  }
}

interface GatilhoCamposProps {
  trigger: AtpTrigger;
  setTrigger: (t: AtpTrigger) => void;
}

function numero(texto: string): number | undefined {
  return texto === '' ? undefined : Number(texto);
}

interface DiasProps {
  rotulo: string;
  dias: number | undefined;
  setDias: (n: number | undefined) => void;
  /** Ausente quando o tipo de controle não tem "contar apenas dias úteis". */
  uteis?: { valor: boolean; set: (v: boolean) => void };
}

function Dias({ rotulo, dias, setDias, uteis }: DiasProps) {
  return (
    <div className="flex items-end gap-4">
      <Field label={rotulo} className="w-56">
        <input
          className="input"
          type="number"
          min={0}
          value={dias ?? ''}
          onChange={(e) => setDias(numero(e.target.value))}
        />
      </Field>
      {uteis && (
        <label className="flex items-center gap-2 cursor-pointer text-[12.5px] pb-1.5">
          <input
            type="checkbox"
            className="pj-check"
            checked={uteis.valor}
            onChange={(e) => uteis.set(e.target.checked)}
          />
          Contar apenas dias úteis
        </label>
      )}
    </div>
  );
}

interface RestringirProps {
  rotulo: string;
  restringirA: string | undefined;
  entidade: string | undefined;
  onChange: (patch: { restringirA?: string; entidade?: string }) => void;
}

function Restringir({ rotulo, restringirA, entidade, onChange }: RestringirProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label={rotulo}>
        <select
          className="select"
          // "QUALQUER PARTE" é o padrão da tela do Eproc.
          value={restringirA ?? 'Q'}
          onChange={(e) =>
            onChange({
              restringirA: e.target.value,
              // A entidade só existe para "ENTIDADE ESPECÍFICA".
              ...(e.target.value === 'S' && entidade ? { entidade } : {}),
            })
          }
        >
          {POLOS_PETICAO.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </Field>
      {restringirA === 'S' && (
        <Field label="Entidade">
          <input
            className="input"
            value={entidade ?? ''}
            onChange={(e) => onChange({ restringirA, entidade: e.target.value })}
          />
        </Field>
      )}
    </div>
  );
}

export function GatilhoCampos({ trigger, setTrigger }: GatilhoCamposProps) {
  const t = trigger;

  switch (t.tipo) {
    case 'A':
    case 'E':
    case 'P': {
      // Remonta o gatilho sem as chaves de restrição antes de aplicar o patch:
      // um spread simples deixaria `entidade` para trás ao sair de "ENTIDADE
      // ESPECÍFICA".
      const setRestricao = (patch: { restringirA?: string; entidade?: string }) => {
        if (t.tipo === 'E') return;
        const { restringirA: _r, entidade: _e, ...resto } = t;
        setTrigger({ ...resto, ...patch });
      };
      return (
        <>
          {(t.tipo === 'A' || t.tipo === 'E') && (
            <Field label="Evento">
              <EventosMulti
                values={t.eventoIds ?? []}
                onChange={(ids) => setTrigger({ ...t, eventoIds: ids })}
                ariaLabel="Eventos do gatilho"
              />
            </Field>
          )}
          {(t.tipo === 'A' || t.tipo === 'P') && (
            <Field label={t.tipo === 'A' ? 'Tipo de Petição' : 'Petição'}>
              <CatalogMulti
                values={t.peticaoTipoIds ?? []}
                options={TIPOS_PETICAO}
                onChange={(ids) => setTrigger({ ...t, peticaoTipoIds: ids })}
                placeholder="Buscar tipo de petição…"
                ariaLabel="Tipos de petição do gatilho"
              />
            </Field>
          )}
          {t.tipo === 'A' && (
            <Field
              label="Documento"
              ajuda="O catálogo de tipos de documento do Eproc não vem embutido: digite o nome e tecle Enter."
            >
              <CatalogMulti
                values={t.documentos ?? []}
                options={[]}
                onChange={(nomes) => setTrigger({ ...t, documentos: nomes })}
                criavel
                placeholder="Tipo de documento…"
                ariaLabel="Tipos de documento do gatilho"
              />
            </Field>
          )}
          {t.tipo !== 'E' && (
            <Restringir
              rotulo={
                t.tipo === 'A'
                  ? 'Restringir petições ou documentos de'
                  : 'Restringir petições de'
              }
              restringirA={t.restringirA}
              entidade={t.entidade}
              onChange={setRestricao}
            />
          )}
        </>
      );
    }
    case 'O':
      return (
        <Field label="Tipo Documento">
          <input
            className="input"
            value={t.documento ?? ''}
            onChange={(e) => setTrigger({ tipo: 'O', documento: e.target.value })}
          />
        </Field>
      );
    case 'D':
      return (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo Data Controle">
            <select
              className="select"
              value={t.tipoData ?? ''}
              onChange={(e) =>
                // Trocar o modo descarta o valor do modo anterior: uma data
                // específica não significa nada em "dia da semana".
                setTrigger(
                  e.target.value
                    ? { tipo: 'D', tipoData: e.target.value as TipoDataControle }
                    : { tipo: 'D' },
                )
              }
            >
              <option value="">— selecione —</option>
              {TIPOS_DATA_CONTROLE.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          {t.tipoData === 'D' && (
            <Field label="Data Controle">
              <input
                className="input"
                type="date"
                value={t.data ?? ''}
                onChange={(e) => setTrigger({ tipo: 'D', tipoData: 'D', data: e.target.value })}
              />
            </Field>
          )}
          {t.tipoData === 'M' && (
            <Field label="Data Controle (dia do mês)">
              <input
                className="input"
                type="number"
                min={1}
                max={31}
                value={t.diaMes ?? ''}
                onChange={(e) => {
                  const dia = numero(e.target.value);
                  setTrigger({
                    tipo: 'D',
                    tipoData: 'M',
                    ...(dia != null ? { diaMes: dia } : {}),
                  });
                }}
              />
            </Field>
          )}
          {t.tipoData === 'S' && (
            <Field label="Data Controle (dia da semana)">
              <select
                className="select"
                value={t.diaSemana ?? ''}
                onChange={(e) =>
                  setTrigger({
                    tipo: 'D',
                    tipoData: 'S',
                    ...(e.target.value ? { diaSemana: e.target.value } : {}),
                  })
                }
              >
                <option value="">— selecione —</option>
                {DIAS_SEMANA.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
      );
    case 'L':
      return (
        <Dias
          rotulo="Número de Dias no Localizador"
          dias={t.dias}
          setDias={(dias) => setTrigger({ ...t, dias })}
          uteis={{
            valor: t.diasUteis === true,
            set: (diasUteis) => setTrigger({ ...t, diasUteis }),
          }}
        />
      );
    case 'S':
      return (
        <>
          <Field label="Por Situação do Processo">
            <select
              className="select"
              value={t.statusId ?? ''}
              onChange={(e) => setTrigger({ ...t, statusId: e.target.value })}
            >
              <option value="">— selecione —</option>
              {STATUS_PROCESSO.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Dias
            rotulo="Número de Dias na Situação"
            dias={t.dias}
            setDias={(dias) => setTrigger({ ...t, dias })}
            uteis={{
              valor: t.diasUteis === true,
              set: (diasUteis) => setTrigger({ ...t, diasUteis }),
            }}
          />
        </>
      );
    case 'V':
      return (
        <Dias
          rotulo="Número de Dias sem movimentação"
          dias={t.dias}
          setDias={(dias) => setTrigger({ tipo: 'V', dias })}
        />
      );
    case 'M':
      return (
        <>
          <Field label="Descrição da Regra">
            <input
              className="input"
              value={t.descricao ?? ''}
              onChange={(e) => setTrigger({ ...t, descricao: e.target.value })}
            />
          </Field>
          <label className="flex items-center gap-2 cursor-pointer text-[12.5px]">
            <input
              type="checkbox"
              className="pj-check"
              checked={t.acaoPreferencialNaCapa === true}
              onChange={(e) => setTrigger({ ...t, acaoPreferencialNaCapa: e.target.checked })}
            />
            Mostrar como ação preferencial na capa do processo
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-[12.5px]">
            <input
              type="checkbox"
              className="pj-check"
              checked={t.umClique === true}
              onChange={(e) => setTrigger({ ...t, umClique: e.target.checked })}
            />
            Execução em um único clique
          </label>
        </>
      );
  }
}
