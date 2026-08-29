import { useEffect, useId, useState } from 'react';
import { Icon } from '@/components/Icon';
import { ILUSTRACOES } from '../ilustracoes';
import {
  anterior,
  ehPrimeiro,
  ehUltimo,
  limitar,
  proximo,
  rotuloAvancar,
} from '../navegacao';
import { PASSOS, TOTAL_PASSOS } from '../roteiro';

interface TutorialModalProps {
  open: boolean;
  /** Chamado por Concluir, Pular, X, Esc e clique no scrim — todos marcam como visto. */
  onFechar: () => void;
}

/* ============================================================================
 * TUTORIAL EM SLIDES
 *
 * Casca no mesmo esqueleto dos outros modais do app (scrim + `.modal` + header
 * / corpo / rodapé). Não extraí um `ModalShell` compartilhado: os nove modais
 * do projeto divergem em coisas de verdade — o do checklist é impresso, o dos
 * códigos tem scrim que não fecha —, e este, com bolinhas e três botões, é o
 * pior molde possível para uma abstração.
 * ========================================================================== */

export function TutorialModal({ open, onFechar }: TutorialModalProps) {
  const [indice, setIndice] = useState(0);
  const tituloId = useId();

  // Esc fecha, e ←/→ navegam. O guarda de INPUT/TEXTAREA espelha o atalho de
  // Delete do `App.tsx`: aqui não há campo de texto hoje, mas um slide futuro
  // com um campo herdaria o bug de "digitei e o tutorial pulou".
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onFechar();
        return;
      }
      const alvo = e.target as HTMLElement | null;
      const tag = alvo?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || alvo?.isContentEditable) return;
      if (e.key === 'ArrowRight') setIndice((i) => proximo(i));
      if (e.key === 'ArrowLeft') setIndice((i) => anterior(i));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onFechar]);

  // Reabrir pela barra lateral começa do início — quem pediu para rever quer o
  // roteiro inteiro, não o slide em que desistiu da última vez.
  useEffect(() => {
    if (open) setIndice(0);
  }, [open]);

  if (!open) return null;

  const passo = PASSOS[limitar(indice)];
  if (!passo) return null;
  const Ilustracao = ILUSTRACOES[passo.id];

  const avancar = () => {
    if (ehUltimo(indice)) onFechar();
    else setIndice((i) => proximo(i));
  };

  return (
    <>
      <div className="scrim no-print" onClick={onFechar} />
      <div
        className="modal no-print"
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
      >
        <div
          className="flex items-start gap-3 px-5 pb-3 pt-4"
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
            <Icon.Ajuda />
          </div>
          <div className="flex-1">
            <div className="section-h">
              Como usar · passo {passo.id} de {TOTAL_PASSOS}
            </div>
            <div id={tituloId} className="text-[14.5px] font-semibold">
              {passo.titulo}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-icon btn-ghost"
            onClick={onFechar}
            aria-label="Fechar o tutorial"
          >
            <Icon.X />
          </button>
        </div>

        {/* `min-h-0` é o que deixa este filho encolher dentro do `.modal`
            (flex column com `max-height: 88vh`) em vez de estourar a moldura. */}
        <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-auto scroll p-5">
          {Ilustracao !== undefined && <Ilustracao />}

          <div className="flex flex-col gap-2">
            {passo.paragrafos.map((p) => (
              <p key={p} className="text-[12.5px] leading-relaxed text-texto-2">
                {p}
              </p>
            ))}
          </div>

          {passo.nota !== undefined && (
            <p
              className="rounded-md px-2.5 py-2 text-[11.5px] leading-snug text-texto-2"
              style={{
                background: 'var(--aviso-suave)',
                border: '1px solid var(--borda)',
              }}
            >
              {passo.nota}
            </p>
          )}
        </div>

        <div
          className="flex items-center gap-2 px-5 py-3"
          style={{ borderTop: '1px solid var(--borda)', background: 'var(--fundo)' }}
        >
          <div className="flex items-center gap-0.5" role="tablist" aria-label="Passos do tutorial">
            {PASSOS.map((p, i) => {
              const ativo = i === limitar(indice);
              return (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={ativo}
                  aria-current={ativo ? 'step' : undefined}
                  aria-label={`Ir para o passo ${p.id} de ${TOTAL_PASSOS}`}
                  onClick={() => setIndice(i)}
                  className="flex items-center justify-center border-0 bg-transparent p-0"
                  // 24×24 é o alvo mínimo de toque; o ponto visível é menor.
                  style={{ width: 24, height: 24, cursor: 'pointer' }}
                >
                  <span
                    style={{
                      width: ativo ? 9 : 7,
                      height: ativo ? 9 : 7,
                      borderRadius: 999,
                      // Estado por tamanho E preenchimento, não só por cor.
                      background: ativo ? 'var(--destaque)' : 'transparent',
                      border: `1.5px solid ${ativo ? 'var(--destaque)' : 'var(--borda-forte)'}`,
                    }}
                  />
                </button>
              );
            })}
          </div>

          <span className="ml-1 hidden text-[10.5px] text-texto-3 min-[560px]:inline">
            ← → navegam
          </span>

          <div className="ml-auto flex items-center gap-2">
            <button type="button" className="btn btn-sm btn-ghost" onClick={onFechar}>
              {ehUltimo(indice) ? 'Fechar' : 'Pular'}
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setIndice((i) => anterior(i))}
              disabled={ehPrimeiro(indice)}
            >
              Anterior
            </button>
            {/* Mesmo elemento nos 8 passos, só o rótulo muda: trocar o botão
                remontaria o nó e o foco cairia no <body> justamente no fim. */}
            <button type="button" className="btn btn-sm btn-primary" onClick={avancar} autoFocus>
              {rotuloAvancar(indice)}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
