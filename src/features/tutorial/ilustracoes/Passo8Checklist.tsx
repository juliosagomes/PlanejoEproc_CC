import { Em, Palco } from './pecas';

/**
 * Cena 8 — o checklist como ele sai **destes** 8 passos.
 *
 * Duas seções, não uma árvore: o "Vista para réplica" aparece solto em "Modelo"
 * porque a regra de ATP não foi marcada como "implantar no checklist" (isso mora
 * atrás do botão "Detalhar ATP", que este roteiro não abre). Desenhar o recurso
 * aninhado sob a ATP renderia um slide mais bonito e um usuário confuso ao
 * comparar com a própria tela.
 *
 * A ordem das seções é a de `CHECKLIST_GROUP_ORDER` em `features/checklist/derive.ts`.
 */
function Secao({ titulo, contagem }: { titulo: string; contagem: string }) {
  return (
    <div className="mt-2 flex items-baseline justify-between border-b border-borda pb-1">
      <span className="section-h">{titulo}</span>
      <span className="mono text-[11px] text-texto-3">{contagem}</span>
    </div>
  );
}

function Item({ nome, contexto }: { nome: string; contexto?: string }) {
  return (
    <div className="flex items-start gap-3 border-b border-borda px-1.5 py-2">
      <input type="checkbox" className="pj-check" readOnly checked={false} style={{ marginTop: 2 }} />
      <div className="min-w-0">
        <div className="text-[13px] font-medium">{nome}</div>
        {contexto !== undefined && (
          <div className="mono text-[10.5px] text-texto-3">{contexto}</div>
        )}
      </div>
    </div>
  );
}

export function Passo8Checklist() {
  return (
    // 252 é o que cabe a última linha de contexto sem cortar. Medido na tela,
    // não estimado: com 222 o "ag. contestação → ag. réplica" ficava pela metade.
    <Palco altura={252}>
      <Em left={30} top={10}>
        <div style={{ width: 460 }}>
          <span className="section-h">Checklist · plano sem título</span>
          <div className="mono mt-0.5 text-[11px] text-texto-3">0 de 3 criados · 3 pendentes</div>

          <Secao titulo="Localizador" contagem="0/2" />
          <Item nome="ag. contestação" />
          <Item nome="ag. réplica" />

          <Secao titulo="Modelo" contagem="0/1" />
          <Item nome="Vista para réplica" contexto="ag. contestação → ag. réplica" />
        </div>
      </Em>
    </Palco>
  );
}
