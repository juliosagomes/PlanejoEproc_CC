import {
  ORIGENS_FILA,
  ORIGENS_FILA_NOVA,
  chaveLocalizador,
  ehTelaFila,
  type DefinicaoFlag,
  type FilaTrabalho,
  type GrupoPreferencias,
  type LocalizadorDaUnidade,
} from '@/domain';
import { Icon } from '@/components/Icon';
import { cn } from '@/utils/cn';
import { usePainelStore } from '../store';
import { NOVO_GRUPO, SeletorGrupo } from './SeletorGrupo';

interface FilaCardProps {
  fila: FilaTrabalho;
  /** Localizadores do setor que está na tela; os demais aparecem tracejados. */
  doSetor: ReadonlySet<string>;
  locs: LocalizadorDaUnidade[];
  grupos: GrupoPreferencias[];
  somenteLeitura: boolean;
  /** Presente quando a fila perdeu o setor (ele foi apagado): oferece outro. */
  setoresParaMover?: DefinicaoFlag[];
}

export function FilaCard({ fila, doSetor, locs, grupos, somenteLeitura, setoresParaMover }: FilaCardProps) {
  const atualizar = usePainelStore((s) => s.atualizarFila);
  const remover = usePainelStore((s) => s.removerFila);
  const definirGrupo = usePainelStore((s) => s.definirGrupo);
  const criarGrupo = usePainelStore((s) => s.criarGrupo);
  const incluir = usePainelStore((s) => s.incluirLocalizador);
  const tirar = usePainelStore((s) => s.tirarLocalizador);

  const naFila = new Set(fila.localizadores.map(chaveLocalizador));
  const existentes = new Set(locs.map((l) => l.chave));
  const disponiveis = locs.filter((l) => !naFila.has(l.chave));

  return (
    <article className="bg-superficie border border-borda rounded-lg p-3 flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <div className="font-semibold text-[13px] flex-1 min-w-0 break-words">{fila.nome}</div>
        <button
          type="button"
          disabled={somenteLeitura}
          onClick={() => atualizar(fila.id, { ja_criado: !fila.ja_criado })}
          title="Alternar entre planejada e já existente no Eproc"
          className={cn(
            'text-[11px] font-semibold rounded-full px-2 py-px border whitespace-nowrap cursor-pointer disabled:cursor-default',
            fila.ja_criado
              ? 'text-ok bg-ok-suave border-ok-borda'
              : 'text-destaque bg-destaque-suave border-destaque-borda border-dashed',
          )}
        >
          {fila.ja_criado ? 'Já existe no Eproc' : 'Planejada'}
        </button>
        {!somenteLeitura && (
          <button
            type="button"
            className="btn btn-sm btn-ghost btn-icon"
            style={{ width: 24 }}
            aria-label={`Remover a fila ${fila.nome}`}
            title="Remover fila"
            onClick={() => {
              if (window.confirm(`Remover a fila "${fila.nome}"?`)) remover(fila.id);
            }}
          >
            <Icon.Trash />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-texto-2">
        {ehTelaFila(fila.origem) ? (
          <span className="px-1.5 py-px rounded border bg-superficie-2 border-borda">
            {ORIGENS_FILA[fila.origem]}
          </span>
        ) : (
          // Origem de antes, que o Eproc não tem como fila (D-37): pede a tela certa.
          <select
            className="select text-aviso bg-aviso-suave"
            style={{ width: 'auto', height: 22, padding: '0 6px', fontSize: 11.5 }}
            aria-label="Escolher a tela da fila"
            title={`"${ORIGENS_FILA[fila.origem]}" não é tela de fila no Eproc. Escolha onde a fila fica.`}
            disabled={somenteLeitura}
            value=""
            onChange={(e) => ehTelaFila(e.target.value) && atualizar(fila.id, { origem: e.target.value })}
          >
            <option value="">{ORIGENS_FILA[fila.origem]} — revisar onde fica…</option>
            {ORIGENS_FILA_NOVA.map((o) => (
              <option key={o} value={o}>
                {ORIGENS_FILA[o]}
              </option>
            ))}
          </select>
        )}
        <SeletorGrupo
          className="select"
          style={{ width: 'auto', height: 22, padding: '0 6px', fontSize: 11.5 }}
          disabled={somenteLeitura}
          value={fila.grupoId ?? ''}
          grupos={grupos}
          onChange={(v) =>
            definirGrupo(fila.id, (v.startsWith(NOVO_GRUPO) ? criarGrupo(v.slice(NOVO_GRUPO.length)) : v) || null)
          }
        />
        {setoresParaMover && !somenteLeitura && (
          <select
            className="select"
            style={{ width: 'auto', height: 22, padding: '0 6px', fontSize: 11.5 }}
            aria-label="Mover para o setor"
            value=""
            onChange={(e) => e.target.value && atualizar(fila.id, { setorId: e.target.value })}
          >
            <option value="">Setor apagado — mover para…</option>
            {setoresParaMover.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1" aria-label="Localizadores que a fila olha">
        {fila.localizadores.map((nome) => {
          const chave = chaveLocalizador(nome);
          const sumiu = !existentes.has(chave);
          return (
            <span
              key={chave}
              title={sumiu ? 'Não está em nenhum plano' : doSetor.has(chave) ? undefined : 'De outro setor'}
              className={cn(
                'inline-flex items-center gap-0.5 rounded border text-[12px] pl-2 pr-0.5 py-px max-w-full',
                doSetor.has(chave)
                  ? 'bg-superficie-2 border-borda'
                  : 'border-dashed border-borda-forte text-texto-3',
                sumiu && 'line-through',
              )}
            >
              <span className="truncate">{nome}</span>
              {!somenteLeitura && (
                <button
                  type="button"
                  className="w-[18px] h-[18px] rounded text-texto-3 hover:bg-borda hover:text-texto leading-none"
                  aria-label={`Tirar ${nome} desta fila`}
                  onClick={() => tirar(fila.id, nome)}
                >
                  ×
                </button>
              )}
            </span>
          );
        })}
        {!somenteLeitura && disponiveis.length > 0 && (
          <select
            className="text-[11.5px] text-texto-2 bg-transparent border border-dashed border-borda-forte rounded px-1.5 py-px max-w-[180px] cursor-pointer"
            aria-label={`Incluir localizador na fila ${fila.nome}`}
            value=""
            onChange={(e) => {
              const loc = locs.find((l) => l.chave === e.target.value);
              if (loc) incluir(fila.id, loc.nome);
            }}
          >
            <option value="">+ localizador</option>
            <optgroup label="Deste setor">
              {disponiveis
                .filter((l) => doSetor.has(l.chave))
                .map((l) => (
                  <option key={l.chave} value={l.chave}>
                    {l.nome}
                  </option>
                ))}
            </optgroup>
            <optgroup label="Outros">
              {disponiveis
                .filter((l) => !doSetor.has(l.chave))
                .map((l) => (
                  <option key={l.chave} value={l.chave}>
                    {l.nome}
                  </option>
                ))}
            </optgroup>
          </select>
        )}
      </div>
    </article>
  );
}
