import { useMemo, useState } from 'react';
import type { RegraAtpUnidade } from '@/domain';
import { useCanvasStore } from '@/features/canvas/store';
import { useUnidadeStore } from '@/features/catalogo/storeUnidade';
import { useDescarteStore } from '@/features/descarte/store';
import { semDecoracao } from '@/infra/eproc/nomeLocalizador';
import { cn } from '@/utils/cn';
import { usePlanosDoSilo } from '../dados';
import { presencaDasRegras, type EstadoPresenca, type PresencaRegra } from '../presencaRegras';
import { useObservacoesRegrasStore } from '../storeObservacoes';

type FiltroSelo = 'todas' | EstadoPresenca;
type FiltroSituacao = 'todas' | 'ativas' | 'desativadas';

const ROTULO_SELO: Record<EstadoPresenca, string> = {
  emPlano: 'Em plano',
  divergente: 'Divergente',
  ausente: 'Em nenhum plano',
};

/**
 * A guia "Regras de ATP" do painel (decisoes.md#D-46): as regras da unidade
 * agrupadas como no Eproc, com a observação do usuário e o selo de presença
 * nos planos do silo. Só leitura do Eproc; o que se edita é a observação.
 */
export function RegrasAtpAba() {
  const catalogo = useUnidadeStore((s) => s.catalogo);
  const descarte = useDescarteStore((s) => s.nomes);
  const planos = usePlanosDoSilo();
  const regras = useMemo(() => catalogo?.regrasAtp ?? [], [catalogo]);
  const presenca = useMemo(() => presencaDasRegras(planos, regras, descarte), [planos, regras, descarte]);
  const observacoes = useObservacoesRegrasStore((s) => s.itens);

  const [selo, setSelo] = useState<FiltroSelo>('todas');
  const [situacao, setSituacao] = useState<FiltroSituacao>('todas');
  const [grupo, setGrupo] = useState('');
  const [busca, setBusca] = useState('');

  const grupos = useMemo(() => [...new Set(regras.map((r) => r.grupo ?? 'Sem grupo'))], [regras]);
  const contagem = useMemo(() => {
    const c: Record<FiltroSelo, number> = { todas: regras.length, emPlano: 0, divergente: 0, ausente: 0 };
    for (const r of regras) c[presenca.porNumero.get(r.numero)?.estado ?? 'ausente'] += 1;
    return c;
  }, [regras, presenca]);

  const visiveis = useMemo(() => {
    const alvo = semDecoracao(busca);
    return regras.filter((r) => {
      if (selo !== 'todas' && (presenca.porNumero.get(r.numero)?.estado ?? 'ausente') !== selo) return false;
      if (situacao === 'ativas' && !r.ativa) return false;
      if (situacao === 'desativadas' && r.ativa) return false;
      if (grupo && (r.grupo ?? 'Sem grupo') !== grupo) return false;
      if (!alvo) return true;
      if (/^\d+$/.test(busca.trim())) return String(r.numero).startsWith(busca.trim());
      return semDecoracao(textoDeBusca(r, observacoes[r.numero])).includes(alvo);
    });
  }, [regras, presenca, selo, situacao, grupo, busca, observacoes]);

  const porGrupo = useMemo(() => {
    const m = new Map<string, RegraAtpUnidade[]>();
    for (const r of visiveis) {
      const g = r.grupo ?? 'Sem grupo';
      m.set(g, [...(m.get(g) ?? []), r]);
    }
    return [...m.entries()];
  }, [visiveis]);

  if (regras.length === 0) {
    return (
      <p className="text-[12.5px] text-texto-3 leading-snug">
        Nenhuma regra de ATP sincronizada ainda. Use <b>Unidade → Sincronizar com a unidade</b>, com
        o Eproc aberto numa aba.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5 flex-wrap">
        {(['todas', 'emPlano', 'divergente', 'ausente'] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={cn('btn btn-sm', selo === s && 'btn-primary')}
            aria-pressed={selo === s}
            onClick={() => setSelo(s)}
          >
            {s === 'todas' ? 'Todas' : ROTULO_SELO[s]}
            <span className="mono ml-1 text-[10.5px] opacity-70">{contagem[s]}</span>
          </button>
        ))}
        <select
          className="select !w-auto"
          value={situacao}
          onChange={(e) => setSituacao(e.target.value as FiltroSituacao)}
          aria-label="Situação no Eproc"
        >
          <option value="todas">Ativas e desativadas</option>
          <option value="ativas">Só ativas</option>
          <option value="desativadas">Só desativadas</option>
        </select>
        <select
          className="select !w-auto"
          value={grupo}
          onChange={(e) => setGrupo(e.target.value)}
          aria-label="Grupo no Eproc"
        >
          <option value="">Todos os grupos</option>
          {grupos.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <input
          className="input flex-1 min-w-[200px]"
          type="search"
          placeholder="Nº, localizador, descrição ou observação…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          aria-label="Buscar regra de ATP"
        />
      </div>

      {porGrupo.length === 0 && <p className="text-[12px] text-texto-3">Nenhuma regra com esses filtros.</p>}

      {porGrupo.map(([g, rs]) => (
        <section key={g} className="flex flex-col gap-1.5" aria-label={`Grupo ${g}`}>
          <h3 className="section-h flex items-baseline gap-2">
            {g} <span className="mono text-[10.5px] text-texto-3 font-normal">{rs.length}</span>
          </h3>
          <div className="bg-superficie border border-borda rounded-lg overflow-hidden divide-y divide-borda">
            {rs.map((r) => (
              <LinhaRegra
                key={r.numero}
                regra={r}
                presenca={presenca.porNumero.get(r.numero) ?? { estado: 'ausente', citacoes: [] }}
                observacao={observacoes[r.numero] ?? ''}
              />
            ))}
          </div>
        </section>
      ))}

      {presenca.citadasInexistentes.length > 0 && (
        <section className="flex flex-col gap-1.5" aria-label="Citadas nos planos e ausentes do Eproc">
          <h3 className="section-h">Citadas nos planos, mas não existem no Eproc</h3>
          <ul className="text-[12px] text-texto-2 flex flex-col gap-1">
            {presenca.citadasInexistentes.map(({ numero, citacoes }) => (
              <li key={numero}>
                <b className="mono">{numero}</b> —{' '}
                {citacoes.map((c) => `${c.planoNome}: ${c.onde}`).join('; ')}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function textoDeBusca(r: RegraAtpUnidade, observacao: string | undefined): string {
  return [
    ...r.origens,
    ...r.destinos,
    ...(r.filtroContem ?? []),
    r.descricao ?? '',
    r.grupo ?? '',
    r.tipoControle,
    observacao ?? '',
  ].join(' ');
}

function pontas(r: RegraAtpUnidade): string {
  const origem =
    r.tipoOrigem === 'nenhum'
      ? `Nenhum${r.filtroContem?.length ? ` (filtro: ${r.filtroContem.join(', ')})` : ''}`
      : r.tipoOrigem === 'todos'
        ? 'Todos os localizadores'
        : r.origens.join(r.opcaoOrigens === 'AND' ? ' E ' : ' OU ');
  return `${origem} → ${r.destinos.join(' E ') || '—'}`;
}

interface LinhaRegraProps {
  regra: RegraAtpUnidade;
  presenca: PresencaRegra;
  observacao: string;
}

function LinhaRegra({ regra: r, presenca, observacao }: LinhaRegraProps) {
  const [aberto, setAberto] = useState(false);
  const definir = useObservacoesRegrasStore((s) => s.definir);
  const somenteLeitura = useCanvasStore((s) => s.somenteLeitura);
  const divergencias = presenca.citacoes.flatMap((c) => c.divergencias);

  return (
    <div className={cn(!r.ativa && 'opacity-70')}>
      <button
        type="button"
        className="w-full text-left grid grid-cols-[44px_minmax(0,1fr)_auto] gap-x-2.5 px-3 py-2 bg-transparent cursor-pointer"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
      >
        <span className="mono text-[12px] font-bold text-destaque pt-px">{r.numero}</span>
        <span className="min-w-0">
          <span className="block text-[12.5px] font-medium break-words">{pontas(r)}</span>
          <span className="block text-[11px] text-texto-3">
            {r.tipoControle}
            {r.descricao ? ` · ${r.descricao}` : ''}
            {!r.ativa ? ' · desativada' : ''}
          </span>
          {observacao && <span className="block text-[11.5px] text-texto-2 mt-0.5">{observacao}</span>}
        </span>
        <Selo estado={presenca.estado} titulo={presenca.citacoes.map((c) => c.planoNome).join(', ')} />
      </button>

      {aberto && (
        <div className="px-3 pb-3 pt-1 flex flex-col gap-2 bg-superficie-2 text-[12px] text-texto-2">
          {r.gatilhoTexto && <Campo rotulo="Tipo de controle">{r.gatilhoTexto}</Campo>}
          {r.acoesTexto?.map((a, i) => (
            <Campo key={i} rotulo={r.acoesTexto && r.acoesTexto.length > 1 ? `Ação ${i + 1}` : 'Ação'}>
              {a}
            </Campo>
          ))}
          {r.filtrosTexto?.length ? <Campo rotulo="Filtros">{r.filtrosTexto.join(' · ')}</Campo> : null}
          {presenca.citacoes.length > 0 && (
            <Campo rotulo="Nos planos">
              <ul className="flex flex-col gap-0.5">
                {presenca.citacoes.map((c, i) => (
                  <li key={i}>
                    {c.planoNome}: {c.onde}
                    {c.divergencias.length > 0 && (
                      <span className="text-aviso"> — {c.divergencias.join(' ')}</span>
                    )}
                  </li>
                ))}
              </ul>
            </Campo>
          )}
          {divergencias.length === 0 && presenca.estado === 'emPlano' && (
            <span className="text-ok text-[11.5px]">Origem e destino conferem com o Eproc.</span>
          )}
          <div>
            <label className="label" htmlFor={`obs-regra-${r.numero}`}>
              Observação
            </label>
            <textarea
              id={`obs-regra-${r.numero}`}
              className="textarea"
              rows={2}
              placeholder="Em poucas palavras, o que esta regra faz…"
              defaultValue={observacao}
              disabled={somenteLeitura}
              onBlur={(e) => definir(r.numero, e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="font-semibold text-texto">{rotulo}: </span>
      {children}
    </div>
  );
}

function Selo({ estado, titulo }: { estado: EstadoPresenca; titulo: string }) {
  return (
    <span
      title={titulo || undefined}
      className={cn(
        'self-start text-[10.5px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap',
        estado === 'emPlano' && 'bg-ok-suave text-ok border-ok-borda',
        estado === 'divergente' && 'bg-aviso-suave text-aviso border-aviso-borda',
        estado === 'ausente' && 'bg-superficie-2 text-texto-3 border-borda-forte',
      )}
    >
      {ROTULO_SELO[estado]}
    </span>
  );
}
