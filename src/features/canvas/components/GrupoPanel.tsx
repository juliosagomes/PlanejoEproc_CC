import { CORES_FLAG, nomeEfetivo } from '@/domain';
import { Icon } from '@/components/Icon';
import { PanelHeader } from '@/components/PanelHeader';
import { cn } from '@/utils/cn';
import type { GrupoFlow } from '../grupoMudancas';
import { useIrParaNo } from '../irParaNo';
import { useCanvasStore } from '../store';

interface GrupoPanelProps {
  grupo: GrupoFlow;
}

/** Painel de uma moldura de grupo (decisoes.md#D-31). */
export function GrupoPanel({ grupo }: GrupoPanelProps) {
  const nodes = useCanvasStore((s) => s.nodes);
  const atualizarGrupo = useCanvasStore((s) => s.atualizarGrupo);
  const removerGrupo = useCanvasStore((s) => s.removerGrupo);
  const somenteLeitura = useCanvasStore((s) => s.somenteLeitura);
  const irParaNo = useIrParaNo();

  return (
    <div className="flex flex-col h-full">
      <PanelHeader
        eyebrow="Grupo"
        title={grupo.rotulo || 'Grupo sem nome'}
        right={
          somenteLeitura ? undefined : (
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => removerGrupo(grupo.id)}
              title="Desfaz a moldura; os localizadores ficam onde estão"
            >
              <Icon.Trash /> Desfazer grupo
            </button>
          )
        }
      />
      <fieldset disabled={somenteLeitura} className="contents">
        <div className="flex-1 overflow-auto scroll p-4 flex flex-col gap-3.5">
          <p className="text-[12px] text-texto-2 leading-relaxed m-0">
            O grupo organiza o desenho: arrastar a moldura leva o que está dentro,
            e recolhê-lo troca os localizadores por um bloco só. Não muda nada no
            Eproc nem no checklist. Para dizer quem trabalha cada localizador,
            use os setores.
          </p>

          <div>
            <label className="label" htmlFor={`rotulo-${grupo.id}`}>
              Nome
            </label>
            <input
              id={`rotulo-${grupo.id}`}
              className="input"
              value={grupo.rotulo}
              autoFocus={!somenteLeitura}
              onChange={(e) => atualizarGrupo(grupo.id, { rotulo: e.target.value })}
              placeholder="Ex.: Gabinete, Cumprimento de sentença…"
            />
          </div>

          <div>
            <span className="label">Cor</span>
            <div className="flex gap-1.5" role="radiogroup" aria-label="Cor do grupo">
              {CORES_FLAG.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={grupo.cor === c}
                  aria-label={`Cor ${c}`}
                  className={cn('grupo-cor-amostra', `pj-grupo-cor-${c}`, grupo.cor === c && 'ativa')}
                  onClick={() => atualizarGrupo(grupo.id, { cor: c })}
                />
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-[12.5px] cursor-pointer">
            <input
              type="checkbox"
              className="pj-check"
              checked={!!grupo.recolhido}
              onChange={(e) => atualizarGrupo(grupo.id, { recolhido: e.target.checked })}
            />
            Recolhido
          </label>

          <div>
            <span className="label">
              Localizadores <span className="mono text-texto-3 normal-case tracking-normal">{grupo.membros.length}</span>
            </span>
            {grupo.membros.length === 0 ? (
              <div className="text-[11.5px] text-texto-3 leading-snug">
                Vazio. Arraste localizadores para dentro da moldura.
              </div>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {grupo.membros.map((id) => (
                  <li key={id}>
                    <button
                      type="button"
                      className="text-[12px] text-texto-2 hover:text-texto hover:underline text-left disabled:no-underline"
                      disabled={!!grupo.recolhido}
                      onClick={() => irParaNo(id)}
                      title={grupo.recolhido ? 'Expanda o grupo para ir até o localizador' : 'Ir até o localizador'}
                    >
                      {nomeEfetivo(nodes, id) || 'Sem nome'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </fieldset>
    </div>
  );
}
