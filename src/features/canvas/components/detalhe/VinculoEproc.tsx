import { useMemo, useState } from 'react';
import type { AtpRule } from '@/domain';
import { Icon } from '@/components/Icon';
import { useUnidadeStore } from '@/features/catalogo/storeUnidade';
import { conferirRegra, regraDoEproc } from '../../conferirRegra';
import { Field } from './pecas';

interface VinculoEprocProps {
  numero: number | undefined;
  onNumero: (n: number | undefined) => void;
  regraAtual: AtpRule | undefined;
  origem: string;
  destino: string;
  pendurada: boolean;
  somenteLeitura: boolean;
  /** Troca o detalhe do recurso pelo do Eproc, e o marca como já criado. */
  onAplicar: (rule: AtpRule) => void;
}

/**
 * O nº da regra no Eproc e a conferência com ela (decisoes.md#D-46). O nº vem
 * do usuário ou de "desenhar a partir da regra"; com ele, "Sincronizar esta
 * regra" lê só ela no Eproc, e o bloco mostra o que difere.
 */
export function VinculoEproc({
  numero,
  onNumero,
  regraAtual,
  origem,
  destino,
  pendurada,
  somenteLeitura,
  onAplicar,
}: VinculoEprocProps) {
  const catalogo = useUnidadeStore((s) => s.catalogo);
  const sincronizarRegra = useUnidadeStore((s) => s.sincronizarRegraAtp);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const regra = numero ? catalogo?.regrasAtp?.find((r) => r.numero === numero) : undefined;
  const pontas = { origem, destino, pendurada };
  const conferencia = useMemo(
    () => (regra ? conferirRegra(regra, regraAtual, pontas) : null),
    // `pontas` é recriado a cada render; o que importa são os três valores.
    [regra, regraAtual, origem, destino, pendurada],
  );

  const sincronizar = async () => {
    if (!numero) return;
    setLendo(true);
    setErro(null);
    const r = await sincronizarRegra(numero);
    setLendo(false);
    if (!r.ok) setErro(r.erro);
  };

  const semDetalheNoPlano = !regraAtual?.trigger && !(regraAtual?.acoes?.length);

  return (
    <div className="flex flex-col gap-2" data-alvo="vinculo">
      <Field
        label="Nº da regra no Eproc"
        ajuda="Com o nº, dá para trazer só esta regra do Eproc e conferir o que está aqui."
      >
        <div className="flex gap-2 items-center">
          <input
            className="input !w-28"
            type="number"
            min={1}
            inputMode="numeric"
            placeholder="Ex.: 182"
            value={numero ?? ''}
            onChange={(e) => {
              const n = Number(e.target.value);
              onNumero(Number.isInteger(n) && n > 0 ? n : undefined);
            }}
            aria-label="Número da regra no Eproc"
          />
          <button
            type="button"
            className="btn btn-sm"
            disabled={!numero || lendo}
            onClick={() => void sincronizar()}
            title="Lê só esta regra no Eproc, na aba onde você está logado. Só leitura."
          >
            <Icon.Sincronizar /> {lendo ? 'Lendo no Eproc…' : 'Sincronizar esta regra'}
          </button>
        </div>
      </Field>

      {erro && (
        <p className="text-[12px] text-aviso" role="alert">
          {erro}
        </p>
      )}

      {numero && !regra && !lendo && !erro && (
        <p className="text-[12px] text-texto-3">
          A regra {numero} não está no catálogo da unidade. Clique em "Sincronizar esta regra".
        </p>
      )}

      {regra && conferencia && (
        <div
          className="text-[12px] text-texto-2 flex flex-col gap-1.5"
          style={{ border: '1px solid var(--borda)', borderRadius: 8, padding: '8px 10px' }}
        >
          <div>
            <b className="text-texto">Regra {regra.numero}</b> · {regra.tipoControle}
            {regra.descricao ? ` · ${regra.descricao}` : ''}
            {regra.grupo ? ` · grupo ${regra.grupo}` : ''}
            {!regra.ativa ? ' · desativada' : ''}
          </div>

          {conferencia.pontas.map((p) => (
            <div key={p} className="text-aviso">
              {p}
            </div>
          ))}

          {!conferencia.comDetalhe ? (
            <div className="text-texto-3">
              Só a lista veio do Eproc. Clique em "Sincronizar esta regra" para trazer o detalhe e
              conferir campo a campo.
            </div>
          ) : conferencia.campos.length === 0 ? (
            conferencia.pontas.length === 0 && <div className="text-ok">Confere com o Eproc.</div>
          ) : (
            <>
              <div className="font-semibold text-texto">
                {semDetalheNoPlano
                  ? 'O Eproc tem o detalhe que falta aqui:'
                  : `${conferencia.campos.length} campo(s) diferente(s) do Eproc:`}
              </div>
              <ul className="flex flex-col gap-1">
                {conferencia.campos.map((c) => (
                  <li key={c.label}>
                    <span className="font-semibold">{c.label}</span>
                    {!semDetalheNoPlano && (
                      <span className="block text-texto-3 whitespace-pre-line">
                        Aqui: {c.plano ?? '—'}
                      </span>
                    )}
                    <span className="block whitespace-pre-line">Eproc: {c.eproc ?? '—'}</span>
                  </li>
                ))}
              </ul>
              {!somenteLeitura && (
                <div>
                  <button
                    type="button"
                    className="btn btn-sm btn-accent"
                    onClick={() => onAplicar(regraDoEproc(regra, regraAtual, pontas))}
                  >
                    <Icon.CheckCorner />{' '}
                    {semDetalheNoPlano ? 'Preencher com o do Eproc' : 'Atualizar com o do Eproc'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
