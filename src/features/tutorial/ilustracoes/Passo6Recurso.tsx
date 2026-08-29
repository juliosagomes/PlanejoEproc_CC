import { Icon } from '@/components/Icon';
import { Em, Palco } from './pecas';

/**
 * Cena 6 — o bloco "Recursos atrelados" com uma linha de subitem preenchida.
 *
 * A linha copia a grade real do `.subitem` (checkbox / categoria / nome / X) e
 * mostra a categoria já em "Modelo", que é o default de `addSub()` no
 * `EdgePanel` — o usuário não precisa trocar nada para este caso.
 */
export function Passo6Recurso() {
  return (
    <Palco altura={200}>
      <Em left={30} top={20}>
        <div style={{ width: 460 }}>
          <div className="mb-2 flex items-center justify-between">
            <span className="label" style={{ marginBottom: 0 }}>
              Recursos atrelados
              <span className="mono ml-2 text-[10.5px] font-medium normal-case tracking-normal text-texto-3">
                0 de 1 criados
              </span>
            </span>
            <span className="btn btn-sm">
              <Icon.Plus /> Adicionar
            </span>
          </div>

          <div className="subitem">
            <input type="checkbox" className="pj-check" readOnly checked={false} />
            <div className="select" style={{ height: 26, padding: '2px 6px', fontSize: 11.5 }}>
              Modelo
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="input" style={{ height: 26, padding: '2px 6px', fontSize: 12 }}>
                Vista para réplica
              </div>
            </div>
            <span className="btn btn-icon btn-sm btn-ghost">
              <Icon.X />
            </span>
          </div>

          <p className="mt-3 text-[11px] leading-snug text-texto-3">
            Marque o ✓ conforme for criando cada recurso no Eproc. O contador da
            aresta e o checklist acompanham sozinhos.
          </p>
        </div>
      </Em>
    </Palco>
  );
}
