import { useEffect, useRef } from 'react';
import { Icon } from '@/components/Icon';
import { useCatalogoStore } from '../store';
import { selectTotalAnotacoes, useAnotacoesStore } from '../storeAnotacoes';
import { CatalogoRecursos } from './CatalogoRecursos';

interface CatalogoOrgaoModalProps {
  open: boolean;
  onClose: () => void;
}

function dataHoraBR(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/**
 * Modal do catálogo — a tela de consulta dos recursos mapeados
 * (decisoes.md#D-25).
 *
 * Faz três coisas: gerencia o XLS de localizadores do órgão (importar,
 * reimportar, limpar), **lista** tudo o que o app conhece da unidade — os
 * localizadores mais as preferências, modelos e textos padrão coletados —, e
 * deixa o usuário anotar descrição e orientações de uso em cada recurso.
 *
 * Reimportar sobrescreve o catálogo, com confirmação via `window.confirm`
 * (consistente com excluir plano); as anotações não são tocadas, e têm botão
 * próprio para apagar.
 *
 * Mensagens (`ultimoErro`, `ultimasStats`) vêm da store e são resetadas ao
 * fechar, para o modal não "lembrar" estado entre aberturas distintas.
 */
export function CatalogoOrgaoModal({ open, onClose }: CatalogoOrgaoModalProps) {
  const catalogo = useCatalogoStore((s) => s.catalogo);
  const totalAnotacoes = useAnotacoesStore(selectTotalAnotacoes);
  const limparAnotacoes = useAnotacoesStore((s) => s.limparTudo);
  const ultimoErro = useCatalogoStore((s) => s.ultimoErro);
  const ultimasStats = useCatalogoStore((s) => s.ultimasStats);
  const importarXls = useCatalogoStore((s) => s.importarXls);
  const limpar = useCatalogoStore((s) => s.limpar);
  const resetMensagens = useCatalogoStore((s) => s.resetMensagens);

  const inputRef = useRef<HTMLInputElement | null>(null);

  // Reseta mensagens transitórias ao fechar — abertura subsequente parte limpa.
  useEffect(() => {
    if (!open) resetMensagens();
  }, [open, resetMensagens]);

  if (!open) return null;

  const escolherArquivo = () => {
    if (catalogo) {
      const ok = window.confirm(
        'Importar um novo XLS substitui o catálogo atual.\n\nContinuar?',
      );
      if (!ok) return;
    }
    inputRef.current?.click();
  };

  const handleArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Permite reimportar o mesmo arquivo logo em seguida.
    e.target.value = '';
    if (!file) return;
    await importarXls(file);
  };

  const handleLimpar = () => {
    const ok = window.confirm(
      'Remover o catálogo do órgão?\n\nAs sugestões de localizador deixarão de aparecer até você reimportar. Suas anotações ficam.',
    );
    if (!ok) return;
    limpar();
  };

  const handleLimparAnotacoes = () => {
    const ok = window.confirm(
      `Apagar as ${totalAnotacoes} anotações do catálogo?\n\nAs descrições e orientações que você escreveu somem. O catálogo em si não é tocado.`,
    );
    if (!ok) return;
    limparAnotacoes();
  };

  const totalItens = catalogo?.itens.length ?? 0;

  return (
    <>
      <div className="scrim no-print" onClick={onClose} />
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Catálogo do órgão"
        style={{ width: 'min(720px, 94vw)' }}
      >
        <div
          className="px-5 pt-4 pb-3 flex items-start gap-3"
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
            <Icon.Library />
          </div>
          <div className="flex-1">
            <div className="section-h">Catálogo do órgão</div>
            <div className="text-[12px] text-texto-3 mt-0.5">
              Tudo o que o app conhece do Eproc — e o que você anotou sobre cada
              recurso.
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

        <div className="flex-1 overflow-auto scroll p-5 flex flex-col gap-4">
          {catalogo ? (
            <div
              className="px-4 py-3 rounded-lg"
              style={{
                background: 'var(--ok-suave)',
                border: '1px solid var(--ok-borda)',
              }}
            >
              {/* Fala só do XLS: a contagem das abas é a união com o que veio
                  da unidade, e repeti-la aqui daria dois números diferentes
                  para a mesma palavra. */}
              <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
                <div className="font-semibold">
                  XLS do órgão: {totalItens} localizador{totalItens === 1 ? '' : 'es'}
                </div>
                <div className="mono text-[11px] text-texto-3">
                  importado em {dataHoraBR(catalogo.importadoEm)}
                </div>
              </div>
            </div>
          ) : (
            <div
              className="px-4 py-3 rounded-lg text-[12px] text-texto-3 leading-snug"
              style={{
                border: '1px dashed var(--borda-forte)',
                background: 'var(--superficie-2)',
              }}
            >
              <div className="font-semibold text-texto mb-0.5 text-[12.5px]">
                Nenhum XLS importado
              </div>
              Exporte os localizadores do seu órgão pelo Eproc (XLS) e importe
              aqui — é o caminho que funciona offline. Os localizadores padrão do
              Eproc entram junto, marcados como <strong>Sistema</strong>.
            </div>
          )}

          {ultimasStats && !ultimoErro && (
            <div
              className="px-4 py-3 rounded-lg text-[12px] leading-snug"
              style={{
                background: 'var(--destaque-suave)',
                border: '1px solid var(--destaque-borda)',
              }}
            >
              <div className="font-semibold text-[13px] mb-1">Resumo da importação</div>
              <ul className="list-disc pl-4 text-texto-2">
                <li>{ultimasStats.importados} importados</li>
                {ultimasStats.sistema > 0 && (
                  <li>
                    {ultimasStats.sistema} de sistema (importados e marcados)
                  </li>
                )}
                {ultimasStats.ignoradosDuplicados > 0 && (
                  <li>{ultimasStats.ignoradosDuplicados} duplicados</li>
                )}
                {ultimasStats.ignoradosVazios > 0 && (
                  <li>{ultimasStats.ignoradosVazios} com nome vazio</li>
                )}
              </ul>
            </div>
          )}

          {ultimoErro && (
            <div
              className="px-4 py-3 rounded-lg text-[12.5px]"
              style={{
                background: 'var(--aviso-suave)',
                border: '1px solid var(--aviso)',
                color: 'var(--texto)',
              }}
              role="alert"
            >
              <div className="font-semibold mb-0.5">Falha ao importar</div>
              <div className="text-texto-2 leading-snug">{ultimoErro}</div>
            </div>
          )}

          <CatalogoRecursos />

          <div className="text-[11.5px] text-texto-3 leading-snug">
            <strong>Onde exportar:</strong> no Eproc, em Localizadores &rarr;
            Localizadores do Órgão, use exportar/imprimir para gerar o{' '}
            <span className="mono">.xls</span>. Guarde onde preferir e abra pelo
            botão abaixo sempre que o órgão criar ou renomear localizadores.
          </div>
        </div>

        <div
          className="px-5 py-3 flex items-center gap-3"
          style={{ borderTop: '1px solid var(--borda)', background: 'var(--fundo)' }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xls,application/vnd.ms-excel"
            onChange={handleArquivo}
            style={{ display: 'none' }}
          />
          {catalogo && (
            <button
              type="button"
              className="btn"
              onClick={handleLimpar}
              title="Remove o catálogo do navegador. As anotações ficam."
            >
              <Icon.Trash /> Limpar XLS
            </button>
          )}
          {totalAnotacoes > 0 && (
            <button
              type="button"
              className="btn"
              onClick={handleLimparAnotacoes}
              title="Apaga as descrições e orientações que você escreveu"
            >
              <Icon.Trash /> Anotações ({totalAnotacoes})
            </button>
          )}
          <div className="flex-1" />
          <button type="button" className="btn" onClick={onClose}>
            Fechar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={escolherArquivo}
          >
            <Icon.Upload /> {catalogo ? 'Reimportar XLS' : 'Importar XLS'}
          </button>
        </div>
      </div>
    </>
  );
}
