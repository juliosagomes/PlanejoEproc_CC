import { Icon } from '@/components/Icon';
import { ItemMenu, MenuSuspenso } from '@/components/MenuSuspenso';
import { useCanvasStore } from '@/features/canvas/store';
import { cn } from '@/utils/cn';
import { useMapasStore } from '../store';
import { useCatalogoMencoes } from '../useCatalogoMencoes';
import type { AlvoNoFluxo } from '../verNoFluxo';
import { EditorDocumento } from './EditorDocumento';
import { EditorSlides } from './EditorSlides';
import { IconeFormato } from './IconeFormato';

interface Props {
  onVerNoFluxo: (alvo: AlvoNoFluxo) => void;
  /** "A partir do fluxo…": leva ao quadro para escolher os localizadores. */
  onIrParaFluxo: () => void;
}

/**
 * Mapas descritivos (decisoes.md#D-39): a lista de mapas à esquerda e o mapa
 * aberto ao lado, no editor do formato dele.
 */
export function TelaMapas({ onVerNoFluxo, onIrParaFluxo }: Props) {
  const indice = useMapasStore((s) => s.indice);
  const aberto = useMapasStore((s) => s.aberto);
  const abrir = useMapasStore((s) => s.abrir);
  const criar = useMapasStore((s) => s.criar);
  const excluir = useMapasStore((s) => s.excluir);
  const somenteLeitura = useCanvasStore((s) => s.somenteLeitura);
  const catalogo = useCatalogoMencoes();

  const confirmarExcluir = (id: string, nome: string) => {
    if (window.confirm(`Excluir o mapa "${nome}"?\n\nEsta ação não pode ser desfeita.`)) excluir(id);
  };

  return (
    <div className="mapas-tela">
      <aside className="mapas-lateral no-print" aria-label="Mapas descritivos">
        <div className="mapas-lateral-cab">
          <h2>Mapas descritivos</h2>
          {!somenteLeitura && (
            <MenuSuspenso
              lado="direita"
              largura={290}
              className="btn btn-sm btn-accent"
              gatilho={
                <>
                  <Icon.Plus /> Novo
                </>
              }
            >
              <ItemMenu
                icone={<IconeFormato formato="paisagem" />}
                rotulo="Paisagem"
                descricao="Slides livres, como no PowerPoint: texto, imagem e desenho"
                onSelect={() => criar('paisagem')}
              />
              <ItemMenu
                icone={<IconeFormato formato="retrato" />}
                rotulo="Retrato"
                descricao="Documento corrido, como no Word ou no Writer"
                onSelect={() => criar('retrato')}
              />
              <ItemMenu
                icone={<Icon.Sincronizar />}
                rotulo="A partir do fluxo…"
                descricao="Selecione localizadores no quadro e use “Gerar mapa descritivo”"
                onSelect={onIrParaFluxo}
              />
            </MenuSuspenso>
          )}
        </div>
        <ul className="mapas-lista">
          {indice.length === 0 && (
            <li className="mapas-vazio">
              Nenhum mapa ainda. Crie um em branco pelo “Novo”, ou selecione localizadores no fluxo e
              use “Gerar mapa descritivo”.
            </li>
          )}
          {indice.map((e) => (
            <li key={e.id} className={cn('mapas-item', aberto?.id === e.id && 'ativo')}>
              <button type="button" className="mapas-item-abrir" onClick={() => abrir(e.id)} aria-current={aberto?.id === e.id}>
                <IconeFormato formato={e.formato} />
                <span className="min-w-0">
                  <b>{aberto?.id === e.id ? aberto.nome || 'Sem nome' : e.nome || 'Sem nome'}</b>
                  <small>{e.resumo}</small>
                </span>
              </button>
              {!somenteLeitura && (
                <button
                  type="button"
                  className="mapas-item-excluir"
                  onClick={() => confirmarExcluir(e.id, e.nome)}
                  aria-label={`Excluir o mapa ${e.nome}`}
                  title="Excluir mapa"
                >
                  <Icon.Trash />
                </button>
              )}
            </li>
          ))}
        </ul>
        <p className="mapas-lateral-pe">
          Os mapas ficam neste navegador, separados dos planos, e podem citar qualquer plano da
          unidade. Eles ainda não vão no “Salvar cópia” nem no envio ao servidor.
        </p>
      </aside>
      <section className="mapas-editor">
        {!aberto && <div className="mapas-sem-mapa">Escolha um mapa na lista ou crie um novo.</div>}
        {aberto?.formato === 'retrato' && (
          <EditorDocumento key={aberto.id} mapa={aberto} catalogo={catalogo} somenteLeitura={somenteLeitura} onVerNoFluxo={onVerNoFluxo} />
        )}
        {aberto?.formato === 'paisagem' && (
          <EditorSlides key={aberto.id} mapa={aberto} catalogo={catalogo} somenteLeitura={somenteLeitura} onVerNoFluxo={onVerNoFluxo} />
        )}
      </section>
    </div>
  );
}
