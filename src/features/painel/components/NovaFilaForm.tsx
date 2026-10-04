import { useState } from 'react';
import { ORIGENS_FILA, type GrupoPreferencias, type OrigemFila } from '@/domain';
import { Icon } from '@/components/Icon';
import { SugestoesInput } from '@/components/SugestoesInput';
import { useSugestoesFila } from '../dados';
import { usePainelStore } from '../store';

interface NovaFilaFormProps {
  setorId: string;
  grupos: GrupoPreferencias[];
}

export function NovaFilaForm({ setorId, grupos }: NovaFilaFormProps) {
  const criarFila = usePainelStore((s) => s.criarFila);
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [origem, setOrigem] = useState<OrigemFila>('preferencia');
  const [grupoId, setGrupoId] = useState('');
  const sugestoes = useSugestoesFila();

  if (!aberto) {
    return (
      <button type="button" className="btn btn-sm self-start" onClick={() => setAberto(true)}>
        <Icon.Plus /> Nova fila de trabalho
      </button>
    );
  }

  const fechar = () => {
    setAberto(false);
    setNome('');
  };

  return (
    <form
      className="flex flex-col gap-2 rounded-lg p-3 border border-dashed border-destaque-borda bg-destaque-suave"
      onSubmit={(e) => {
        e.preventDefault();
        if (!nome.trim()) return;
        const alvo = nome.trim().toLocaleLowerCase('pt-BR');
        const doEproc = sugestoes.some(
          (s) => s.origem === origem && s.valor.toLocaleLowerCase('pt-BR') === alvo,
        );
        criarFila({
          nome,
          origem,
          setorId,
          ...(grupoId ? { grupoId } : {}),
          // O nome já veio do Eproc, na mesma tela: a fila existe lá.
          ja_criado: doEproc,
        });
        fechar();
      }}
    >
      <label className="flex flex-col gap-1 text-[11.5px] text-texto-2">
        Nome da fila, como aparece no Eproc
        <SugestoesInput
          className="input"
          autoFocus
          value={nome}
          onValueChange={setNome}
          sugestoes={sugestoes}
          onEscolher={(s) => setOrigem(s.origem)}
          placeholder={
            sugestoes.length > 0
              ? 'Digite ou escolha uma consulta da unidade'
              : 'Ex.: CUMPRIMENTO - Alvarás'
          }
          onKeyDown={(e) => e.key === 'Escape' && fechar()}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <label className="flex flex-col gap-1 text-[11.5px] text-texto-2 flex-1 min-w-[160px]">
          Onde fica
          <select
            className="select"
            value={origem}
            onChange={(e) => setOrigem(e.target.value as OrigemFila)}
          >
            {(Object.keys(ORIGENS_FILA) as OrigemFila[]).map((o) => (
              <option key={o} value={o}>
                {ORIGENS_FILA[o]}
              </option>
            ))}
          </select>
        </label>
        {origem === 'preferencia' && (
          <label className="flex flex-col gap-1 text-[11.5px] text-texto-2 flex-1 min-w-[160px]">
            Grupo de preferências
            <select className="select" value={grupoId} onChange={(e) => setGrupoId(e.target.value)}>
              <option value="">Sem grupo</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn btn-sm btn-accent" disabled={!nome.trim()}>
          Adicionar ao setor
        </button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={fechar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
